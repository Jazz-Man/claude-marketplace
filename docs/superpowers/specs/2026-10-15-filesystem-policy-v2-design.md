# Filesystem policy v2 — design

**Date:** 2026-10-15
**Status:** draft (user review pending)
**Bean:** cc-sdd-phuy
**Feature:** replace the strict outside-cwd filesystem policy with a
pattern-based deny/ask engine, and extend the guard to the file-tool channel.

## 1. Problem

The current `filesystemPolicy` denies every path outside the Bash payload
cwd. In practice this blocks ordinary daily work (reading repo-root files
from a package cwd, `~` and system inspection, homebrew paths), so the
owner disabled it in `run-hook.ts` and rebuilt the binary without it. The
filesystem control must come back in a practical form.

A second gap: the guard only inspects the **Bash** tool. `Read`, `Edit`,
`Write`, and `NotebookEdit` reach any file on disk without passing through
the binary at all.

## 2. Pattern source (mandatory reading)

**Implementers and reviewers must read `tmp/pattern-source.md` (repo-root
`tmp/`, git-ignored) before touching §7.** It is the single carrier of the
reference-implementation details: identity, license posture, a module map
tying each spec rule table to the reference file to consult, and the
reading order. All pattern data in `cli-hook` is written fresh for this
project; nothing is copied from the reference. The reference file lives
under git-ignored `tmp/` deliberately — no reference-implementation
detail enters committed history.

## 3. Verdict model

`PolicyCheckResult` widens from `deny | null` to **`deny | ask | null`**
(null = allow, unchanged):

- `decision.ts` gains `ask(reason)` producing
  `PreToolUseHookSpecificOutput { permissionDecision: "ask", permissionDecisionReason }`
  (SDK allows it: `HookPermissionDecision = 'allow' | 'deny' | 'ask' | 'defer'`).
- The four existing policies keep their deny/null contracts untouched.

Precedence fact this design relies on (official docs — hooks-guide
§"Hooks and permission modes", permission-modes §bypassPermissions): a
PreToolUse hook deny
blocks in every permission mode including `bypassPermissions`; explicit ask
rules still prompt in bypass. Answered fact (T8 live smoke): the binary
emits `ask`; the harness auto-allows it under `bypassPermissions` — the
ask tier renders prompts in normal modes only.

## 4. Policy context

```ts
export interface PolicyContext {
  cwd: string; // Bash working dir of this call (moves per call)
  projectRoot: string; // additional allowed root (see the boundary rule §7.5)
}
```

`projectRoot` = `process.env.CLAUDE_PROJECT_DIR ?? cwd` — no fallback
chains. The allowed zone is **$HOME ∪ projectRoot** (owner decision
2026-10-15): ordinary reads AND writes inside the zone are allowed;
outside it both are denied. projectRoot exists so a repository located
outside $HOME does not brick the agent inside its own files.

## 5. Router

```ts
const POLICIES: Policy[] = [
  noDepsPolicy, // absolutes first: deny-only
  gitReadonlyPolicy, //
  noInlineScriptsPolicy,
  filesystemPolicy, // v2: deny | ask
];
```

First non-null result wins (rule unchanged). A deny-vs-ask conflict is
structurally impossible: absolutes emit only deny and run before v2; only
v2 can emit ask.

## 6. Tool channel (new)

- `plugins/security-guard/hooks/hooks.json`: matcher `Bash` →
  `Bash|Read|Edit|Write|NotebookEdit` (same binary, same timeout).
- `payload.ts`: `ParsedHookInput` gains `filePath: string | undefined`
  extracted from `tool_input.file_path` (`notebook_path` for
  `NotebookEdit`).
- `run-hook.ts`: branch by `toolName`:
  - `Bash` → policy router;
  - `Read` → sensitive-path check, read intent;
  - `Edit | Write | NotebookEdit` → sensitive-path check, write intent;
  - anything else → null (fail-open).
- The sensitive-path table AND the HOME∪projectRoot boundary are shared
  between both channels (`Read /var/log/x` denies by the boundary, not a tier).
- `Grep`/`Glob` tools are a documented boundary — pattern arguments are
  too noisy to police here (§11).

### 6.1 Settings layer (companion, not plugin-shipped)

Plugins cannot ship permission rules — a plugin `settings.json` only takes
effect for `agent` and `subagentStatusLine`, and permission rules live only
in settings files where a deny at any level wins (permissions docs,
verified 2026-10-15). The plugin therefore ships
`plugins/security-guard/recommended-settings.json`: a ready-to-merge
`permissions.deny` block for the user's global settings covering the
exact-pattern families (secrets, system files, Claude settings, git
internals, `Bash(git hook:*)`, bare `env`/`printenv`). Division of labor:
settings rules apply even when the plugin is unloaded or in `--safe-mode`;
the hook carries the semantic layer (intents, scope, taint, ask tier) that
path patterns cannot express. A PreToolUse hook deny (exit 2) stops the
call before permission rules are evaluated and overrides allow rules — the
layers stack, they do not conflict. Settings rules are a best-effort
outer layer, **not** a guarantee — upstream issues document enforcement
gaps (anthropics/claude-code#24846 and its duplicates); the hook channel
of §6 is the enforcing guarantee and stays authoritative even if a
settings rule fails to fire.

## 7. Rule tables (module folder `src/policies/filesystem/` — single-file layout reversed by owner 2026-10-16: biome's 300-line-per-file limit; tiers → `tiers.ts`, resolution/boundary → `resolve.ts`, reasons → `reasons.ts`, intents → `intents.ts` (T3), injection/taint → `guards.ts` (T4), the Policy + `checkFilePath` → `policy.ts`)

### 7.1 SENSITIVE_PATHS

| Tier                   | Patterns (fresh data; source map in `tmp/pattern-source.md`)                                                                                                                                                                                                                                                       | Verdict                                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secrets                | `.env`, `.env.*`, `.ssh/*`, `id_rsa`, `id_ed25519`, `id_ecdsa`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `.aws/credentials`, `.gnupg/*`, `.netrc`, `.npmrc`, `.pypirc`, `.docker/config.json`, `.kube/config`, `.gcloud/*`, `credentials.json`, `*.secret`, `*.secrets`, `.htpasswd`, `token.json`, `terraform.tfstate` | **deny read+write, both channels, always** — even in-project                                                                                                                                                                                                                                                                                |
| ~~System~~             | REMOVED (owner 2026-10-16): a point-list of /etc files was a vestige of the pre-boundary design — the §7.5 boundary denies EVERYTHING outside $HOME ∪ projectRoot (reads included, `/dev/null`-family exempt), so the tier changed only the reason text. `/etc/*`, `/proc/*`, `/var/*` all deny via the boundary.  |
| Settings               | `.claude/settings.json`, `.claude/settings.local.json`, `~/.claude/settings.json`, `~/.claude.json`                                                                                                                                                                                                                | **deny read+write, both channels, always** (self-disable vector: settings hold the hooks that enforce the guard)                                                                                                                                                                                                                            |
| Git internals          | `.git/config`                                                                                                                                                                                                                                                                                                      | **deny write, both channels, always** (mutations belong to the git-readonly policy's `git config` gate; this closes the file-channel bypass; `~/.gitconfig` stays in PersonalConfig)                                                                                                                                                        |
| Git internals          | `.git/hooks/*`                                                                                                                                                                                                                                                                                                     | **deny read, write, and execute — any reference, both channels, always**: tool-channel `Read`/`Edit`/`Write`, and any Bash arg or command resolving under `.git/hooks/` (running `bash .git/hooks/x` is as bad as planting it). Name-based access via the `git hook` subcommand is closed in the git-readonly policy (companion rule, §7.5) |
| PersonalConfig         | `.bashrc`, `.zshrc`, `.zprofile`, `.profile`, `.bash_profile`, `.vimrc`, `.gitconfig`, `.config/*`, `.vscode/*`, `.cursor/*`                                                                                                                                                                                       | **deny write** (always — the tier is home-relative, a persistence vector); read allowed                                                                                                                                                                                                                                                     |
| macOS Library          | `~/Library/**` (whole tree)                                                                                                                                                                                                                                                                                        | **deny read+write, both channels, always** — Keychains, Safari, Mail, Application Support, Preferences live here (verified empirically on macOS 26.7.1; research 2026-10-15)                                                                                                                                                                |
| macOS personal folders | `~/Desktop`, `~/Documents`, `~/Downloads`, `~/Movies`, `~/Music`, `~/Pictures`, `~/Public`, `~/Applications`, `~/Sites`                                                                                                                                                                                            | **deny write/delete** — the user's personal content (TCC gates these at the OS level anyway); read allowed; **matching is case-insensitive** (the root APFS volume is case-insensitive: `~/DESKTOP` is the same folder)                                                                                                                     |

`.claude/*` as a whole is **unrestricted** (agents author skills and rules
there daily; the steering skill writes `.claude/rules/` in target
projects). Only the Settings tier above is forbidden.
`Makefile`, `Dockerfile`, `docker-compose.yml` carry **no tier entry**:
ordinary files, judged only by the decision table.

**macOS matching notes** (research 2026-10-15, verified on macOS 26.7.1):
home-relative segment comparisons are case-insensitive (root APFS is
case-insensitive — `/TMP`, `~/DESKTOP` resolve to the same places); the
lexical boundary already covers every symlink/firmlink spelling
(`/private/tmp/…`, `/etc`→`/private/etc`, `/System/Volumes/Data/…` are
all outside the zone), so no realpath resolution is needed.
**`/tmp`-family teaching hint**: denies on `/tmp`, `/private/tmp`,
`/var/tmp` append "write to `./tmp/` at the project root instead — it is
git-ignored there" — the same language the no-inline-scripts policy uses
when teaching script files under `./tmp/`.

### 7.2 INJECTION_PATTERNS (curated subset; source map in `tmp/pattern-source.md`)

**deny:** `/dev/tcp`, `/dev/udp` substrings; `LD_PRELOAD` /
`LD_LIBRARY_PATH` assignments; `PATH=` override whose value lacks
`$PATH`; `HISTFILE` / `.bash_history` / `HISTSIZE=0`; null byte; control
characters; non-ASCII whitespace.

**Owned by no-inline-scripts, not here:** fork bombs and every other
inline function definition. unbash types all definition forms as
`Function` AST nodes (verified empirically 2026-10-15: parens
`:(){…}`, underscore `_(){…}`, named, `function name {…}` keyword form,
and mutual recursion) — `core/ast.ts` collects their names into
`ParsedCommand.functionDefs` and no-inline-scripts denies any non-empty
list: shell code belongs in a file under `./tmp/`, and a fortiori a
self-spawning function never runs.

**Rejected as too noisy for daily work:** `$()`, backticks, `<()`, `>()`,
`${}`, `$((`, `$IFS`, `$'…'`, `\; \| \&`, brace expansion, `\x \u`
escapes, base64-in-pipe. **Owned by `no-inline-scripts`:** `eval`,
`source`, pipe-to-shell/interpreter, dot-sourcing (sanctioned file-exec
pattern).

### 7.3 NETWORK COMMANDS — blanket deny

Every network-touching command denies outright (owner decision): the
semantic surface of per-flag network analysis (uploads, downloads,
headers, output targets, exfiltration flows) is the largest and most
fragile part of the guard, and the owner has better channels — MCP tools
for pages/docs, and manual requests pasted into chat. The deny reason
redirects to those channels (sanctioned-channel hint, same class as
`./tmp/`).

Deny list: **curl, wget, nc, ssh, scp, sftp, ping, dig, host, nslookup,
whois, openssl** — caught on the unit name after wrapper unwrapping
(`env curl …` denies like `env sudo …` does).

Consequences: the taint pair, upload-glue parsing (`-d@/file`,
`--form=x=@path`, `-dVALUE`), the network output-target logic, and the
download/boundary interplay are all DEAD — nothing about a network
command is parsed because no network command runs.

### 7.4 INTENTS (wrappers transparent)

- **read:** cat, head, tail, less, more, wc, stat, file, du, df, find,
  ls, tree, grep, rg, diff, md5sum, shasum
- **write:** tee, cp, mv, touch, mkdir, ln, chmod, chown, truncate, dd,
  rsync, install, tar
- **delete:** rm, rmdir, shred, unlink
- **network:** none remain — the family moved to the §7.3 deny list
- **wrappers** (skip to the inner command): env, nice, nohup, timeout, xargs
- **sudo**: ANY use of `sudo` → **deny** (owner decision 2026-10-15) —
  privilege escalation is never an agent operation; caught directly and
  through wrapper chains (`env sudo …`)
- **PATH rule**: a unit whose executable is spelled as an absolute path
  (`/opt/homebrew/bin/biome …`, `/bin/ls`) → **deny** — every command the
  agent may need is on PATH by name (owner decision 2026-10-15);
  `./tmp/script.sh`-style relative paths are the sanctioned file-exec form
  and stay allowed.
- Unknown command → no intent: only 7.1/7.2/7.3 checks apply (fail-open
  posture — unknown commands are not pre-punished).
- Redirection targets (`>`, `>>`) count as write-intent targets.

### 7.5 DECISION table (scope vs projectRoot; first match wins)

Companion rule (lives in the git-readonly policy, listed here because it
closes the same vector): **the whole `git hook` subcommand → deny**
(`git hook run`, `git hook list`, any argument). `run` executes
`.git/hooks/<name>` by name, so no path appears in the args for a
filesystem scan to catch; `list` is reconnaissance of the same directory.
The plumbing command has no legitimate agent use.

| #   | Condition                                                                                                                                                                                                                                                                                                                                                                                                                                         | Verdict |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | Scope `/` (filesystem root), any intent — reads included (owner decision 2026-10-15)                                                                                                                                                                                                                                                                                                                                                              | deny    |
| 2   | Any §7.1 sensitive-path hit (tier verdict applies: read and/or write)                                                                                                                                                                                                                                                                                                                                                                             | deny    |
| 3   | Injection pattern (§7.2)                                                                                                                                                                                                                                                                                                                                                                                                                          | deny    |
| 4   | Network command (§7.3 list, unwrapped name)                                                                                                                                                                                                                                                                                                                                                                                                       | deny    |
| 5   | **Outside the allowed zone ($HOME ∪ projectRoot), read OR write** — `/etc/*`, `/var/*`, `/tmp/*`, `/opt/*`, other users' homes, … Relative `..`-chains resolve LEXICALLY before classification (`normalize(join(cwd, token))`), so `cat ../../../../../../etc/passwd` lands on `/etc/passwd` and denies. (Owner decision 2026-10-15; exempts `/dev/null`, `/dev/stdin`, `/dev/stdout`, `/dev/stderr`, `/dev/zero`, `/dev/urandom`, `/dev/random`) | deny    |
| 6   | Executable spelled as an absolute path (§7.4 PATH rule)                                                                                                                                                                                                                                                                                                                                                                                           | deny    |
| 7   | Any unit reaching `sudo` — directly or through a wrapper chain (§7.4, owner decision 2026-10-15)                                                                                                                                                                                                                                                                                                                                                  | deny    |
| 8   | write/delete targeting Home as a whole (`~`, `$HOME`, no tail)                                                                                                                                                                                                                                                                                                                                                                                    | deny    |
| 9   | read targeting Home as a whole                                                                                                                                                                                                                                                                                                                                                                                                                    | ask     |
| 10  | write to PersonalConfig tier (§7.1) — always home-relative                                                                                                                                                                                                                                                                                                                                                                                        | deny    |
| 11  | everything else: any read or write inside the zone (incl. writes in $HOME outside the project), prose-`=` mentions                                                                                                                                                                                                                                                                                                                                | allow   |

## 8. Behavior changes vs today

| Command                                                                                                                 | Today (policy disabled: all allow) | v2                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| `cat ../../README.md` (read repo root from a package cwd)                                                               | allow                              | **allow** (the pain, fixed; repo lives in $HOME)                                                |
| `cat ~/some-file.txt`, `tee ~/notes/x` (ordinary $HOME use)                                                             | allow                              | **allow**                                                                                       |
| `cat ../../../../../../etc/passwd` (relative `..`-escape)                                                               | allow                              | **deny** (lexical `..` collapse → `/etc/passwd`)                                                |
| `cat .env` in-project                                                                                                   | allow                              | **deny** (intentional; agent must ask the user)                                                 |
| `ls /etc`, `cat /etc/group`, `head /var/log/syslog`                                                                     | allow                              | **deny** (outside the zone)                                                                     |
| `cat /etc/passwd`                                                                                                       | allow                              | **deny**                                                                                        |
| `tee /tmp/notes`                                                                                                        | allow                              | **deny** (outside the zone)                                                                     |
| `/opt/homebrew/bin/biome check .` (absolute binary path)                                                                | allow                              | **deny** (PATH rule)                                                                            |
| `cat file 2>/dev/null`                                                                                                  | allow                              | allow (safe-device exemption)                                                                   |
| `rm -rf ~/` / `rm -rf /`                                                                                                | allow                              | **deny**                                                                                        |
| `curl https://x`, `wget …`, `env curl …`, `ssh h`, `ping x` — any §7.3 network command, any flags                       | allow                              | **deny** (network blanket; reason redirects to MCP/manual channels)                             |
| `sudo ls`, `env sudo tee /etc/motd x`                                                                                   | allow                              | **deny** (sudo blanket rule)                                                                    |
| `:(){ :\|:& };:`, `_(){ _\|_& };_`, `a(){ b& }; b(){ a& }; a`, `function fb { … }` — any inline function, any signature | allow                              | **deny** (no-inline-scripts: AST-typed `Function` nodes)                                        |
| `tee ~/Movies/clip.mp4`, `rm ~/Desktop/notes.txt`, `cp x ~/Downloads/`                                                  | allow                              | **deny** (macOS personal folders)                                                               |
| `cat ~/Documents/report.pdf`, `ls ~/Downloads`                                                                          | allow                              | allow                                                                                           |
| `cat ~/Library/Keychains/login.keychain`                                                                                | allow                              | **deny** (~/Library)                                                                            |
| `cat /ETC/PASSWD`, `tee /System/Volumes/Data/private/tmp/x`                                                             | allow                              | **deny** (boundary is case- and firmlink-robust); the `/tmp` spelling carries the `./tmp/` hint |
| `echo foo=/etc` (prose `=`-mention)                                                                                     | allow                              | allow                                                                                           |
| `Read ~/.claude/settings.json`, `Edit` of it                                                                            | allow (unguarded channel)          | **deny**                                                                                        |
| `Read /var/log/x` (tool channel, outside zone)                                                                          | allow                              | **deny** (boundary, shared logic)                                                               |
| `tee .git/hooks/pre-commit` / Write into `.git/hooks/`                                                                  | allow                              | **deny**                                                                                        |
| Authoring `.claude/skills/…`, `.claude/rules/…`                                                                         | allow                              | allow                                                                                           |

## 9. Error handling

Unchanged fail-open posture: unparseable command → null; any policy throw
→ catch in `runHook` → allow. A broken guard must not break Bash or file
tools.

## 10. Testing

- `tests/fixtures/filesystem.ts` → `{ DENY, ASK, ALLOW }` (fixtures are
  own data; the reference corpus is not copied — see
  `tmp/pattern-source.md`).
- `tests/helpers/policy.ts`: `decisionOf(result) → "deny" | "ask" | null`
  next to `reasonOf`.
- New tests: router ask path; tool-channel payloads (`tool_name: "Read"`
  - `file_path`); settings-tier and `.git/config` denies.
- TDD per increment; gates: `bun test`, `tsc -p tsconfig.json --noEmit`,
  `rtk biome check --reporter=concise`, `bun run build-bin`,
  `claude plugin validate .`.
- Live smokes after rebuild: (1) binary fed an ask-case payload via
  redirect file returns `permissionDecision: "ask"`; (2) in-session: an
  ask-class Bash call under `bypassPermissions` shows a permission prompt
  (user observes); (3) `Read` of `/etc/passwd` denied in-session;
  (4) `/reload-plugins --force` picks up the new matcher.

## 11. Considered and deferred

- Score engine (0-100, weights, thresholds) — rejected: calibration
  drift risk over owner absolutes; deny/ask tables are explicit.
- Reference-extras (attack-technique mappings, custom rule files,
  binary-capability tables, shell-specific rule sets) — out of scope
  (full list in `tmp/pattern-source.md`).
- `Grep`/`Glob` tool channel — pattern args, too noisy; revisit if
  needed.
- Guard self-protection (plugin-cache write protection) — revisit
  separately.
- env→network taint — legitimate API-header use breaks.
- **File-based scripts can reach the network** (a python file run as
  `python script.py` may import urllib) — accepted boundary: the guard
  judges commands, not file contents; same trust line as the `./tmp/`
  teaching pattern. Raw-socket evasions via `/dev/tcp` are denied by the
  §7.2 injection substrings in every spelling (substitution, heredoc,
  fd-dup) because the scan runs on the raw command text before any
  expansion.

## 12. Files touched

| File                                                    | Change                                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `packages/cli-hook/src/core/decision.ts`                | + `ask(reason)`                                                                                   |
| `packages/cli-hook/src/core/ast.ts`                     | + `ParsedCommand.functionDefs` (unbash `Function` nodes, every definition form)                   |
| `packages/cli-hook/src/policies/no-inline-scripts.ts`   | + inline-function deny (owns all fork-bomb signatures; reason teaches `./tmp/`)                   |
| `packages/cli-hook/tests/fixtures/no-inline-scripts.ts` | + `FUNCTIONS` fixture table                                                                       |
| `packages/cli-hook/src/core/policy.ts`                  | `PolicyCheckResult` widen; `PolicyContext` + `projectRoot`                                        |
| `packages/cli-hook/src/core/payload.ts`                 | + `filePath` extraction                                                                           |
| `packages/cli-hook/src/run-hook.ts`                     | router order; tool-channel branch; uncomment filesystemPolicy                                     |
| `packages/cli-hook/src/policies/filesystem/`            | full v2 as a module folder: tiers/resolve/reasons/policy (+intents in T3, guards in T4)           |
| `packages/cli-hook/src/policies/git-readonly.ts`        | + deny the `git hook` subcommand entirely (name-based `.git/hooks` run/list, §7.5 companion rule) |
| `packages/cli-hook/tests/fixtures/filesystem.ts`        | DENY/ASK/ALLOW tables                                                                             |
| `packages/cli-hook/tests/filesystem.test.ts`            | restructure + tool-channel tests                                                                  |
| `packages/cli-hook/tests/helpers/policy.ts`             | + `decisionOf`                                                                                    |
| `plugins/security-guard/hooks/hooks.json`               | matcher `Bash\|Read\|Edit\|Write\|NotebookEdit`                                                   |
| `plugins/security-guard/recommended-settings.json`      | ready-to-merge global deny block (§6.1)                                                           |
| `tmp/pattern-source.md` (git-ignored)                   | pattern-source reference; mandatory reading for implementer and reviewer (§2)                     |
| `plugins/security-guard/README.md`                      | document v2 policy set, tool channel, settings layer                                              |

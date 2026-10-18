# security-guard

Mechanical guard for Claude Code. One `PreToolUse` hook (matcher
`^(Bash|Read|Edit|Write|NotebookEdit)$`) pipes the hook payload into the
`claude-code-cli-hook` policy binary (`packages/cli-hook` in this repo).
Bash commands are parsed into an AST and run through four policies in a
fixed order — first decision wins; file-tool calls route through the same
binary and check their literal `file_path` against the filesystem policy
alone:

1. **no-deps** — dependency installs/updates/removals (pip/uv, npm/pnpm/yarn,
   bun, cargo, brew, gem, go, swift, composer, …)
2. **git-readonly** — every git write subcommand (`commit`, `push`, `tag
<name>`, bare `git branch x`, …) plus `git hook <anything>` (reads and
   runs `.git/hooks` entries); only read-only git passes
3. **no-inline-scripts** — inline code execution: interpreter
   `-e`/`-c`/`--eval` (`python -c`, `node -e`, `php -r`, `osascript -e`,
   `deno eval`, clustered flags like `python -uc`), `sh/bash/zsh -c`,
   `eval`, stdin-fed scripts (pipe, heredoc, bare `-`), inline function
   definitions of every form (also covering every fork-bomb signature),
   wrapper-carried (`xargs sh -c`, `find -exec bash -c`, `env`, …); the
   deny reason directs the agent to write the script under `./tmp/` and
   run the file. `sed`/`awk` stay allowed (everyday text processing)
4. **filesystem** (v2) — deny/ask path policy. The allowed zone is
   `$HOME ∪ projectRoot`: ordinary reads AND writes inside it pass, outside
   it both deny (`..`-chains resolve lexically; the `/dev/null` family is
   exempt). Sensitive-path tiers deny regardless of zone: secrets
   (`.env*`, keys, `.ssh`/`.aws`/…), Claude settings files, `.git/config`
   writes, `.git/hooks` at any reference, personal config writes,
   `~/Library`, macOS personal folders' writes; reading the home directory
   as a whole asks. On top of the zone: network commands deny outright
   (`curl`, `wget`, `nc`, `ssh`, `scp`, `sftp`, `ping`, `dig`, `host`,
   `nslookup`, `whois`, `openssl` — pages/docs go through the web MCP
   tools), injection/obfuscation signals deny (`/dev/tcp`, `LD_PRELOAD`,
   `PATH=` override, history tampering, control characters), absolute
   binary paths deny (the PATH rule), `sudo` denies outright.

A violation denies the call with a `permissionDecisionReason` naming the
policy; whole-home reads surface a permission prompt (ask). Everything
else — non-matching tools, benign commands, malformed payloads, and any
internal error — **fails open** (silent allow): a broken guard must never
brick tool usage.

Pattern provenance and the module map live in `tmp/pattern-source.md`
(git-ignored) at the repository root.

## Prerequisite (build the binary)

The plugin wires the connection; it does not build the binary. Build it from
this repo:

```bash
cd packages/cli-hook && bun run build-bin
```

That compiles `src/main.ts` into `~/.local/bin/claude-code-cli-hook`
(bun-darwin-arm64 bytecode, sourcemap linked). The hook invokes it **by
name**, so `~/.local/bin` must be on `PATH` (verify with
`command -v claude-code-cli-hook`). If the binary is missing, the hook fails
non-blockingly and Bash calls proceed unguarded.

## Runtime contract of the binary (hard-won lessons)

- stdin carries the hook JSON; the decision JSON goes to **stdout** (exit 0);
  no output means allow. Diagnostics go to **stderr only** — stdout is
  protocol.
- **Never gate the stdin read on `Bun.stdin.exists()`**: that call is
  interactive-TTY detection and returns false in the hook context (payload
  piped, then closed) — it once made the binary exit before any policy,
  silently allowing everything (fixed 2026-10-08).
- After changing `main.ts` or policies, **rebuild** (`bun run build-bin`) —
  the hook runs the compiled binary, not the source.

## Lifecycle notes

- A plugin's hooks attach at **session start**. Enabling the plugin
  mid-session does not wire its `PreToolUse` dispatcher — `/reload-plugins`
  reports a hook count, but the guard only goes live in the next session (or
  a `--force` reload that applies hook changes).
- This plugin replaces the three user-scope `PreToolUse`/`Bash` hooks in
  `~/.claude/settings.json` (`git-readonly.sh`, `no-deps.sh`, the Bash
  `deny.sh` entry) — the binary is their consolidated port. Remove those
  entries once this plugin is enabled. The `WebSearch|WebFetch` deny hook is
  a different policy and stays where it is.

## Recommended global settings (defense in depth)

Plugins cannot ship permission rules: in a plugin's `settings.json` only the
`agent` and `subagentStatusLine` keys take effect, and permission rules live
solely in settings files (managed > user > project > local; a deny at any
level wins). `recommended-settings.json` in this folder is a ready-to-merge
`permissions` block for `~/.claude/settings.json` covering the same
sensitive-path families the hook enforces (secrets, system files, Claude
settings, git internals) plus the `Bash(git hook:*)` prefix. The two layers
complement each other: settings rules are exact-pattern matches that apply
even when the plugin is not loaded; the hook adds the semantic layer
(intents, scope analysis, pipeline taint, the ask tier) that path patterns
cannot express. Keep both. Syntax note: rules must use the documented
tool-rule form (`"Read(**/.env*)"` inside `permissions.deny`) — the object
form `permissions: { read: { deny: [...] } }` is not a real setting and
does not enforce (anthropics/claude-code#24846).

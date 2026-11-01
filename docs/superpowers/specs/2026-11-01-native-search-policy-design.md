# Native-search policy — design spec

Date: 2026-11-01
Status: approved design (owner), pending plan
Package: `@cc-sdd/claude-code-cli-hook` + `plugins/security-guard` wiring

## Context

Agents grep and find through Bash although the harness ships native Grep and
Glob tools. Bash search bypasses the native-tool path (no zone checking, no
structured output) and is slower. Today the tool channel gates only
Read/Edit/Write/NotebookEdit (`run-hook.ts`), so the native Grep and Glob
tools are entirely ungated; and the security-guard hook matcher never fires
for them, so no policy could see them even if routed.

## Goals

1. Deny Bash `grep`, `egrep`, `fgrep`, `find` — any pipeline position — with
   a teaching reason pointing at the native Grep/Glob tools.
2. `rg` (ripgrep) stays allowed as the sanctioned CLI fallback — while its
   path arguments remain fully subject to filesystemPolicy (zone boundaries,
   secrets/settings tiers), exactly like any other read command. The
   fallback must not become an evasion hole.
3. Route the native Grep and Glob tools through the same filesystem rules as
   Read: zone boundaries, secrets/settings tiers, boundary reasons.
4. Wire the plugin hook so Grep and Glob invocations actually reach the
   binary.

## Design

### Component 1 — `src/policies/native-search.ts` (new)

- `BANNED = new Set(["grep", "egrep", "fgrep", "find"])`.
- `check` via `firstUnitHit`: any unit whose lowercased name is in `BANNED`
  denies — this covers pipeline stages (`cat x | grep y`) and process
  filtering (`ps aux | grep node`, accepted compromise: the ban is total).
- Reason (exact text):

  `Bash grep/find blocked (native-search policy): use the built-in Grep and Glob tools instead — they are faster and zone-checked. ripgrep (rg) stays allowed as the CLI fallback.`

- Policy order in `run-hook.ts` `POLICIES`:
  `[noDeps, gitReadonly, noInlineScripts, nativeSearch, filesystem]` — the
  native-search reason wins over the filesystem reason on conflicting
  commands (e.g. `grep /etc/passwd` teaches the tool, not the zone).

### Component 2 — tool-channel routing (`src/run-hook.ts`)

- `SEARCH_TOOLS = new Set(["Grep", "Glob"])`.
- `routeSearchTool(payload) = checkFilePath(payload.filePath, "read", ctx)`
  — literally the same rules, tiers, and reason texts as the Read tool.
- Absent `path` param → allow. Probe-verified (2026-11-01, live hook dump):
  the harness sends NO `path` key at all when the model omits it — not the
  project root, not the cwd, not empty. The tool's effective default root is
  unobservable from the hook; the allow rests on the harness contract that a
  path-less search runs inside the session working tree (in-zone by
  construction), which the guard trusts because it cannot verify it.
- A given `path` stays RELATIVE and unresolved in the payload
  (`"packages/cli-hook"`, not absolute). `checkFilePath` → `expandToken`
  resolves it against the payload `cwd` — the same root the tool itself
  uses, so the policy judges the exact scope the tool searches.

### Component 3 — payload (`src/core/payload.ts`)

- `stringField(data, "file_path", "notebook_path", "path")` — Grep and Glob
  send their scope as `path`, not `file_path`; the existing multi-key
  pattern absorbs it with no new plumbing.

### Component 4 — plugin wiring (`plugins/security-guard/hooks/hooks.json`)

- Matcher: `^(Bash|Read|Edit|Write|NotebookEdit|Grep|Glob)$`.
- Update the `description` field to name Grep/Glob routing.
- Without this the policies never fire for the search tools.

## Behavior matrix

| Input | Verdict |
| --- | --- |
| Bash unit `grep`/`egrep`/`fgrep`/`find` (any position) | DENY, native-search reason |
| Bash `rg pattern src/` (in-zone path or cwd-relative) | allow |
| Bash `rg pattern /etc/passwd` (out of zone) | deny, boundary reason (filesystemPolicy) |
| Bash `rg pattern ~/.ssh/id_rsa` (secrets tier) | deny, tier reason (filesystemPolicy) |
| Grep/Glob tool, `path` inside zone, no tier | allow |
| Grep/Glob tool, `path` hits secrets/settings tier | deny, tier reason |
| Grep/Glob tool, `path` outside zone | deny, boundary reason |
| Grep/Glob tool without `path` | allow |

## Testing

- New `tests/fixtures/native-search.ts` (DENY/ALLOW tables) and
  `native-search.test.ts`: deny rows for all four names, pipe and
  `ps aux | grep node` compromise pins; allow rows for `rg`.
- filesystem fixtures gain the rg-sanction pins: `rg pattern /etc/passwd`
  (deny, boundary), `rg pattern ~/.ssh/id_rsa` (deny, secrets tier),
  `rg pattern src/` (allow) — the fallback's paths are zone- and
  tier-checked by contract, not by coincidence.
- `run-hook.test.ts` tool-channel additions: Grep→`/etc/passwd` deny,
  Grep→`/proj/src` allow, Grep without `path` allow, Glob→`~/Library/x`
  deny (macos-library tier), payload `path` key extraction.
- Standard gates: full `bun test` (586+ new), `rtk proxy biome check`,
  `build-bin`, `claude plugin validate .` (hooks.json changed), bench suite
  must not regress (`bench/equiv.ts` self-check green).

## Non-goals

- `rg` restriction (explicitly allowed, per owner).
- Any change to `ls`, `cat`, or other read commands' Bash handling.
- Structured-output enforcement for the native tools.

## Rollout

Single commit-set: policy + routing + payload + matcher + tests. The binary
is rebuilt (`build-bin`) and picked up by the hook on the next tool call;
no migration, no config versioning.

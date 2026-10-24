# cli-hook memory-ask policy — design

- **Date:** 2026-10-24
- **Package:** `packages/cli-hook`
- **Status:** design approved in chat; awaiting owner review and commit
- **Predecessor:** `2026-10-15-filesystem-policy-v2-design.md`

## Motivation

Claude Code's project memory lives at `~/.claude/projects/<slug>/memory/` and is
written with ordinary `Write`/`Edit` tool calls — there is no dedicated memory
tool. The filesystem policy treats everything under `$HOME` as the allowed zone
and assigns the `.claude/projects/` subtree no tier, so memory saves reach disk
silently today. The owner wants every memory write to surface as a permission
question each time: **ask, not deny**.

The hook engine already supports this: `ask(reason)` exists in
`core/decision.ts` (used today for whole-home reads), and the security-guard
plugin already routes `Bash|Read|Edit|Write|NotebookEdit` through the binary —
no wiring changes are needed.

## Goal / Non-goals

**Goal:** every mutation of project memory — write, edit, delete, any target
inside the memory tree (a `.md` file, a non-`.md` file, or the directory
itself) — returns `permissionDecision: "ask"`, from **both** routing paths of
the binary (file tools and Bash command analysis). The owner decides each
time; nothing in the memory tree is auto-denied. The `.md`-only convention
surfaces in the ask reason for non-`.md` targets so the owner can reject it at
the prompt. Reads stay free.

**Non-goals:** global memory (`~/.claude/CLAUDE.md`); project `CLAUDE.md` and
`.claude/rules/` (already visible in git diffs); deny semantics for memory;
per-session or persistent allow-lists; deriving the current project's slug.

## Path semantics

A path is **project memory** when, as an absolute path, it starts with
`<HOME>/.claude/projects/` and the second segment of the remainder is exactly
`memory` — i.e. `<slug>/memory` or `<slug>/memory/<file...>`. The slug contains
no `/` (it is a dash-joined project path), so this boundary is exact:
`memory-backup/`, `memoryx`, or a sibling like `transcripts/` do not match.

The match covers **any** project's memory, not just the current one — the
policy then does not depend on Claude Code's slugification rule.

All token forms normalize before the check: `~/...`, `$HOME/...`,
`${HOME}/...`, and absolute paths go through `expandToken` (already the first
step of both routes); relative paths resolve against `cwd` first and therefore
cannot reach the memory tree unless `cwd` is inside it.

### Targets and reason wording

Every mutation under the memory root asks, regardless of file type. The
resolved basename only selects the wording of the reason:

- target is exactly `<slug>/memory` (the directory itself, e.g. `mkdir`), or
  under it with a basename ending `.md` (exact lowercase; `.MD`,
  `foo.md.txt`, or an extension-less name do not match) → `Filesystem policy:
  "<token>" modifies project memory — confirmation required.`
- any other basename (extension-less, `.txt`, `.json`, `.MD`) → `Filesystem
  policy: "<token>" modifies project memory (non-.md file — memory accepts
  .md only) — confirmation required.`

Both outcomes are `ask` — the `.md`-only convention is the owner's call at
the prompt, not a policy deny.

## Integration points

Two routes, both must be covered — closing only the file-tool route would make
Bash a silent bypass.

1. **`checkFilePath`** (file tools: `Write`/`Edit`/`NotebookEdit`): after
   `expandToken`, before tier logic — `intent === "write"` and
   `isProjectMemoryPath(abs)` → `ask(reason)`. File tools carry no delete
   intent.
2. **`scopedDecision`** (Bash route, including redirection targets): after the
   allowed-zone check passes — `intent === "write" || intent === "delete"` and
   `isProjectMemoryPath(abs)` → `ask(reason)`. Catches `echo >`, `tee`, `cp`,
   `mv`, `rm`, and redirect targets, which all funnel through
   `candidateDecision → scopedDecision`.

Deny precedence is unchanged: `severityUnion` prefers deny over ask, so a
command touching both memory and a deny-tier path still denies.

### Bash mutation coverage

The Bash route already evaluates every path candidate of every argument plus
all redirect targets, and the intent table maps the common mutators:
`cp mv tee touch mkdir dd rsync install ln tar truncate chmod chown` → write,
`rm rmdir shred unlink` → delete; wrappers (`sudo env nice nohup timeout
xargs`) unwrap to the real command. Three gaps found during design review
close inside `intents.ts` and the memory check:

1. `find` is classified `read`, so `-delete` mutates silently — `find` with a
   `-delete` flag SHALL resolve to delete intent (plain `find` stays read).
2. `sed` and `perl` are absent from the table — with `-i` (in-place) they
   mutate: a `-i` flag SHALL classify them as write; without it they stay
   read-intent (stdout only).
3. Unknown binaries carry null intent, so an unmapped mutator mentioning a
   memory path would slip through — for memory paths the default inverts:
   **null intent asks too**; only a known read intent stays free.

Residual, documented: MCP tools (`mcp__*`) are not routed through the binary
(matcher covers the five core tools) — if a concrete MCP writer into local
paths appears, extending the matcher and payload parsing is a follow-up.

### Wrapper-set drift and sudo pins

The sudo ban is implemented (`unitDecision` denies on the sudo flag, wrapper
unwrapping propagates it; inline scripts carrying sudo are denied outright by
the no-inline-scripts policy). Design review found two defects around it:

- the two `WRAPPERS` constants have drifted: `intents.ts` lacks `time` and
  `parallel`. (Design-stage correction, verified empirically during Task 4:
  `time` is stripped as a prefix by the AST parser, so `time sudo <cmd>`
  already denies via the stripped `sudo` unit; the actual bypass was
  `parallel sudo <cmd>` only. The shared set still lands as specified —
  `time`/`sudo` entries are uniformity, `parallel` is the fix.) The sets
  SHALL be unified into one shared source consumed by both modules.
- the sudo ban has zero test pins. Tests SHALL pin `sudo rm x`, `xargs sudo
  rm x`, `time sudo rm x`, and `parallel sudo rm x` to `deny` with the sudo
  reason.

New code: `policies/filesystem/memory.ts` exporting the predicate; a
`memoryReason(token, isMd)` helper beside the others in `reasons.ts` whose
two wordings are pinned in "Targets and reason wording" above.

## Requirements

- **R1** When a `Write`, `Edit`, or `NotebookEdit` call targets the memory
  directory or anything under it, regardless of file type, the hook SHALL
  return `ask`.
- **R2** When a Bash command or its redirection has write or delete intent
  targeting the memory directory or anything under it, the hook SHALL return
  `ask`.
- **R3** Read intent to memory paths SHALL return `null` (silently allowed).
- **R4** Paths under `~/.claude/projects/` outside a memory directory SHALL
  behave exactly as before the change.
- **R5** A deny hit elsewhere in the same Bash command SHALL take precedence
  over the memory ask.
- **R6** `find` with a `-delete` flag SHALL resolve to delete intent, and
  `sed`/`perl` with `-i` SHALL resolve to write intent, for memory-path
  evaluation (and consistently for the rest of the policy).
- **R7** A Bash command of an unknown binary (null intent) whose argument is
  a memory path SHALL return `ask`; known read intent SHALL NOT.
- **R8** `hooks.json`, plugin wiring, and the four existing policies SHALL be
  unchanged apart from the `intents.ts` refinements of R6.
- **R9** A Bash unit running under `sudo` — directly, or behind any wrapper
  including `time` and `parallel` — SHALL return `deny` with the sudo reason;
  the two `WRAPPERS` constants SHALL be one shared set.

## Testing

TDD, RED first; matrix in `tests/filesystem.test.ts` (fixtures alongside
existing ones):

- file tools: `ask` for Write/Edit to
  `<HOME>/.claude/projects/-proj-x/memory/fact.md` — via `~/`, `$HOME/`,
  `${HOME}/`, and absolute forms; `ask` when the target is exactly
  `.../memory`; `ask` for non-`.md` targets (`fact.txt`, `noext`, `note.MD`)
  — with the non-`.md` reason wording; `null` for a Read of the same paths.
- Bash: `ask` for `echo x > ~/.../memory/n.md`, `rm ~/.../memory/n.md`,
  `mv f ~/.../memory/n.md`, `cp f ~/.../memory/n.md`,
  `cp f.txt ~/.../memory/f.txt`, and `rm ~/.../memory/stray.bin`;
  `null` for `cat` of the same.
- Bash, gap closures: `ask` for `sed -i 's/a/b/' ~/.../memory/f.md`,
  `find ~/.../memory -name '*.md' -delete`, and an unknown binary
  `unknowntool ~/.../memory/f.md`; `null` for `sed 's/a/b/'
  ~/.../memory/f.md` (no `-i`) and plain
  `find ~/.../memory -name '*.md'` (no `-delete`).
- negatives: `~/.claude/projects/-proj-x/transcripts/t.jsonl` → unchanged;
  `~/.claude/projects/-proj-x/memory-backup/f.md` → unchanged.
- precedence: a command combining a memory write with a deny-tier argument →
  `deny`.
- sudo pins: `deny` for `sudo rm -rf /tmp/x`, `xargs sudo rm x`,
  `time sudo rm x`, `parallel sudo rm x` — the sudo reason, not a filesystem
  one.

## Verification and rollout

Gates: `bun test` (package, then repo root), `rtk proxy biome check
packages/cli-hook --write` then a clean re-run, `bun check --strict`, rebuild
the `claude-code-cli-hook` binary. Command hooks exec fresh on every tool
call, so the rebuilt binary applies to the next tool call — no session restart,
no hooks reload.

House rules apply: zero comments in source, biome preset "all", the human
commits at stop points, no dependency changes.

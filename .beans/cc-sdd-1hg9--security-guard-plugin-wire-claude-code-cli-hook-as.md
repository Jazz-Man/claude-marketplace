---
# cc-sdd-1hg9
title: "security-guard plugin: wire claude-code-cli-hook as PreToolUse hook"
status: completed
type: feature
priority: normal
created_at: 2026-10-08T13:02:15Z
updated_at: 2026-10-08T14:16:50Z
---

Plugin plugins/security-guard wiring the claude-code-cli-hook binary (~/.local/bin, built from packages/cli-hook via bun run build-bin) as PreToolUse/Bash hook. Three policies: filesystem, no-deps, git-readonly; fail-open; first-decision-wins order. User decisions: invoke by name from PATH; user removes old settings.json hooks themselves. WebSearch/WebFetch hook out of scope.

## Root cause + fix (systematic debugging, 2026-10-08)

- SYMPTOM: probes executed unguarded despite 11-hooks reload count.
- INSTRUMENTATION: hook command wrapped with tee+rc logging to tmp/hook-stdin.log (evidence at the CC->hook boundary).
- EVIDENCE A (this session, plugin enabled mid-session): LOG ABSENT on every probe -> hook process never spawned.
- EVIDENCE B (fresh claude -p, no --plugin-dir, user-scope install): LOG PRESENT - real CC payload (session_id, effort, tool_use_id, tool_input.description extras) + rc=0 on allow.
- EVIDENCE C (replay of the real payload shape + forbidden command into the binary): deny JSON, rc=0.
- ROOT CAUSE: plugin enabled mid-session; PreToolUse dispatcher wires at session START only - /reload-plugins updates the hook count but does not attach the dispatcher (consistent with docs: hooks load at session start, changes require restart). The plugin itself is correct.
- SECONDARY: earlier -p flakiness involved --plugin-dir pointing at the same plugin that is also installed (name-conflict precedence path) - [Inference] that mode drops the hook; fresh sessions without --plugin-dir work.
- FIX NEEDED IN PLUGIN: none. Instrumentation reverted to the absolute-path command (user-set). User's next full session restart activates the guard; old .sh hooks remain active meanwhile.

## Validation

- Fresh-session allow-path via hook (real payload, rc=0); real-payload-shape replay deny JSON rc=0; chain 1+2+3 closed (CC honoring this deny shape proven all day by old .sh hooks).
- json OK, biome clean, claude plugin validate PASS.

## Rework (user decision, 2026-10-08)

- build.ts rewritten: outfile -> plugins/security-guard/bin/claude-code-cli-hook (mkdir -p, import.meta.dir-relative, no ~/.local/bin). Binary rebuilt in place; allow+deny probes green via direct invocation.
- hooks.json: command -> \"\${CLAUDE_PLUGIN_ROOT:?unset}/bin/claude-code-cli-hook\" (exact sdd-proven shell form, direct binary). guard.sh wrapper removed (superseded).
- .gitignore: plugins/security-guard/bin/ (62MB per-machine artifact). README updated.
- Pending: /reload-plugins --force by user, then acceptance probe (bun install --dry-run must DENY).

## ACCEPTANCE PASSED (2026-10-08 17:10)

- In-session live: bun install -> DENIED by plugin hook (no-deps reason, PreToolUse:Bash hook error); benign echo -> allowed. Full chain live in interactive session: dispatcher -> plugin hook -> plugin bin/ binary -> policies -> deny JSON -> CC block.
- Working config (user-final): binary built INTO plugins/security-guard/bin/ (build.ts rewritten: import.meta.dir-relative, sourcemap linked, timeout 30 in hook); command "\${CLAUDE_PLUGIN_ROOT:?unset}/bin/claude-code-cli-hook"; matcher Bash. No PATH dependency, no wrapper.
- Earlier non-firing attributed to mid-session enablement (dispatcher wires at session start; reload counts are cosmetic) - documented in memory.

## Root-cause correction (user-found, final)

The DEEPEST cause: Bun.stdin.exists() in main.ts prologue - interactive-TTY detection returning false in hook context -> silent process.exit() before any policy -> silent allow in EVERY live spawn (including yesterday's -p rc=0 'allow'). Direct echo|binary terminal tests passed because TTY semantics differ there. User removed the check + made catch log to stderr. The dispatcher/session-start layer I proved earlier was real (absent-log spawns) but secondary; two stacked fail-open modes shared one symptom. Memory updated with both lessons.

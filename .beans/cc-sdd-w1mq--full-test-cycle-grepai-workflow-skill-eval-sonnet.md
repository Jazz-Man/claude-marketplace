---
# cc-sdd-w1mq
title: 'Full test cycle: grepai-workflow skill eval (sonnet)'
status: completed
type: task
priority: normal
created_at: 2026-11-21T15:31:45Z
updated_at: 2026-11-21T15:51:26Z
---

skill-creator full cycle on plugins/grepai/skills/grepai-workflow. Eval: lsp-proxy diagnostics pipeline research (read-only), agents on sonnet per user directive (if sonnet handles it, stronger models will). Success metric: fewer bash calls, grepai+LSP usage instead. A/B: with_skill vs without_skill.

## Summary of Changes

Two-iteration skill-creator cycle completed. Iteration-1: with_skill 66.7% vs baseline 50% (bash 8, LSP 0, grepai 12) — skill added discovery layer but did not displace bash habits; transcript forensics identified 3 gaps (A: file-inventory had no grepai route -> find reflex; B: elastic exact-string carve-out licensed redundant sweeps; C: LSP never ToolSearch-loaded). Fixes applied to SKILL.md: rpg kinds:'file' inventory row in synergy table + dispatch contract, re-verification redundancy clause in composing flow, LSP-loading line in dispatch contract. Iteration-2: with_skill 100% (6/6) vs baseline 50% — bash 8->4 (sweeps eliminated), LSP 0->2 (findReferences verification), grepai arsenal held (11 calls/5 tools), Read 25->19. validate passes; snapshots in workspace/skill-snapshot. Residual: single find-preamble before skill internalization (gap A partially closed).

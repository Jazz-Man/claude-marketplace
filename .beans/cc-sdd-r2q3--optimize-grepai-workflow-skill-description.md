---
# cc-sdd-r2q3
title: Optimize grepai-workflow skill description
status: completed
type: task
priority: normal
created_at: 2026-10-30T15:52:40Z
updated_at: 2026-10-30T15:59:54Z
---

Rewrite the frontmatter description of plugins/grepai/skills/grepai-workflow/SKILL.md per plugin-dev conventions (third person, concrete trigger phrases), add missing trigger contexts (trace, RPG, tool-name mentions), keep YAML-safe, validate, and probe triggering.

## Summary of Changes

Rewrote the frontmatter description of plugins/grepai/skills/grepai-workflow/SKILL.md per plugin-dev conventions: third-person canonical form, explicit quoted trigger phrases, grepai tool-name mentions (grepai_search/trace/rpg), and the previously missing trigger contexts (call structure without LSP, RPG feature orientation). Kept YAML-safe (no colon-space in the scalar). claude plugin validate . passed (pre-existing README install-line advisory, non-blocking). Trigger probes 4/4: setup, pre-build exists-check, intent+feature question all -> grepai-workflow first (two probes spontaneously reproduced the discovers/verifies split); negative probe (exact symbol, LSP present) -> lsp-code-analysis, citing the new description's exclusion clauses.

## Compression pass (same day)

Compressed the description 692 -> 527 chars (-24%) by cutting boilerplate only: four setup quotes -> one + nouns, one NL example instead of two, dropped the 'Covers setup, query craft, token economy...' tail (content inventory, not a trigger condition) keeping only the split sentence. Both exclusion clauses, tool names, quoted anchors, and all seven trigger contexts preserved. claude plugin validate . passed. Re-ran the same 4 probes on the compressed text: 4/4, outcomes and reasoning quality identical to the full version (negative probe again cited the exclusion clauses).

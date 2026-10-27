---
# cc-sdd-euc2
title: Optimize lsp-code-analysis skill from eval feedback
status: completed
type: task
priority: normal
created_at: 2026-10-27T20:14:21Z
updated_at: 2026-10-27T21:10:47Z
parent: cc-sdd-hi1x
---

Iteration-2 of the skill-creator loop: apply user feedback (one-shot select:LSP tool loading; locate-before-reading instead of whole-file reads) and analyst findings (findReferences reconciliation-as-stop; hover alias resolution) to plugins/lsp-proxy/skills/lsp-code-analysis/SKILL.md, then rerun the 3 evals with_skill vs old_skill snapshot.

## Summary of Changes

Iteration-2 body edits (from user feedback + analyst pass): 'Getting the LSP tool' (one select: ToolSearch load), 'Locate before reading' (documentSymbol/scoped-grep before any Read; offset/limit reads; no ls/find path pre-checks), findReferences reconciliation-as-stop, hover (alias) resolution rule, dynamic-dispatch blindness note (string callbacks), External packages section generalized beyond node_modules/.d.ts (vendor/, cargo cache, site-packages as examples). Description rewritten (stale availability claim removed, trigger phrases added). Validation: i2 benchmark with_skill 100% vs old_skill 100% (correctness parity), clean A/B on eval-1 tokens 63.2k->38.5k (-39%), time 223s->111s (-50%), calls 29->9. Trigger probes (claude -p, new description): 3/3 — two code questions pulled the skill and used LSP-first (one with documented fallback after the workspaceSymbol quirk), one markdown text-search question correctly did NOT trigger it. allowed-tools frontmatter tested: does NOT preload deferred tools (negative experiment). claude plugin validate . passes.

---
# cc-sdd-21d2
title: Move lsp-code-analysis skill into plugins/lsp-proxy
status: completed
type: task
priority: normal
created_at: 2026-10-27T19:24:31Z
updated_at: 2026-10-27T19:24:44Z
parent: cc-sdd-hi1x
---

Migrate the global ~/.claude/skills/lsp-code-analysis skill verbatim into plugins/lsp-proxy/skills/ as a plugin skill. Content unchanged; optimization deferred to a later pass.

## Summary of Changes

Copied ~/.claude/skills/lsp-code-analysis/SKILL.md byte-identical (cmp OK) to plugins/lsp-proxy/skills/lsp-code-analysis/SKILL.md — the plugin's first skill. `claude plugin validate .` passes (two pre-existing README install-line advisories for lsp-proxy/security-guard remain, unrelated). Optimization pass deferred by user; global copy removal is the user's action (outside repo).

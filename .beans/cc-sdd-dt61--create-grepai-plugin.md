---
# cc-sdd-dt61
title: Create grepai plugin
status: completed
type: task
priority: normal
created_at: 2026-10-28T14:51:27Z
updated_at: 2026-10-28T14:52:29Z
---

Personal grepai plugin in the cc-sdd marketplace: MCP server (grepai mcp-serve) + one self-sufficient grepai-workflow skill (per-project setup with ignore/.grepaiignore curation and boost; intent-shaped search; LSP synergy matrix). Built per the prompt-optimize artifact from this session.

## Summary of Changes

Created plugins/grepai: plugin.json (name grepai v0.1.0), .mcp.json (grepai-api -> grepai mcp-serve, args-first per biome useSortedKeys), skills/grepai-workflow/SKILL.md (self-sufficient: setup mission with ignore-defaults/replaces rule, .grepaiignore curation incl. any-depth negation semantics and sub-path re-exclusion, boost reorder-only mechanics, Rust/Go global-cache honesty; search mission with mandatory already-exists pre-check; LSP synergy matrix with discover->verify->bounded-read flow), README, marketplace entry (description de-enumerated to churn-proof form). claude plugin validate . passes (README install-line advisory consistent with siblings).

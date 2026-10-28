---
# cc-sdd-dt61
title: Create grepai plugin
status: completed
type: task
priority: normal
created_at: 2026-10-28T14:51:27Z
updated_at: 2026-10-28T23:04:43Z
---

Personal grepai plugin in the cc-sdd marketplace: MCP server (grepai mcp-serve) + one self-sufficient grepai-workflow skill (per-project setup with ignore/.grepaiignore curation and boost; intent-shaped search; LSP synergy matrix). Built per the prompt-optimize artifact from this session.

## Summary of Changes

Created plugins/grepai: plugin.json (name grepai v0.1.0), .mcp.json (grepai-api -> grepai mcp-serve, args-first per biome useSortedKeys), skills/grepai-workflow/SKILL.md (self-sufficient: setup mission with ignore-defaults/replaces rule, .grepaiignore curation incl. any-depth negation semantics and sub-path re-exclusion, boost reorder-only mechanics, Rust/Go global-cache honesty; search mission with mandatory already-exists pre-check; LSP synergy matrix with discover->verify->bounded-read flow), README, marketplace entry (description de-enumerated to churn-proof form). claude plugin validate . passes (README install-line advisory consistent with siblings).

## Install fix (2026-10-29)

Plugin failed to install ('1 plugin failed to update'). Diagnosis by elimination: validate green, binary on PATH, mcp-serve boots from any cwd without config, siblings installed fine — root cause: MCP server NAME COLLISION between the plugin's 'grepai-api' and the project-root .mcp.json entry. Renamed the plugin server to unique 'grepai' (.mcp.json + README). Installed successfully on retry; tools live as mcp__plugin_grepai_grepai__*, skill registered as grepai:grepai-workflow.

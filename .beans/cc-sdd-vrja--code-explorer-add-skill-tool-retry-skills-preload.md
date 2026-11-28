---
# cc-sdd-vrja
title: 'code-explorer: add Skill tool, retry skills preload'
status: completed
type: task
priority: normal
created_at: 2026-11-24T11:02:09Z
updated_at: 2026-11-24T14:20:49Z
---

Add the Skill tool to .claude/agents/code-explorer.md and retry the skills: preload (plugin:skill names first, bare names second). Verify from the subagent transcript whether the skill text was present before any Read/Skill call, and which model it ran on.

## Summary of Changes

`.claude/agents/code-explorer.md`: `tools: Read, LSP, ToolSearch, Skill, SendMessage, mcp__plugin_grepai_grepai__*`; no `skills:` field. The prompt tells the agent to invoke `grepai:grepai-workflow` and `lsp-proxy:lsp-code-analysis` with the `Skill` tool before its first search, to load the 14 grepai tools in one `ToolSearch` call with `max_results` 20 (the default of 5 would leave nine unloaded), and to deliver each report with `SendMessage` to the conversation that gave it the task, as the roster names it, as well as return it as the final answer.

## Validation

- Preload through `skills:` never injected the skill text in this session, in four variants: `plugin:skill` names and bare names, each without and with the `Skill` tool in the list.
- With the `Skill`-tool instruction the subagent transcript shows the first two calls as `Skill(grepai:grepai-workflow)` and `Skill(lsp-proxy:lsp-code-analysis)`, then `ToolSearch`; 14 of 14 grepai tools loaded; the lookup (callers of `dependencyMemoryFiles`, feature area of `buildConfig`) came back correct and LSP-verified; the report arrived as a complete `SendMessage` to `team-lead`.
- Model: still glm-5.4 on every response — `model: sonnet` in the frontmatter is not applied in this session; passing `model: sonnet` on the Agent call gives glm-5.3-flash.

## Notes

- In the same session `omitClaudeMd: true` also looked ineffective: one run reported CLAUDE.md files and rules in its context. Not established why frontmatter `model`, `omitClaudeMd` and `skills` are ignored here while `tools` is applied.
- grepai observations from the runs (owner's own tool): `grepai_trace_callers` and `grepai_rpg_search` return nothing for `dependencyMemoryFiles` while the neighbour `pathsToRules` from the same file is in the graph; `grepai_refs_*` returned empty for `injectHosts` and `mode`; `grepai_list_projects` needs a `workspace` parameter. LSP `workspaceSymbol` returned no symbols for both names while `documentSymbol`, `goToDefinition` and `findReferences` work.
- `.claude/hooks/code-explorer-rg-only.sh` (never wired) and `.claude/agents/glob-grep-test.md` are still in the project; the first cannot be removed from the sandbox.

## Follow-up — after a session restart

- In a freshly started session the frontmatter model applies: `model: sonnet` ran the agent on glm-5.3-flash (26 responses in the transcript). The earlier failures belonged to the session where the agent definition had been hot-loaded.
- `ENABLE_TOOL_SEARCH=true` (owner's `env` block) changes nothing for the agent, as the documentation says (`true` behaves like unset): at start it has only `Read`, `ToolSearch` and `Skill`; the 14 grepai tools, `LSP` and `SendMessage` are deferred and are loaded by the agent itself.
- Agent prompt updated: `LSP` and `SendMessage` joined the single loading `ToolSearch` call (16 names, `max_results` 20), and the call is skipped when the schemas are already present. Verified in a separate run: 16 of 16 loaded in one call, `LSP documentSymbol` returned 38 symbols, the report arrived through `SendMessage`.
- `omitClaudeMd` remains unestablished.

## Follow-up — ENABLE_TOOL_SEARCH=auto

- With `auto` (fresh session) the subagent has no `ToolSearch`, although the agent lists it; `LSP` and `SendMessage` carry their schemas from the start; the 14 grepai tools are not in its function list but are callable by exact name. The main conversation keeps `ToolSearch` and can also call MCP tools without loading.
- The agent's loading step assumed `ToolSearch` exists, so one run stumbled three times (two repeated Skill invocations and an `Unknown skill: select:…` error). The step now has two branches — load the missing schemas when `ToolSearch` is present, otherwise call the grepai tools directly and correct arguments from a rejected call's error.
- Re-verified after the change: Skill ×2, then direct grepai calls with no loading and no error; the lookup (callers of `dependencyMemoryFiles`, its feature area) came back with LSP evidence; model glm-5.3-flash; report delivered through SendMessage. Not exercised again in this mode: the `ToolSearch` branch (it was verified under `true`).

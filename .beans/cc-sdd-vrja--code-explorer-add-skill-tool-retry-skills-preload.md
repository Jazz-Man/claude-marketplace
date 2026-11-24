---
# cc-sdd-vrja
title: 'code-explorer: add Skill tool, retry skills preload'
status: completed
type: task
priority: normal
created_at: 2026-11-24T11:02:09Z
updated_at: 2026-11-24T11:16:08Z
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

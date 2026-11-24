---
# cc-sdd-hfhr
title: 'Subagent code-review (working name): ReportFindings + grepai + LSP'
status: todo
type: task
created_at: 2026-11-24T11:25:31Z
updated_at: 2026-11-24T11:25:31Z
---

Create a project-scope subagent under .claude/agents/ (name to be decided later) that reviews code and reports through the ReportFindings tool, using the whole grepai toolset and LSP. Not started: this bean records the request and what the code-explorer work (beans cc-sdd-yv7i, cc-sdd-vrja) already established about subagents in this repository.

## Brief

- Input: what the agent reviews (a diff range, a task, or files) is still to be defined.
- Output: findings delivered with ReportFindings, not as text. Contract from the tool itself and docs/claude/tools-reference.md:42: call it once with the verified findings ranked most-severe first, an empty array when nothing survived verification, and do not also print the findings as text. Fields per finding: file, line, summary, failure_scenario, category, short_summary; verdict CONFIRMED or PLAUSIBLE after verification; outcome only when re-reporting after fixes and the instructions ask for it.
- Research: grepai for discovery (whole toolset), LSP for verification, Read for bounded ranges.
- Survey before building: plugins/sdd/skills/review (adversarial task-local review protocol) and the role prompts under plugins/sdd/skills/impl/templates/ (task-reviewer, re-review, code-reviewer) already define review behavior in this repository; reuse or point to them instead of writing a parallel protocol.

## Notes

Carried over from building .claude/agents/code-explorer.md, to copy as the starting pattern:

- tools: Read, LSP, ToolSearch, SendMessage, mcp__plugin_grepai_grepai__* plus ReportFindings. Glob and Grep are absent on macOS unless listed in tools.
- MCP schemas are deferred: the agent needs ToolSearch, and the 14 grepai tools load in one select call only with max_results 20 (the default of 5 leaves nine unloaded).
- A specifier in tools does not narrow a tool: Bash(rg:*) still gave full Bash. In disallowedTools a specifier removes the whole tool.
- skills: preload never injected the skill text in the session where agents were hot-loaded (plugin:skill names and bare names, with and without the Skill tool). The working path: keep Skill in tools and instruct the agent to invoke grepai:grepai-workflow and lsp-proxy:lsp-code-analysis itself before working.
- Frontmatter model was not applied in that session (model: sonnet still ran on glm-5.4); model: sonnet passed on the Agent call ran on glm-5.3-flash, which is what the sonnet alias resolves to on this machine through ANTHROPIC_DEFAULT_SONNET_MODEL. Re-check in a fresh session before relying on either.
- omitClaudeMd: true looked ineffective in the same session; not established.
- Reports: deliver with SendMessage, addressed as the roster names the lead (team-lead in this setup), and return the same text as the final answer; a long final answer alone arrives cut off.
- grepai gaps seen during those runs: trace and RPG return nothing for dependencyMemoryFiles while its file neighbour pathsToRules is in the graph; refs tools were empty for injectHosts and mode; grepai_list_projects needs a workspace parameter. LSP workspaceSymbol returned no symbols where documentSymbol, goToDefinition and findReferences work.

Open: the agent's name, what it takes as input, its model, and whether the review protocol lives in the agent or stays in the existing sdd review assets.

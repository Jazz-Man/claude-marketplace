---
# cc-sdd-yv7i
title: 'Project subagent code-explorer: Glob, Grep, Read, LSP + grepai MCP'
status: completed
type: task
priority: normal
created_at: 2026-11-24T10:06:30Z
updated_at: 2026-11-24T10:32:04Z
---

Create a project-scope Explore-like subagent (.claude/agents/code-explorer.md) with tools Glob, Grep, Read, LSP and every tool of the grepai plugin MCP server; preloads the grepai-workflow and lsp-code-analysis skills; omitClaudeMd; model inherit. Smoke-test it: tool availability, preloaded skills, one lookup through grepai -> LSP -> Read.

## Summary of Changes

`.claude/agents/code-explorer.md` (project scope): `tools: Read, LSP, ToolSearch, mcp__plugin_grepai_grepai__*`, `model: sonnet`, `omitClaudeMd: true`, no hooks. The body lists all 14 grepai tools by family, has the agent load them all in one `ToolSearch` call at the start of every task, and asks it to check each report against the list (trace for structure, RPG for feature orientation, refs for properties, index status for a miss). The two skill files are read from disk before the first search; `skills:` preloading did not work with either `plugin:skill` or bare names.

## Validation

Four smoke runs in this session, each checked against the subagent transcript:
- v1: `tools: Glob, Grep, Read, LSP` plus grepai — built-ins present, grepai announced but not callable (schemas deferred; no `ToolSearch`).
- v2: `ToolSearch` added — grepai callable; lookup done grepai → LSP → Read.
- v3: `Glob`/`Grep` replaced by `Bash(rg:*)`, `model: sonnet[1m]` — `ls .` and `echo hi` ran: a specifier in `tools` does not narrow Bash; model fell back to the session model.
- v4: no Bash, no hooks, `model: sonnet` — `Bash`/`Glob`/`Grep` absent; all 14 grepai tools loaded in one call and exercised (13 answered; `grepai_list_projects` needs a `workspace` parameter; refs and trace came back empty for symbols in the new `utils.ts` and `lists/` files).

Model: with `model: sonnet` in the frontmatter the agent still ran on glm-5.4 (transcript), while `model: sonnet` passed on the Agent call ran it on glm-5.3-flash[1m]. The frontmatter model is not applied in this session; cause not established.

## Notes

- An rg-only PreToolUse guard script was written to `.claude/hooks/code-explorer-rg-only.sh` and then dropped at the owner's request; it was never wired to the agent, and the sandbox does not let the agent delete it — the owner removes `.claude/hooks/`.
- `.claude/agents/glob-grep-test.md` (bean cc-sdd-xe02) is still in the project.

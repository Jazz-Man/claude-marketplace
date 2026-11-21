---
# cc-sdd-gnaw
title: 'Root-cause: agents ignore grepai trace/rpg arsenal'
status: completed
type: task
priority: normal
created_at: 2026-11-21T12:56:27Z
updated_at: 2026-11-21T12:58:51Z
---

Investigate why agents and subagents use only grepai_search (or fall back to bash grep) instead of the full grepai toolset (trace_callers/callees/graph, rpg_search/fetch/explore), forcing the user to correct them repeatedly. Inputs: plugins/grepai/skills/grepai-workflow skill texts, lightpanda-browser-chat.md history, grepai source (config.schema.json, chunker_ast.go with today's expanded AST language set).

## Report

Root causes (ranked): RC1 doctrine lives only in the skill body, MCP server sends no instructions block (server.go:2191) and tool descriptions carry no routing doctrine — subagents never see it unless dispatcher restates; RC2 both failing subagents ran glm-5.3-flash, dispatch-prompt instructions decay over a long run; RC3 deferred MCP schemas + root param vs zero-friction bash grep; RC4 skill is advisory (tool map + 'First tool' table), no mandatory routing rules; RC5 stale references (chunking.md ast coverage = 6 exts vs ~30 real; references/config.schema.json diverged from source; search.md still says native 'text Grep'); RC6 [Inference] today's global bash-grep sanction raises ambient default further.

Fix directions: MCP instructions block; routing hints in tool descriptions; mandatory routing rules + dispatch-contract block in SKILL.md; refresh references; optional PreToolUse nudge hook; avoid flash tier for deep research.

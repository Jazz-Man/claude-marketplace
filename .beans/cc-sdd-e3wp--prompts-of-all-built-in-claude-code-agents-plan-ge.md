---
# cc-sdd-e3wp
title: 'Prompts of all built-in Claude Code agents: Plan, general-purpose, claude, claude-code-guide, statusline-setup'
status: completed
type: task
priority: normal
created_at: 2026-11-24T15:06:56Z
updated_at: 2026-11-24T16:00:35Z
---

Owner request: obtain the system prompts of the remaining built-in Claude Code agents (Explore is done, bean cc-sdd-j2af). Two independent sources that must agree: (1) a Sonnet subagent extracts every built-in agent definition and prompt source from the 2.1.325 binary, read-only, with raw/decoded/round-trip files under tmp/claude-builtin-agents/; (2) each built-in agent reports its own system prompt without using tools, taken from its transcript. Then compare, write the rendered prompt per agent.

## Summary of Changes

Prompts of all built-in Claude Code agents (2.1.325) pulled read-only out of the binary by two Sonnet subagents and saved under `tmp/claude-builtin-agents/` (git-ignored): `_index.md`, one folder per agent with `definition.js`, `prompt.raw.txt`, `prompt.decoded.md`, `prompt.rendered.txt` (placeholders resolved for this machine) and the verification scripts.

Found 11 built-in definitions plus a factory where the session lists six: Explore, Plan, general-purpose, claude, claude-code-guide, statusline-setup, web-fetch, worker, workflow-subagent, comment-thread-analyst, fork (empty prompt), teammate (factory).

## Validation

- `verify_roundtrip.py`: 14 literals re-encode byte-identically. `verify_resolve.py`: all checks pass. Both re-run by the lead.
- Second source — each spawnable built-in agent asked to report its own system prompt: Explore and Plan identical to the binary render; general-purpose deviated in two places (it dropped ", Anthropic's official CLI for Claude" and misquoted the persona line); claude-code-guide and statusline-setup refused and were not pressed. Rendered files therefore come from the binary only.
- `claude-code-guide` is assembled per session; its assembled file keeps six run-time marks for the session inventory block.

## Notes

- The built-in `worker` prompt (coordinator mode only) tells the worker to commit its changes, which contradicts the owner's global rule that git is read-only for agents. Recorded as found.
- Self-reports of Explore, Plan and general-purpose were saved as `reported.prompt.txt` and `reported.context.txt` in their folders; the context files also hold the CLAUDE.md, rules and git status injected into those agents.

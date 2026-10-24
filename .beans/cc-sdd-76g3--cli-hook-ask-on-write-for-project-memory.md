---
# cc-sdd-76g3
title: 'cli-hook: ask-on-write for project memory'
status: todo
type: feature
priority: normal
created_at: 2026-10-24T17:33:26Z
updated_at: 2026-10-24T17:52:10Z
---

Every write/delete into ~/.claude/projects/*/memory/ returns permissionDecision ask (not deny) from both routes of the claude-code-cli-hook binary: file tools (checkFilePath) and Bash (scopedDecision). Reads stay free. Spec: docs/superpowers/specs/2026-10-24-cli-hook-memory-ask-design.md. No wiring changes; TDD; four gates + binary rebuild.

## Notes

2026-10-24 owner amendment: two-layer rule — .md writes (and the memory dir itself) ask; non-.md writes deny outright; deletes of non-md stay ask (cleanup); reads free; extension match is exact lowercase .md.

2026-10-24 owner final rule: uniform — ANY mutation in the memory tree (write/edit/delete, any file type, the dir itself) asks; no deny layer; .md-only surfaces only in the non-md ask reason wording.

2026-10-24 owner question on other channels: Bash covered via args+redirects; three intents.ts gaps closed in spec (find -delete -> delete; sed/perl -i -> write; null-intent memory args -> ask). MCP tools documented residual, follow-up if a concrete writer appears.

2026-10-24 owner sudo check: ban implemented; found WRAPPERS drift (intents.ts missing time/parallel -> time sudo / parallel sudo bypass) + zero sudo test pins. Spec: R9 unify WRAPPERS + 4 sudo deny pins.

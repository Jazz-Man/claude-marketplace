---
# cc-sdd-xe02
title: 'Probe subagent: does a project agent with tools Glob, Grep get them'
status: completed
type: task
priority: normal
created_at: 2026-11-24T09:33:07Z
updated_at: 2026-11-24T09:35:06Z
---

Create a throwaway project-scope subagent (.claude/agents/glob-grep-test.md) with tools: Glob, Grep and run it once: report each tool present or absent (no analysis); when both are present, locate the definition of keySuffixes under packages/sandbox-config. Owner wants the agent created in this project, not globally.

## Summary of Changes

Created `.claude/agents/glob-grep-test.md` (project scope): `tools: Glob, Grep`, `model: inherit`; the body tells the agent to try each tool once, report present/absent only, and when both are present locate the definition of `keySuffixes` under `packages/sandbox-config`.

## Validation

The running session loaded the new `.claude/agents/` directory without a restart and the Agent tool accepted `subagent_type: glob-grep-test`. Probe report: `Glob: present`, `Grep: present`, `keySuffixes` defined at `packages/sandbox-config/src/lists/deny-write.ts:4` and `packages/sandbox-config/src/lists/credential-files.ts:3` — both lines verified by reading them. The definition commented out in `lists/deny-read.ts` was not reported, as expected.

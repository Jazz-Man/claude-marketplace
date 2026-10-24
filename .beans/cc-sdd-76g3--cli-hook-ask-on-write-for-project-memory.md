---
# cc-sdd-76g3
title: 'cli-hook: ask-on-write for project memory'
status: completed
type: feature
priority: normal
created_at: 2026-10-24T17:33:26Z
updated_at: 2026-10-24T22:09:56Z
---

Every write/delete into ~/.claude/projects/*/memory/ returns permissionDecision ask (not deny) from both routes of the claude-code-cli-hook binary: file tools (checkFilePath) and Bash (scopedDecision). Reads stay free. Spec: docs/superpowers/specs/2026-10-24-cli-hook-memory-ask-design.md. No wiring changes; TDD; four gates + binary rebuild.

## Notes

2026-10-24 owner amendment: two-layer rule — .md writes (and the memory dir itself) ask; non-.md writes deny outright; deletes of non-md stay ask (cleanup); reads free; extension match is exact lowercase .md.

2026-10-24 owner final rule: uniform — ANY mutation in the memory tree (write/edit/delete, any file type, the dir itself) asks; no deny layer; .md-only surfaces only in the non-md ask reason wording.

2026-10-24 owner question on other channels: Bash covered via args+redirects; three intents.ts gaps closed in spec (find -delete -> delete; sed/perl -i -> write; null-intent memory args -> ask). MCP tools documented residual, follow-up if a concrete writer appears.

2026-10-24 owner sudo check: ban implemented; found WRAPPERS drift (intents.ts missing time/parallel -> time sudo / parallel sudo bypass) + zero sudo test pins. Spec: R9 unify WRAPPERS + 4 sudo deny pins.

## Parking lot

- T1 minor (report accuracy + coverage): task-1-report claims projects-root/memoryx null pins in memory-filetools.test.ts but the file pins only transcripts + memory-backup; semantics verified by reviewer scratch matrix, no permanent pin. Option: add two rows (Write to ~/.claude/projects and ~/.claude/projects/-p/memoryx/f.md expect null) in a later batch.

## Summary of Changes

Feature memory-ask shipped across 5 tasks (commits fe9185e, 32d65d8, 3778bca, 8120d7c): memoryTargetOf predicate + memoryReason (two wordings) consumed by BOTH routes (checkFilePath file tools; scopedDecision Bash args/redirects with null-intent ask per R7); intents refinements (find -delete -> delete; sed/perl in-place cluster -> write, else read); SHARED_WRAPPERS in core/ consumed by intents + no-inline-scripts (parallel-sudo bypass closed; time-prefix handled by AST - spec corrected). hooks.json untouched; binary rebuilt and deployed.

## Validation

659/659 repo-wide, biome repo-wide zero findings, strict clean (91 files), build-bin success. Live smoke PASS: real memory write intercepted, owner denied, no file landed. Reviews: Task 1 + lint batch opus-approved; Tasks 2-4 owner-gated at stop points (subagent roulette - labeled deviations). 43 new pin-tests, RED-first per task.

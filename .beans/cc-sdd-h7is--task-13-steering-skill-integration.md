---
# cc-sdd-h7is
title: "Task 13: steering skill integration"
status: completed
type: task
priority: normal
created_at: 2026-09-23T11:38:36Z
updated_at: 2026-09-23T11:49:12Z
parent: cc-sdd-uwj4
---

Plan task 13: replace skills/steering with the user's global skill (~/.claude/skills/steering + references/), keep llm-application-dev dependency, verify gate runs WITHOUT steering exclusion (residual KIRO_DIR refs die with the legacy text).

## Progress (implementer)

Steps 1-2 done: skills/steering replaced verbatim from ~/.claude/skills/steering (12 files, diff -r identical); key gate `grep -rnE {{|.kiro|kiro-|KIRO_DIR skills/ CLAUDE.md` = 0 (first unexcluded run); plugin validate passed (known warnings only); CLAUDE.md steering-exception sentence removed. Step 3 STOP: awaiting user review + commit. Two out-of-scope observations flagged in task-13-report.md (stale layout parenthetical in CLAUDE.md; docs/guides/ legacy hits vs spec §10 scope).

## Summary of Changes

skills/steering replaced verbatim from the user's global skill (12 files, diff -r identical; llm-application-dev dependency and global-scope rules writes preserved by design). The skills/+CLAUDE.md invariant gate ran UNEXCLUDED for the first time: 0 hits (was 13 legacy lines). CLAUDE.md: obsolete exception sentence + stale Layout parenthetical removed. Review APPROVED — zero convention conflicts (AskUserQuestion at every choice point, no git writes, no beans duplication); one-line fix round + honest F2 report correction; re-review clean.

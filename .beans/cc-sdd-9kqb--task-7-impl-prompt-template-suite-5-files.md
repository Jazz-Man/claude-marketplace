---
# cc-sdd-9kqb
title: "Task 7: impl prompt-template suite (5 files)"
status: completed
type: task
priority: normal
created_at: 2026-09-23T07:22:19Z
updated_at: 2026-09-23T07:35:05Z
parent: cc-sdd-uwj4
---

Plan task 7: rewrite five subagent prompt templates in skills/impl/templates/ — implementer (TDD, boundary, writes report file), task-reviewer (spec-first, blocking-vs-minor), re-review (scoped), code-reviewer (whole-branch), debugger (root-cause, OUTCOME RESOLVED|UNRESOLVED). Carries Task-6 flags: report sub-fields, <=15-line shape.

## Checklist

- [x] Step 1: Write all five templates (complete texts, exact contract blocks)
- [x] Step 2: Verify - contract greps + git-write/placeholder greps empty; claude plugin validate passed (known warnings only)
- [ ] Step 3: STOP - user reviews and commits

## Summary of Changes

Five subagent prompt templates written (implementer/task-reviewer/re-review/code-reviewer/debugger; legacy reviewer-prompt.md deleted): exact parse contracts (Status Report/Review Verdict/Debug Outcome RESOLVED|UNRESOLVED), common headers (no-questions rule, paths-not-contents, git read-only prose only), Task-6 flags landed (sub-fields, blocking-vs-minor + PARKING_LOT, <=15-line discipline), four-part debugger escalation. All orchestrator references resolve; seven reconciliations documented. Review APPROVED, 0 blocking, 2 harmless minors.

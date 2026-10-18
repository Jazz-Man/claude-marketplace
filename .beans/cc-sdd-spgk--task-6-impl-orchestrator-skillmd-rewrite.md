---
# cc-sdd-spgk
title: "Task 6: impl orchestrator SKILL.md rewrite"
status: completed
type: task
priority: normal
created_at: 2026-09-22T22:56:02Z
updated_at: 2026-09-22T23:10:07Z
parent: cc-sdd-uwj4
---

Plan task 6: rewrite skills/impl/SKILL.md fresh — task loop (active feature from beans, brief files, implementer/reviewer dispatch via templates, status contracts, fix-loop escalation, verify-completion, STOP with four-part escalation, abort→scrapped), feature finish (whole-branch review + validate-impl).

## Checklist

- [x] Step 1: Write skills/impl/SKILL.md fresh (orchestrator loop, contracts, fix loop, STOP, feature finish, resume semantics)
- [x] Step 2: Verify presence invariants (greps 6/10/3, git-write empty; claude plugin validate passed with known warnings)
- [ ] Step 3: STOP — user reviews and commits

## Summary of Changes

skills/impl/SKILL.md rewritten from scratch (~340 lines): beans-resolved task loop, pattern-based dispatch via five templates with pinned models, status contracts, fix-loop escalation r1-3 resume/r4-5 fresh-opus, debug <=2 then Blocker-note, STOP with four-part escalation + AskUserQuestion, abort scraps beans, feature finish (merge-base diff, whole-branch review, validate-impl via Agent dispatch). Review REJECTED once (Blocker-note never consumed by selection) — fix round added actionable-definition + 6 minors; re-review: all addressed. 11 design tensions documented+adjudicated.

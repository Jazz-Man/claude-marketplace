---
# cc-sdd-wj19
title: "Task 5: .sdd/ hardcode + /sdd:* renames + root CLAUDE.md rewrite"
status: completed
type: task
priority: normal
created_at: 2026-09-22T22:26:31Z
updated_at: 2026-09-22T22:44:32Z
parent: cc-sdd-uwj4
---

Plan task 5: replace KIRO_DIR with .sdd across skills, rename /kiro-* invocations to /sdd:*, rewrite repo-root CLAUDE.md as dev context, formal claude plugin validate.

## Summary of Changes

39 KIRO_DIR→.sdd replacements (steering excluded, 13 residual lines for Task 13); 50 /kiro-_→/sdd:_ invocation renames + 12 frontmatter bare names (ordering trap ../kiro-review/ handled); repo-root CLAUDE.md rewritten as dev context — review REJECTED first draft (3 Important design misstatements: host-commits, roadmap.md, .sdd/steering + 1 Minor checkbox presupposition), fix round 1 reworded all four; scoped re-review: all addressed, no new breakage. Gates: 0 (excl. steering); plugin validate passes (2 accepted warnings).

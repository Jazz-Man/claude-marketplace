---
# cc-sdd-9ch9
title: "fs v2: candidate-level severity union in argDecision (C1 survivor)"
status: completed
type: bug
priority: critical
created_at: 2026-10-16T17:38:23Z
updated_at: 2026-10-16T17:39:59Z
parent: cc-sdd-20zn
---

pathCandidates ;-unions return [truncated, full]; argDecision's candidate loop returns first-non-null, so a truncated-candidate ask (e.g. ~ under read intent) shadows the full token's deny (tilde-user tail). Route candidate hits through severityUnion. Fixture: grep "--flag=~;/etc/passwd". TDD.

## Summary of Changes

C1 survivor closed at the candidate level, TDD-first, all uncommitted:

- RED: fixture row `grep "--flag=~;/etc/passwd"` added to the DENY severity block — judged ask (truncated candidate ~ → home-whole read ask shadowed the full token's tilde-user deny).
- Fix: argDecision routes candidate hits through severityUnion (deny from any candidate wins, first deny stable in array order); the first-non-null loop is gone. resolve.ts's "strictest hit wins downstream" comment now true at every level — left as-is.
- Battery: bun test 446 pass / 0 fail (445+1), tsc clean, rtk biome check ok.

Report: .superpowers/sdd/2026-10-15-filesystem-policy-v2/final-fix-report.md § Candidate-level union.

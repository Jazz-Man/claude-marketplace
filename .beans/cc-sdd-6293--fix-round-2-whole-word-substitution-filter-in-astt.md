---
# cc-sdd-6293
title: "Fix round 2: whole-word substitution filter in ast.ts (spliced-path evasion)"
status: completed
type: task
priority: normal
created_at: 2026-10-16T11:11:40Z
updated_at: 2026-10-16T11:16:02Z
parent: cc-sdd-20zn
---

Opus review round 2 on the unbash 5.1.0 walk: the contains-marker arg filter (SUBST_SHAPED) drops spliced substitution tokens, turning probe-proven denies into allows (cat /etc/pass$(echo wd)). Replace with anchored whole-word regex; pin acceptance verdicts in fixtures; sibling-identity test; heredoc quirk note. Report: .superpowers/sdd/2026-10-15-filesystem-policy-v2/unbash5-adapt-report.md

## Summary of Changes

Fix round 2 on the unbash 5.1.0 walk (opus review: 1 Critical + 2 Important + 1 comment note):

- CRITICAL spliced-path evasion (src/core/ast.ts): contains-marker SUBST_SHAPED filter replaced with anchored whole-word WHOLE_WORD_SUBST regex ([\s\S] spelling — biome's noEmptyCharacterClassInRegex rejects [^]). Whole-word substitutions still drop (inner units carry enforcement); spliced tokens now ride the arg so the fail-closed gate sees them ($(-splices deny via unresolvedVar, backtick-splices via boundary).
- Durable acceptance pins in tests/fixtures/filesystem.ts: echo $(git log --oneline) ALLOW, echo $(cat /etc/passwd) DENY.
- Sibling-identity pin in tests/ast.test.ts: git status && git status -> TWO units.
- Heredoc quirk bullet: shape probe-confirmed (no Redirect record, delimiter rides args, body invisible); the prescribed 'no enforcement gap' clause was probe-disproven at guard level (bash <<EOF + body ALLOWs across all four policies — the delimiter arg defeats readsStdinScript) — replaced with shape + consumer-consequence wording per controller option (a); gap drafted as bug bean cc-sdd-jbnq.

TDD: RED 378/4 (whole-word parse test + 2 probe splices), GREEN 379/3 (known run-hook trio only). Gates: bun test 379 pass / 3 fail; tsc exit 1 with only the tolerated owner src/test.ts error; rtk biome check exit 0; probes exit 0 (old-vs-new matrix in report). ast.ts 191 lines. Nothing committed. Report: .superpowers/sdd/2026-10-15-filesystem-policy-v2/unbash5-adapt-report.md §Fix round 2

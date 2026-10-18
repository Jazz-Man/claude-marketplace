---
# cc-sdd-izl5
title: Migrate ast.ts to unbash 6.0.0 (forEachChild)
status: completed
type: feature
priority: high
created_at: 2026-10-16T11:47:02Z
updated_at: 2026-10-16T12:22:58Z
---

Owner ruling 2026-10-16: upgrade NOW, before Task 4. Rewrite the walk on v6 forEachChild (canonical children; drops prototype-descent + identity-dedupe ~60%), redirects via .map over Command.redirects; words/functionDefs/whole-word-subst-filter/baseName stay hand-rolled (no v6 equivalents). Gates: errors-array semantics decision (truncation vs parse-warning — no silent deny-to-allow), heredoc-delimiter dropped from accessor args (consumption must not need arg-equality), two ast.ts header corrections (research §4), six research pin fixtures. Research: .superpowers/sdd/2026-10-15-filesystem-policy-v2/unbash6-research.md

## Report

Walk rewritten on v6 forEachChild; suite 391 pass / 3 fail (same known run-hook filesystem failures), tsc clean except owner's src/test.ts, biome exit 0. Errors decision: walk-partial kept (truncation class textually distinguishable but null maps to allow-whole; probe shows 5.1.0 already truncated at 257 — posture pre-dates v6, parity exact). Heredoc delimiter still rides unit args on v6 — heredocFed arg-equality survives, no policy edit. Seven walk pins added. Deviation: 198→169 lines (−15%, not ~60%) — walk machinery halved, but mandated invariant comments keep the total; flagged in report. Full report: .superpowers/sdd/2026-10-15-filesystem-policy-v2/unbash6-migrate-report.md

## Summary of Changes

Migrated ast.ts to unbash 6.0.0 forEachChild (canonical children; proto-descent + identity-set deleted; 169 lines); views behavior-identical (dual-dist probe parity incl. errors/truncation posture); 7 walk pins; header under comment diet. Review: Approved, minors folded into the cleanup dispatch.

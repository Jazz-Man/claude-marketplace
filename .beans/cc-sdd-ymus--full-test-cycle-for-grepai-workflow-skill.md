---
# cc-sdd-ymus
title: Full test cycle for grepai-workflow skill
status: completed
type: task
priority: normal
created_at: 2026-10-29T10:04:18Z
updated_at: 2026-10-29T13:39:53Z
---

skill-creator loop for plugins/grepai/skills/grepai-workflow: iteration-1 (current skill vs no-skill, 3 evals incl. the owner-ignore-pruning regression from user observation), fix instructions, iteration-2 verification.

## Summary of Changes

Two-iteration skill-creator cycle for grepai-workflow. Iteration-1 (vs no-skill): 100% vs 75% (+25pp), with_skill also faster (-36s) and cheaper (-10.3k); all baseline failures were missing semantic-search/LSP-verify methodology. Regression eval-0 (owner-pruned ignore entries) passed BOTH configs but was compromised by a leading prompt hint. Iteration-2 (causal A/B, neutral prompt, new vs old wording): both 100% pass — regression did NOT reproduce under either wording (field behavior likely frame-dependent or stochastic); new wording retained because it moves the owner-respect decision from [Inference] to an explicit never-re-add axiom (old agent reasoned its way there, new agent cites the rule). Token economy axis: NEW 47.0k vs OLD 50.9k mean (-7.6%), concentrated in e0 (-16%); e1/e2 parity; quality 100% everywhere — economy without quality loss confirmed at modest scale. Changes shipped: owner-curation axiom in SKILL.md/ignore.md/configuration.md; compact-first token-economy contract (compact:true + limit 3-5 default, winner-only bounded Read, score-cliff stop) in SKILL.md/search.md; trace compact-when-mapping in trace.md. claude plugin validate passes.

## Post-feedback codification (user question: why whole-file reads)

Three causes identified: (1) small-file math — slicing under ~150-200 lines costs more calls than it saves (framing.ts=150, downstream.ts=93); (2) comprehension-shaped tasks — the module IS the answer, so its span is the bounded range (the contract was written for lookup-shaped questions); (3) genuine drift — reading from line 1 after exact LSP coordinates. Codified in search.md + SKILL.md: whole-file reads legitimate for (a) comprehension tasks, (b) small files; span-based reads mandatory after coordinates. Viewer i2 killed.

## Iterations 3-4 (hard research tasks, large files)

i3 Effect-rewrite plan (9 assertions): 9/9 vs 9/9 parity; all APIs source-verified by orchestrator (v4 traps caught by both: fromNullishOr, no runIntoSink, catchAll gone; unique finds: with=CLI presenter stdout pollution + empty-argv decision, baseline=ConfigProvider eager env snapshot). with_skill 93 calls vs baseline 135 (-31%). i4 config-to-Schema plan, compact forbidden by task (8 assertions): 8/8 vs 8/8; unique finds: with=checked-Record silent key drop (Schema.ts:3984) + 12-site byte-compat ConfigError table, baseline=ParseOptions errors:first default + empirical probe.ts on real fixtures. Contradiction adjudicated: effect resolves via root symlink today (baseline right, with_skill isolated-linker blocker overstated). Compact experiment: no-compact did not inflate tokens or degrade quality — verification-heavy research uses few searches; compact economy matters in search-heavy loops only. Doctrine stays default-not-dogma.

## Day close

Iteration-5 verdict (grepai-only 132.4k/76 calls vs grepai+LSP 104.8k/65, both 7/7): LSP pays hardest in consumer-census questions (hard pins: sync-extensions.ts imports conflictingExtension, config-oop.test.ts imports ProxyConfig class directly — via findReferences in one call); grepai-only compensates with empiricism (6 probes; three new v4 behaviors: struct-check skipped on inner decode failure, pathless filter issues crash Pointer formatters, annotate not reaching InvalidType) at +27% tokens. Both critical v4 traps (no Schema.parse/parseResult, errors:'first' default) caught by all four modes — zero invented APIs. Metadata carry-over mistake (i4's no-compact assertion in i5) graded honestly at 7/7 both. Day totals: 5 iterations, 18 runs, ~1.6M subagent tokens, 8 skill calibrations. Workspaces cleaned from tmp/ at owner request; per-run evidence lives in this bean and the gradings summarized above.

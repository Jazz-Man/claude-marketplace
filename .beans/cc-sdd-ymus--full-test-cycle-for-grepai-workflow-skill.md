---
# cc-sdd-ymus
title: Full test cycle for grepai-workflow skill
status: completed
type: task
priority: normal
created_at: 2026-10-29T10:04:18Z
updated_at: 2026-10-29T10:55:12Z
---

skill-creator loop for plugins/grepai/skills/grepai-workflow: iteration-1 (current skill vs no-skill, 3 evals incl. the owner-ignore-pruning regression from user observation), fix instructions, iteration-2 verification.

## Summary of Changes

Two-iteration skill-creator cycle for grepai-workflow. Iteration-1 (vs no-skill): 100% vs 75% (+25pp), with_skill also faster (-36s) and cheaper (-10.3k); all baseline failures were missing semantic-search/LSP-verify methodology. Regression eval-0 (owner-pruned ignore entries) passed BOTH configs but was compromised by a leading prompt hint. Iteration-2 (causal A/B, neutral prompt, new vs old wording): both 100% pass — regression did NOT reproduce under either wording (field behavior likely frame-dependent or stochastic); new wording retained because it moves the owner-respect decision from [Inference] to an explicit never-re-add axiom (old agent reasoned its way there, new agent cites the rule). Token economy axis: NEW 47.0k vs OLD 50.9k mean (-7.6%), concentrated in e0 (-16%); e1/e2 parity; quality 100% everywhere — economy without quality loss confirmed at modest scale. Changes shipped: owner-curation axiom in SKILL.md/ignore.md/configuration.md; compact-first token-economy contract (compact:true + limit 3-5 default, winner-only bounded Read, score-cliff stop) in SKILL.md/search.md; trace compact-when-mapping in trace.md. claude plugin validate passes.

## Post-feedback codification (user question: why whole-file reads)

Three causes identified: (1) small-file math — slicing under ~150-200 lines costs more calls than it saves (framing.ts=150, downstream.ts=93); (2) comprehension-shaped tasks — the module IS the answer, so its span is the bounded range (the contract was written for lookup-shaped questions); (3) genuine drift — reading from line 1 after exact LSP coordinates. Codified in search.md + SKILL.md: whole-file reads legitimate for (a) comprehension tasks, (b) small files; span-based reads mandatory after coordinates. Viewer i2 killed.

---
# cc-sdd-y5le
title: 'grepai-init eval cycle, iteration 2: built-in validation, test projects without git'
status: completed
type: task
priority: normal
created_at: 2026-11-28T15:47:54Z
updated_at: 2026-11-28T16:38:50Z
---

Second skill-creator iteration for grepai-init after the bun validator scripts were replaced by grepai config validate and a no-git fallback was added to the skill (cc-sdd-rkoo). Same three evals as iteration 1 (cc-sdd-65vp); baseline is the previous skill version (bun validator); test projects carry no git metadata, per the owner's request. Two assertions relaxed: the ignore row no longer demands all 15 shipped defaults, and the documentation question accepts an explicit offer. Reports are never deleted this time; time and tokens come from the saved transcripts.


## Report

- Iteration 2 (2026-11-28): six Sonnet runs on test projects without git metadata. New skill (grepai config validate) 12/14, 14/14 and 8/8, mean 95.2%; previous skill (bun validator) 13/14, 14/14 and 7/8, mean 93.5%; delta +0.02, inside the noise of one run per cell. Time equal on average (273 s against 270 s); tokens 446k against 397k, not consistent per cell. Dropping the bun validator did not cost compliance.
- Two failures of the new skill, both in the fresh-project run: `AGENTS.md` missing from ignore (the file is absent, the base set is unconditional), and `trace.enabled_languages` set to `.ts .tsx` only. The baseline run made the same trace choice: "kept as whole families" does not name the extensions of a family, and a census without git shows no `.js` files.
- Baseline run on the curated config added `bun.lock` to the owner's ignore list beyond the two gaps.
- Verified on a scratch project: one read-only `grepai_index_status` call leaves three lock files and a 438-byte `rpg.gob` where RPG is enabled and no index exists; the grader no longer counts them as a built index.
- Grader changes for this iteration: ignore row demands `.git`, `.grepai` and the six agent names instead of all 15 defaults; the documentation question accepts an explicit offer; `transcript_metrics.py` reads time and tokens from the saved transcripts. No report was deleted this time.
- Viewer on port 3117 with iteration 1 as the previous workspace; feedback lands in `iteration-2/feedback.json`. Test projects: /tmp/claude-501/grepai-eval-2.


## Notes

- Owner's feedback on iteration 2 (one review, on eval 0 with the new skill; the form was not submitted): "ignore містить перелік файлів та папок не притаманних даному проекту". That run's ignore held 24 entries: the 15 shipped defaults plus 9 additions. Thirteen defaults name things the project does not have (vendor, __pycache__, .venv, venv, target, .zig-cache, zig-out, qdrant_storage, dist, .vscode, .idea, node_modules, .git). Read as: the list must be shaped for the project, as the owner's live list is (12 entries), not "the defaults plus additions".
- Changes for iteration 3: SKILL.md ignore row now asks for this project's own list with nothing for other ecosystems; ignore.md gained "Shaping the list at init" and says the base agent names go in even when the file is absent; the trace row names the TypeScript family explicitly (`.ts .tsx .js .jsx`). The grader's ignore assertion follows the new rule.
- Iteration 3 launched 2026-11-28: six Sonnet runs, test projects without git under /tmp/claude-501/grepai-eval-3; baseline is the iteration-2 skill (skill-snapshot-i2).


## Report

- Iteration 3 (2026-11-28), after the owner's iteration-2 feedback, six Sonnet runs on test projects without git: new skill 14/14, 14/14 and 7/8 (95.8%); the iteration-2 skill as baseline 12/14, 12/14 and 7/8 (86.3%); delta +0.10. Time 299 s against 308 s on average; tokens 576k against 538k, not consistent per cell.
- The feedback is addressed: with the new skill both adaptive runs shape ignore into a 12-entry project list with nothing for other ecosystems, add AGENTS.md although the file is absent, skip .idea because the project's .gitignore excludes it, and keep .ts .tsx .js .jsx in trace. The baseline runs keep the shipped defaults and narrow trace to .ts and .tsx.
- Open, owner's decision: both runs on the curated config, new skill and baseline, added bun.lock to the owner's ignore list beyond the two gaps, citing the JS/TS lock-file additions in ignore.md.
- Assertion changed for this iteration: .idea and .vscode are not demanded in ignore when the project's own .gitignore excludes them.
- Viewer on port 3117 with iteration 2 as the previous workspace; feedback lands in iteration-3/feedback.json. Test projects: /tmp/claude-501/grepai-eval-3. All six agents stopped.


## Summary of Changes

- Two iterations of the skill-creator cycle for grepai-init after the bun validator was replaced by `grepai config validate`, 2026-11-28, on test projects without git metadata (the owner's request).
- Iteration 2: new skill 95.2%, the previous skill with the bun validator 93.5%. Owner's feedback on the fresh-project run: the ignore list held files and folders not belonging to the project.
- Iteration 3 after the fix: SKILL.md ignore row asks for the project's own list with nothing for other ecosystems; ignore.md gained "Shaping the list at init" and says the base agent names go in even when the file is absent; the trace row names the TypeScript family. New skill 95.8%, the iteration-2 skill 86.3%.
- Workspace `tmp/grepai-init-workspace` (git-ignored): evals, metadata, grading, timing, benchmarks, reports and snapshots for iterations 1 to 3; grade.py and transcript_metrics.py.

## Notes

- Owner's verdict on iteration 3: "все ок, решту налаштувань я буду робити вже сам. Можна завершувати процес". Cycle closed on three iterations.
- Left as the owner said they would finish the settings themselves: both runs on the curated config in iteration 3 added bun.lock to the owner's ignore list beyond the two gaps, and the live config excludes no lock file except skills-lock.json through .grepaiignore.
- Removed by the agent: the test projects of iterations 2 and 3 (no git metadata inside). Not removed: /tmp/claude-501/grepai-eval, the iteration-1 copies that hold this repository's .git, which the sandbox does not let the agent delete; `rm -rf /tmp/claude-501/grepai-eval` outside the sandbox does it.
- Time and token figures come from the agents' saved transcripts, since the harness delivers none.

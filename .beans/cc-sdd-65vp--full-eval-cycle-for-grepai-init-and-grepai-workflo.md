---
# cc-sdd-65vp
title: Full eval cycle for grepai-init and grepai-workflow
status: completed
type: task
priority: normal
created_at: 2026-11-28T14:07:08Z
updated_at: 2026-11-28T15:06:48Z
---

Owner decision 2026-11-28: after the skills are synced with the rewritten upstream docs, run the full skill-creator cycle (evals with and without the skill, grading, benchmark, viewer). Candidate evals: a fresh project setup; an already-initialized generic config; an owner-curated config where removed entries must not come back. No indexing inside evals: the owner builds indexes.

## Notes

- Prepared 2026-11-28: workspace `tmp/grepai-init-workspace` (git-ignored) with `evals/evals.json`, per-run `eval_metadata.json`, the grader `grade.py` (stdlib Python plus Ruby's YAML), and `skill-snapshot-old` — the pre-split combined skill exported read-only from commit 0c38fd2 as the baseline.
- Evals: 0 fresh project; 1 already-initialized generic config; 2 owner-curated config with two gaps (no external_gitignore, RPG off). Configurations: `with_skill` (live grepai-init) and `without_skill` (the baseline snapshot). Runners on Sonnet.
- Test projects: six copies of this repository's tracked files under /tmp/claude-501/grepai-eval, one per run; eval 1 copies hold the generic `grepai init --yes` config, eval 2 copies the owner's config with the two gaps. No indexing happens inside a run.
- Blocked: the sandbox refuses to create a `.git` directory and git writes are off limits for the agent, so the copies are not git repositories yet. `add-git.sh` in the fixture folder adds this repository's `.git` to each; the owner runs it outside the sandbox.


## Report

- Iteration 1 (2026-11-28): six Sonnet runs, one per cell. Pass rate with the new skill 12/14, 13/14 and 8/8 (mean 92.9%); with the pre-split skill 6/14, 6/14 and 5/8 (mean 49.4%); delta +0.43. Time and tokens (input plus output, 306k to 461k per run) are within noise between configurations.
- external_gitignore, agent names in ignore, trace languages and RPG fail in both adaptive runs with the old skill and pass with the new one. With the old skill the curated-config run changed the owner's boost list and left both gaps; with the new skill it changed exactly the two missing rows.
- Open, owner's decision: the assertion "ignore keeps all 15 shipped defaults" fails with the new skill too. Eval 0 trimmed the list to the owner's 12 entries after reading the owner's live config; eval 1 kept the defaults and dropped only `bin`, because it hides plugins/sdd/bin. The row's wording and the assertion need one decision: defaults plus additions, or shaped for the project.
- Contamination: the test projects are copies of this repository, so the original is one path away; one run read its live config. Anonymize the fixture or forbid reading it before iteration 2.
- Harness notes: grading is `grade.py` in the workspace. The reports were deleted once by mistake and restored from the agents' saved transcripts; time and token figures come from those transcripts, since the harness delivers none. Viewer: `generate_review.py` on port 3117; feedback lands in `iteration-1/feedback.json`.


## Summary of Changes

- One skill-creator iteration for grepai-init, 2026-11-28: three evals (fresh project, generic config after init, owner-curated config with two gaps), each run with the live skill and with the pre-split skill as baseline, six Sonnet runs. Pass rate 92.9% against 49.4%, delta +0.43. Workspace `tmp/grepai-init-workspace` (git-ignored): evals.json, per-run metadata, grading.json, timing.json, benchmark.json, the six reports, skill-snapshot-old and the grader grade.py. Viewer reviewed by the owner.
- Owner's verdict: feedback file holds one entry, "ok" for eval 0 with the new skill, and was not submitted; the owner's message in chat says all is fine. Cycle closed on one iteration.

## Notes

- Left for a follow-up, owner's call: the ignore row's wording ("defaults plus additions" or "shaped for the project") — both adaptive runs deviated from the text as written; anonymized test projects for any next cycle (one run read the original repository's live config); the "asks which documentation to rank above source" assertion, which is a regex on a question mark.
- Not removed: the six test projects under /tmp/claude-501/grepai-eval. They hold copies of this repository's .git, which the sandbox does not let the agent delete; `rm -rf /tmp/claude-501/grepai-eval` outside the sandbox does it.

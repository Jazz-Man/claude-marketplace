---
# cc-sdd-65vp
title: Full eval cycle for grepai-init and grepai-workflow
status: in-progress
type: task
priority: normal
created_at: 2026-11-28T14:07:08Z
updated_at: 2026-11-28T14:30:15Z
---

Owner decision 2026-11-28: after the skills are synced with the rewritten upstream docs, run the full skill-creator cycle (evals with and without the skill, grading, benchmark, viewer). Candidate evals: a fresh project setup; an already-initialized generic config; an owner-curated config where removed entries must not come back. No indexing inside evals: the owner builds indexes.

## Notes

- Prepared 2026-11-28: workspace `tmp/grepai-init-workspace` (git-ignored) with `evals/evals.json`, per-run `eval_metadata.json`, the grader `grade.py` (stdlib Python plus Ruby's YAML), and `skill-snapshot-old` — the pre-split combined skill exported read-only from commit 0c38fd2 as the baseline.
- Evals: 0 fresh project; 1 already-initialized generic config; 2 owner-curated config with two gaps (no external_gitignore, RPG off). Configurations: `with_skill` (live grepai-init) and `without_skill` (the baseline snapshot). Runners on Sonnet.
- Test projects: six copies of this repository's tracked files under /tmp/claude-501/grepai-eval, one per run; eval 1 copies hold the generic `grepai init --yes` config, eval 2 copies the owner's config with the two gaps. No indexing happens inside a run.
- Blocked: the sandbox refuses to create a `.git` directory and git writes are off limits for the agent, so the copies are not git repositories yet. `add-git.sh` in the fixture folder adds this repository's `.git` to each; the owner runs it outside the sandbox.

---
# cc-sdd-594v
title: 1.1 Execute the payload move as a handed user-run batch
status: completed
type: task
priority: normal
tags:
  - status-done-with-concerns
  - verdict-approved
  - verification-verified
created_at: 2026-09-26T16:49:00Z
updated_at: 2026-09-26T17:16:58Z
parent: cc-sdd-lpx9
---

## Brief

Task: 1.1
Title: Execute the payload move as a handed user-run batch

Relocate the complete sdd plugin payload from the repository root into its own subfolder under the plugins directory, executed as user-run git moves of unmodified files.

- Hand the user the exact ordered move batch pinned in the design (destination directories pre-created inside the same block) as a command block for them to execute; no git write is ever agent-run.
- Preconditions: clean working tree; the batch is the only pending change.
- After the user runs the batch, inspect git status: pure renames, zero content modifications inside the moved set.
- Confirm history survival: git log --follow on the moved plugin manifest and at least one skill file reaches commits predating the move.
- Observable completion: the plugin manifest, skills, shared assets, helper scripts, hooks, user guides, and plugin README all live under the single plugin subfolder, and git shows the whole change as renames only.

_Requirements: 1.1, 1.2, 2.2, 4.1, 4.2, 4.3_
_Boundary: Migration execution model_

## Report

Task 1.1 — deliverable is the handed move batch, not the move itself (execution model: user-run git moves only; agent ran no git write and wrote no payload file).

What was done:

- Extracted the move batch verbatim from design.md §Migration execution model (Contracts: Command block).
- Verified it against the design's payload inventory (§File Structure Plan, §sdd plugin folder) and a read-only inspection of the tree.

Verification evidence (all read-only):

- Payload fully tracked: `git status --porcelain -uall -- skills assets bin hooks README.md docs/guides .claude-plugin` → empty (no untracked or modified payload files); `git ls-files` over the same set → 56 files.
- Census: skills/ = 15 entries (pinned 15-skill invariant holds pre-move); assets/ = rules/, templates/, workflow-map.md, design-system_flow.png; bin/ = sdd-gate, sdd-promote, sdd-verdict; hooks/ = hooks.json; docs/guides/ = 3 guides; README.md at root; .claude-plugin/ = plugin.json + marketplace.json (marketplace stays per design).
- `plugins/` does not exist yet; docs/ holds guides/ + superpowers/ (only guides moves; superpowers stays — design's noted expected residue).

THE BATCH (verbatim from design.md §Migration execution model):

```bash
mkdir -p plugins/sdd/.claude-plugin plugins/sdd/docs
git mv skills assets bin hooks README.md plugins/sdd/
git mv docs/guides plugins/sdd/docs/guides
git mv .claude-plugin/plugin.json plugins/sdd/.claude-plugin/plugin.json
```

Precondition check: working tree has exactly one pending change — `M .beans/cc-sdd-594v--11-execute-the-payload-move-as-a-handed-user-run-b.md` (this task's bean, carrying the appends below). Design precondition: clean tree, batch the only pending change. The commit path is the one available (stash is ruled out for cc-sdd per memory note); the user commits at the stop point before running the batch.

Post-move inspection commands for the orchestrator (after the user executes the batch):

1. `git status --porcelain` — every payload entry must be `R ` (staged rename); zero `M`, `A`, or `D` entries.
2. `git diff --staged -M` — rename similarity lines only; zero content hunks (design: "empty on content").
3. `ls plugins/sdd` — must show .claude-plugin/ skills/ assets/ bin/ hooks/ docs/ README.md; item census matches the pre-move listing above (15 skills, 3 bin helpers, 3 guides, hooks.json, plugin.json; marketplace.json stays at root).
4. `git log --follow plugins/sdd/.claude-plugin/plugin.json` and `git log --follow plugins/sdd/skills/impl/SKILL.md` — must reach commits predating the move. Note: --follow reads committed history, so these run after the user commits the renames; empty output pre-commit is expected, not a failure.

Not this task's gate: `claude plugin validate .` — belongs to task 1.2 (after the manifest source re-point); between move and edit, validate red is the designed broken state.

Concerns: none beyond the precondition note (bean-file commit before the batch).

## Notes

- The move-to-manifest-edit interval is the designed broken state: `claude plugin validate` stays red until task 1.2's source re-point — a red validate there is the pinned window, not a task-1.1 failure signal.

Learning for 1.2: claude plugin validate . stays GREEN even with a stale marketplace source (./) and no root plugin.json - task 1.2 gates on manifest source content plus 3.3-3.5 behavioral checks, never on validate red->green.

## Validation

- VERDICT: APPROVED - 2026-09-26, review round 1, package: workspace/review-package-1.1.md
- STATUS: VERIFIED - 2026-09-26, verification gate: structural evidence fresh-run - 55/55 R100 pure renames, zero content hunks, zero root residue, inventory complete under plugins/sdd, old-path history present (ac70379, 245e547); 4.3 follow-log closing evidence rides the user's stop-point commit

## Parking lot

- Task 1.2 brief must carry: validate passes even with a stale marketplace source; gate 1.2 on manifest content + 3.3-3.5 behavior, not on validate red->green.
- At the commit stop point, record the follow-log on plugins/sdd/.claude-plugin/plugin.json and one skill file as 4.3's closing evidence.

## Summary of Changes

55-file pure-rename payload move (skills, assets, bin, hooks, README, docs/guides, plugin.json) from repo root into plugins/sdd/, executed as a user-run rename batch per the design's migration model; review round 1 APPROVED (2 MINOR parked), structural verification VERIFIED.

- 4.3 closing evidence (stop point, commit f86d1c3): follow-log on plugins/sdd/.claude-plugin/plugin.json reaches a33f6ad; on plugins/sdd/skills/impl/SKILL.md reaches e91d159.

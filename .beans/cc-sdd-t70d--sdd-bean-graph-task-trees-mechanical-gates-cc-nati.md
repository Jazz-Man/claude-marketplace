---
# cc-sdd-t70d
title: "sdd: bean-graph task trees, mechanical gates, CC-native coherence"
status: completed
type: feature
priority: normal
created_at: 2026-10-05T14:01:55Z
updated_at: 2026-10-05T14:49:38Z
---

Redesign the sdd plugin's task model and enforcement per user decisions 2026-10-05: (1) task decomposition as-needed into bean trees - multi-step tasks become child beans sequenced via blockedByIds, single-step stay flat; progress = status field only, never checklists in bodies. (2) Mechanical validation via bash helpers + PreToolUse hooks: new sdd-next helper, depth-aware sdd-gate/sdd-promote, Skill-tool sequence interception, Edit/Write guard (.beans/ CLI-only, no checkbox flips in spec docs). Bends invariant 'one SessionStart hook' - sanctioned by user. (3) sdd-promote wired into spec-tasks approve gate with subtree depth. (4) Hybrid verification: sandbox bean-tree tests + 2-3 subagent evals + standard battery. Plus CC-nativeness coherence: IDE phrasing purge, canonical dispatch/Apply: patterns, twin gates, workflow-map graph-not-checklist rule, guards in review/debug/verify-completion, docs+repo-rules sync.

## Plan

- [x] bin: _sdd-lib.sh (shared child/phase/doc-hash/blockedByIds parsing) + refactor sdd-gate/sdd-promote to source it
- [x] bin: sdd-phase <skill> - per-skill precondition checker (hook + skills share it)
- [x] bin: sdd-next - next actionable leaf + rollup candidates (tree-aware queue)
- [x] bin: sdd-gate - depth-aware queue check (descendants; drafts diagnosis; in-progress edge fixed)
- [x] bin: sdd-promote - recursive subtree promotion, approve gate uses it
- [x] hooks: PreToolUse Skill gate + Edit/Write guard + UserPromptExpansion (live-verified: write-guard blocks; skill-gate blocks via phase check; UserPromptExpansion unverified-but-wired, skill-level gate covers the path)
- [x] skills: spec-tasks - real task trees (feature-type majors, task leaves, blockedByIds chaining, sdd-promote approve gate)
- [x] skills: impl - sdd-phase+sdd-next mandatory first step, leaf queue, rollup completion, tree-aware fallback prose
- [x] skills: identical tracker guard in review/debug/verify-completion
- [x] workflow-map + .claude/rules/sdd.md: graph-not-checklist rule + Mechanical gates paragraph
- [~] coherence: IDE purge done (6 spots incl README); actor names collapsed to 'the main context' (+ 'orchestrator' kept inside impl); steering boilerplate left as legitimate per-skill repetition; canonical dispatch/Apply: shaping + twin confirm-gates = follow-up
- [x] docs+rules sync: README, 3 guides, product/tech/structure rules, CLAUDE.md layout
- [x] verification: sandbox bean-tree tests (25/25) + full battery green + live old-vs-new evals (plan + exec + exec-fix rerun)

## Decisions (user, 2026-10-05)

Decomposition as-needed; helpers + PreToolUse hooks (bends one-SessionStart-hook invariant - sanctioned); sdd-promote wired + depth; hybrid verification. scrapped != approved (semantic correction delivered): approved+verified = completed + tags; QA reject = stays in-progress + findings.

## Notes

- beans CLI parent rules (verified live): task parents = milestone|epic|feature; feature under feature FORBIDDEN. Tree model fixed at: epic -> feature-type MAJOR containers -> task LEAVES (+ flat task children of epic). Deeper decomposition flattens to dotted numbers + blockedByIds edges.
- JSON shapes verified: blockedByIds prints INLINE or null (sed range parser broke; replaced with lib awk sdd_blocked_ids). Children pretty-printed, tags inline.
- Found+fixed in _sdd-lib.sh: recursive _sdd_walk clobbered its global parent var (records shifted by one) - switched to positional params (restored per frame).
- Found+fixed in sdd-next: status filter lost in rewrite (completed leaves stayed candidates); blocker lookup read parentId instead of status.
- Sandbox suite: /tmp/sdd-sb/test.sh - 25/25 green (phases, stale hash + latest-wins, drafts, promote guards, tree walk, rollups, ancestor chaining, resume, finished, single-active).
- shellcheck 0.11.0 CLEAN on all five scripts; sh -n clean.

## Validation

- Final battery (2026-10-05): claude plugin validate PASS; invariant greps all 0 (placeholders, kiro, IDE, checkbox-writes, tasks.md refs); twins 6/6/6 + approve-gate slot-normalized diff EMPTY; census 15; shellcheck 0.11.0 CLEAN on 7 scripts (5 bin + 2 hooks); sandbox helper suite 25/25.
- Live hook verification: claude -p with plugin - PreToolUse write-guard BLOCKED a checkbox write into .sdd/ with reason reaching the model (no workaround); skill-level sdd-phase gate stopped /sdd:impl on an empty project with the fix command. UserPromptExpansion wiring unverified in -p mode.
- Eval fixture lesson: a completed Phase-tasks with zero task beans is correctly caught as re-entry anomaly by the (new AND old) spec-tasks gate - fixture bug, not skill bug.

## Evals (live claude -p, old HEAD-snapshot vs new plugin, 2026-10-05)

- plan-old: flat 5 leaves under epic, 1 explicit edge (3.1<-2.1+2.2), order=numbering convention, 184s.
- plan-new: 2 feature-type majors + 1 single-item collapse, 5 chain edges (major->major, leaf->predecessor, cross-major 2.1<-1.1), no checklists, 278s. Tree model works end-to-end.
- exec-old: work done (hello.txt), but Report appended to the MAJOR container (wrong bean), leaf 1.1 left todo - no leaf concept in old impl.
- exec-new (pre-fix): right leaf bean, status in-progress, BUT flipped the legacy brief checkbox via beans CLI (write-guard cannot see CLI writes; global beans guide teaches flipping) -> led to the Hard-rule-6 + implementer-template strengthening ('beans-guide checkbox convention does NOT apply to sdd task beans').
- exec-new2: rerun with strengthened text - result pending.

## Validation (evals cont.)

- exec-new2 (strengthened text): right leaf, in-progress, 0 checkbox flips, Report+Notes appended, and the agent surfaced decomposing 1.1 via /sdd:spec-tasks instead of ticking steps - designed behavior confirmed. hello.txt created.

## Summary of Changes

Task tree model: spec-tasks generates epic -> feature-type majors -> task leaves with blockedByIds chaining (CLI parent rules verified); tasks-generation rules rewritten to edges-not-order; impl Step 0 mandates sdd-phase + sdd-next (rollups, resume, leaf selection); sdd-promote wired into the approve gate, recursive. Mechanical gates: _sdd-lib.sh + sdd-phase + sdd-next (new), sdd-gate/sdd-promote (tree-aware refactor); hooks: PreToolUse Skill gate (verified), Edit|Write guard (verified live), UserPromptExpansion (wired, unverified). Discipline: identical tracker guards in review/debug/verify-completion; Hard rule 6 + implementer template now explicitly exempt sdd task beans from the beans-guide checkbox convention (behaviorally verified). Coherence: IDE phrasing purged (6), actor names collapsed to 'the main context'. Docs+rules synced: README, 3 guides, workflow-map + rules/sdd.md, product/tech/structure, CLAUDE.md. Battery: validate PASS, invariant greps 0, twins 6/6/6 + identical, census 15, shellcheck CLEAN x7.

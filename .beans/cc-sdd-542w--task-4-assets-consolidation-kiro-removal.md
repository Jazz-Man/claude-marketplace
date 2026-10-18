---
# cc-sdd-542w
title: "Task 4: assets/ consolidation + .kiro removal"
status: completed
type: task
priority: normal
created_at: 2026-09-22T22:12:18Z
updated_at: 2026-09-22T22:22:12Z
parent: cc-sdd-uwj4
---

Plan task 4: move 12 rules + 5 spec templates (flattened from specs/) to assets/, delete init.json, remove .kiro/, rewire skill references to CLAUDE_PLUGIN_ROOT paths (steering excluded — replaced in Task 13).

## Steps

- [x] Step 1: Move assets (rules -> assets/rules, specs/*.md -> assets/templates, rm init.json, rm -rf .kiro)
- [x] Step 2: Rewire skill references to ${CLAUDE_PLUGIN_ROOT}/assets/*
- [x] Step 3: Verify (grep=0, 12 rules, 5 flat templates)
- [x] Write task-4-report.md

## Summary of Changes

Moved 12 shared rules (tools/cc-sdd/templates/shared/settings/rules/ -> assets/rules/) and 5 spec templates (settings/templates/specs/*.md -> assets/templates/, flattened); deleted specs/init.json and the entire .kiro/ tree (46 tracked files). Rewired 9 references in 4 skills (spec-design, spec-requirements, spec-init, spec-tasks) from {{KIRO_DIR}}/settings/templates/specs/ to ${CLAUDE_PLUGIN_ROOT}/assets/templates/. Verified: brief grep gate = 0, 12 rules, 5 flat templates, .kiro gone, skills/steering untouched. Note: spec-init/SKILL.md:20 now references assets/templates/init.json which no longer exists (init.json deleted per brief) — needs resolution in a later task. Git untouched; human commits.

## Fix round 1 (addendum)

- [x] Item 1: rewire 13 skill-local rules/<name>.md refs (spec-design, spec-requirements, spec-tasks, validate-design, validate-gap) to ${CLAUDE_PLUGIN_ROOT}/assets/rules/
- [x] Item 2: remove metadata.shared-rules frontmatter in those 5 skills (removed whole metadata: block — shared-rules was its only child in all 5)
- [x] Item 3: drop assets/templates/init.json reference line in spec-init
- [x] Verify: 3 addendum greps + round-1 gates re-run; append fix report (all 0/0/0; awaiting review — completion gated by team-lead)

## Summary of Changes

assets/ consolidated: 12 rules + 5 flat templates (init.json deleted with spec.json). .kiro/ removed (46 files). 6 skills rewired: 9 template refs + 13 skill-local rules refs to CLAUDE_PLUGIN_ROOT paths; 5 metadata.shared-rules frontmatters removed; dangling init.json ref dropped (fix round 1 after adjudication — plan gap found: skills referenced rules as install-time skill-local copies). Review: all spec items pass, APPROVED, 0 Critical/Important; counts byte-verified.

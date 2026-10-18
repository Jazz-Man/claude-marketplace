---
# cc-sdd-lpx9
title: marketplace-restructure
status: completed
type: epic
priority: normal
tags:
  - verdict-approved
  - decision-go
created_at: 2026-09-26T15:47:44Z
updated_at: 2026-09-27T12:00:51Z
---

Restructure the repo into a personal Claude Code plugin marketplace with sdd as the first plugin in its own subfolder.

Spec path: .sdd/specs/marketplace-restructure/
Description: Restructure the repo into a personal Claude Code plugin marketplace with sdd as the first plugin in its own subfolder.
Created: 2026-09-26

## Validation

- VERDICT: APPROVED - 2026-09-27, whole-branch review, package: workspace/review-package-final.md

## Parking lot

- Record 19b23fb's project-scope enabledPlugins emptying as a sanctioned deviation - user-scope enablement is the live mechanism; no action.
- Correct the review-package header's R098 attribution (README re-points, not a bean file) if that file is ever revisited.
- Run a later /sdd:steering sync to re-point .claude/rules/{product,tech,structure}.md payload paths to plugins/sdd/.

- DECISION: GO - 2026-09-27, validate-impl (fresh evidence: validate exit 0, full battery green, scratch smoke boot map-injection + 13 skills, integration/coverage/design/boundary all clean; carried notes: e2e not run - runbook absent, pre-adjudicated; 19b23fb project-scope enabledPlugins emptying - sanctioned, user-scope live; design Testing-Strategy validate-output overstatement - parked)

## Summary of Changes

Repository restructured into a local Claude Code plugin marketplace: 55-file pure-rename payload move into plugins/sdd/ (history preserved via follow), root marketplace.json re-pointed to ./plugins/sdd, CLAUDE.md layout/verification re-scoped with the prefix-mapping note, README re-pointed, registration re-added in place under sdd-local, fresh-session behavior proven (map injection + skills). 7/7 tasks approved round 1, zero fix loops; whole-branch review APPROVED, validate-impl GO. Parking lot carried on this bean and task beans.

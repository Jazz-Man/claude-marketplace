---
# cc-sdd-541b
title: "Task 15: docs wave — README, guides, CHANGELOG"
status: completed
type: task
priority: normal
created_at: 2026-09-23T12:12:38Z
updated_at: 2026-09-23T12:21:55Z
parent: cc-sdd-uwj4
---

Plan task 15: rewrite README (no npm/install/agent-table; /sdd:* usage, beans, models, stop-per-task); keep+update skill-reference/spec-driven/why-cc-sdd; delete command-reference, customization-guide, migration-guide, claude-subagents, docs/README/, docs/README.md index, docs/RELEASE_NOTES/; CHANGELOG reset; author field.

- [x] **Step 1: Apply.**
- [x] **Step 2: Verify** — greps 0 hits; `claude plugin validate .` passes (author warning gone, root-CLAUDE.md warning remains, accepted); guides dir = 3 files.
- [ ] **Step 3: STOP** — user reviews and commits.

## Summary of Changes

Docs wave: README full rewrite (no npm/install/agent-table; phase flow, single active feature, beans-vs-files, stop-per-task, model pins, 14-skill table matching workflow-map verbatim, bootstrap, execution internals, honest scope note); guides pruned to 3 keepers rewritten to fork reality (command-reference/customization/migration/claude-subagents + docs/README* + RELEASE_NOTES deleted); CHANGELOG reset to 0.1.0; plugin.json author added (validate warning gone). Review APPROVED — accuracy sweep 15/15 factual checks passed; 3 record-only nitpicks.

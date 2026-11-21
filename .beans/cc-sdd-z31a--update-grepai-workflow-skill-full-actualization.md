---
# cc-sdd-z31a
title: 'Update grepai-workflow skill: full actualization'
status: in-progress
type: task
priority: normal
created_at: 2026-11-21T14:55:21Z
updated_at: 2026-11-21T14:59:31Z
---

Full cycle per plugin-dev:skill-development: fact-check all references against live grepai source (post AST expansion + description fixes), rewrite stale content (chunking.md coverage, schema copy sync, search.md wording), add dispatch-contract section to SKILL.md from the 2026-11-21 behavioral tests (subagents need explicit dispatch demands), validate + skill-reviewer review.

## Parking lot

- Split grepai-workflow into two skills (setup/init vs search/usage) — user's idea, deferred until the whole investigation settles. Rationale: different audiences (owner-curated rare setup vs every-session search), sharper triggers per skill, leaner always-relevant surface.

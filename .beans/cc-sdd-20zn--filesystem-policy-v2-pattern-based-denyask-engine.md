---
# cc-sdd-20zn
title: Filesystem policy v2 — pattern-based deny/ask engine
status: completed
type: feature
priority: high
created_at: 2026-10-15T19:05:06Z
updated_at: 2026-10-16T19:30:48Z
---

Replace the strict outside-cwd filesystem policy with a pattern-based deny/ask engine per spec docs/superpowers/specs/2026-10-15-filesystem-policy-v2-design.md: sensitive-path tiers (Secrets/System/Settings/Git-internals/PersonalConfig), curated injection patterns, taint pair, intent table, 11-rule decision table; new tool channel Read|Edit|Write|NotebookEdit via hooks.json matcher; git hook subcommand deny in git-readonly; recommended-settings.json companion for global settings. Pattern source: tmp/pattern-source.md (mandatory reading, git-ignored).

- 2026-10-15: spec approved by owner; implementation plan written at docs/superpowers/plans/2026-10-15-filesystem-policy-v2.md (8 tasks, TDD, stop-per-task; execution: subagent-driven)

- 2026-10-16 session: Tasks 1-3 complete via subagent-driven flow (T1+T2 committed by owner; T3 in tree). T3 delivered intents.ts + scan-based intentOf + AST redirects + rows 5-11 + owner conventions (no reason tails, HOME const, Sets, inline exports). Ironclad model rule restored after violation: ALL reviews opus. Resume tomorrow at Task 4.

- Live smoke matrix complete (git-hook/Read-boundary/network denies verbatim; binary-ask correct; harness auto-allows ask under bypass — ask tier effective in normal modes only)

## Summary of Changes

Filesystem policy v2 shipped across 8 tasks (commits 33cb653..aa42216): module folder tiers/resolve/reasons/intents/guards/policy on the unbash-6 forEachChild walk; Cookie.parse/parseEnv token parsing with deny-unions at every level; HOME-union-projectRoot boundary + 6 sensitive tiers + macOS tiers; injection guards; 12-tool network blanket; sudo/PATH-rule/git-hook/inline-function denies; tool channel via anchored matcher; severityUnion verdict model (deny never shadowed by ask at units/args/candidates); exported reason constants; 446/0 tests, tsc/biome clean; plugin validated; live smoke matrix reproduced verbatim. Owner closed the epic at aa42216 — remaining known items live in beans cc-sdd-0ivz (env git push family) and cc-sdd-ovm3 (carrier hardening); ask-under-bypass documented as harness behavior.

---
# cc-sdd-mbzq
title: "Task 3: core/ast.ts — one unbash parse, two views"
status: scrapped
type: task
priority: normal
created_at: 2026-09-29T14:03:04Z
updated_at: 2026-09-29T14:12:31Z
parent: cc-sdd-ehph
---

Shared parseCommand in src/core/ast.ts per task-3-brief.md: units + words views over one unbash parse. TDD via tests/ast.test.ts.

## Notes

RED observed, but 2 of 8 brief tests fail against installed unbash 4.0.11 (verified by AST probes): (1) parse never throws on malformed input - it returns Script.errors; the unparseable test input parses leniently. (2) Command.suffix includes the subcommand word, so the quoted-args test input yields args with the subcommand included, contradicting the brief's own git-add expectation. (3) tsc TS2532 on units[0].args (noUncheckedIndexedAccess via @tsconfig/bun). Escalated to team-lead with proposed fixes A (errors check), B (optional chain), C1/C2 (args expectation).

## Reasons for Scrapping

Subagent-created tracker bean (unauthorized — dispatch contract says the controller owns tracking; the plan's home is the workspace ledger + cc-sdd-ehph). Its escalation note is preserved verbatim in the plan workspace ledger (progress.md, Task 3 ruling entry) and drove the controller ruling: A rejected (partial-AST walking is a deliberate security property), C1+B adopted, plan/spec fixed.

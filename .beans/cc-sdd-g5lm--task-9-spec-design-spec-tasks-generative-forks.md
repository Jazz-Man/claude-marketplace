---
# cc-sdd-g5lm
title: "Task 9: spec-design + spec-tasks generative forks"
status: completed
type: task
priority: normal
created_at: 2026-09-23T09:07:38Z
updated_at: 2026-09-23T09:25:04Z
parent: cc-sdd-uwj4
---

Plan task 9: rewrite both generative skills — frontmatter context:fork + background:false + model:opus; design (discovery classification, options-with-tradeoffs, mermaid consistency); tasks (static plan doc with header contract + task beans with blocked-by); confirm contracts.

## Summary of Changes

Two generative forked skills rewritten. spec-design: fork frontmatter, self-resolving from beans, full/light/skip discovery + LSP-first research, Considered Alternatives with trade-offs, mandatory mermaid with prose-consistency, review-gate <=2 passes, Return-contract with confirm owned by presenting context, supersede note over template conflicts. spec-tasks: static plan format with byte-verbatim executor header, Task Plan Review Gate, idempotent task-bean sync (create->parent->blocked-by) with numbering discipline, unparseable-children handling, write-plan-first crash recovery. Review APPROVED (D1 Bash/D2 Edit/D7 synthesis SOUND); F1+F3-F5 folded in fix round; re-review clean.

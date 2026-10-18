---
# cc-sdd-bqz1
title: Make biome fully clean under stricter preset (82 diagnostics to zero)
status: completed
type: task
priority: normal
created_at: 2026-10-01T11:33:20Z
updated_at: 2026-10-01T11:45:40Z
---

User tightened biome to preset:all then hand-tuned. Plan approved: wave 0 - src/index.ts becomes console.log placeholder (barrel dropped; future = per-hook entry points; spec §8 rewritten); wave 1 - biome check --write --unsafe auto-fixes (useBlockStatements etc.) + battery; wave 2 - manual fixes (useExportsLast, noTernary if/else rewrites, noIncrementDecrement, noContinue, noMagicNumbers, useTopLevelRegex, debug.ts unknown+rename); wave 3 - inline biome-ignore comments with reasons (fixture placeholders, wire-format keys, secret false positives, process.env designed channel, Bun global, visit complexity frozen); final: bun test 261/0 + tsc 0 + biome 0 errors/warnings/infos.

## Summary of Changes

101->0 diagnostics under the user's stricter preset (hand-tuned preset:all). Wave 0: src/index.ts -> console.log placeholder (barrel dropped per owner: future per-hook entry points; spec section 8 rewritten). Wave 1: biome --write --unsafe (block statements, method signatures). Wave 2 manual: runHook extracted to src/run-hook.ts with main.ts as thin stdin entry (owner mid-wave request; test import updated); ternaries -> if/else across src+tests incl. the reviewed narrowing idiom; continue inverted; depth -= 1; magic numbers -> named consts; TRAILING_SLASHES regex hoisted; debug.ts unknown+rename (broken biome-ignore removed); exports reordered last; duplicated classify doc comment deduped (T5 deferred minor). Wave 3: inline biome-ignore comments with reasons for wire-format keys, fixture placeholders, secret false positives, process.env channel, visit() complexity; user added Bun to biome globals making two ignores unnecessary (removed). Final: biome exit 0 with zero diagnostics, 261/0 tests, tsc exit 0.

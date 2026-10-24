---
# cc-sdd-w82p
title: 'lsp-proxy: clear biome 2.6.3 lint debt'
status: completed
type: task
priority: normal
created_at: 2026-10-24T20:09:33Z
updated_at: 2026-10-24T20:47:22Z
---

Owner enabled new biome rules (a385709 useExpect + 2.6.3 schema) hitting committed lsp-proxy code: 1 error (useExpect, architecture.integration.test.ts), 11 warnings (noConditionalExpect x10 config.test.ts, useArraySortCompare methods/index.ts), 4 infos (useNamedCaptureGroup x3, useThisInClassMethods; noAwaitInLoops = previously accepted baseline, attempt only if behavior-identical). Fix by restructuring code — NO biome-ignore suppressions, zero comments. Gates: repo-wide biome clean, bun test (165 pkg / repo), bun check --strict, build-bin.

## Summary of Changes

6 lsp-proxy files (+46/-28 net): useExpect assertion added to architecture.integration.test.ts; 10 noConditionalExpect restructured with early-return guards in config.test.ts (final form after owner correction: per-case local const errors, no helper); explicit UTF-16-identical comparator in methods/index.ts; 3 named capture groups; broadcast moved to module scope (useThisInClassMethods). proxy-requests.ts untouched (noAwaitInLoops = accepted baseline, unsuppressed: sequential-early-exit is askSequentially's contract). proxy.ts remains exactly 300 lines; zero comments/suppressions; build-bin rebuilt.

## Validation

Review APPROVED (opus, ma-lint-review2: changed-lines identity vs real diff, all expects verbatim, guards unreachable in non-failing state, comparator total-order identity, caps/hygiene confirmed) + owner correction round verified in-session: bun test packages/lsp-proxy 165/165, biome 1 baseline info only, bun check --strict clean, build-bin success.

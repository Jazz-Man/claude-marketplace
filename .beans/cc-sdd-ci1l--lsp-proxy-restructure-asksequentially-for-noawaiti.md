---
# cc-sdd-ci1l
title: 'lsp-proxy: restructure askSequentially for noAwaitInLoops error'
status: completed
type: task
priority: normal
created_at: 2026-10-24T21:24:49Z
updated_at: 2026-10-24T21:30:27Z
---

Owner raised lint/performance/noAwaitInLoops to error; the last baseline hit (proxy-requests.ts askSequentially for..of+await) now blocks the gate. Restructure to index-recursion preserving exact semantics: sequential asks in priority order, early-exit on first non-null/non-error outcome, null reply after exhaustion. No suppression, zero comments, 300/50 caps (file at 291). Gates: biome 0 findings, 165/165, strict, build-bin.

## Summary of Changes

askSequentially (proxy-requests.ts) restructured from for..of+await to index-recursion (askNext closure): strict priority order, first non-null/non-error outcome wins and stops the chain, null reply on exhaustion/empty list. Semantics identical; package now has ZERO biome findings under the owner's raised noAwaitInLoops=error config. No suppression, zero comments. File 291->297 lines, method 24.

## Validation

Implementer gates: biome 0, 165/165, strict clean, build-bin success. Review: APPROVED in-session by coordinator (labeled deviation — both reviewer spawns arrived tool-less per roulette memory); semantic identity, recursion bounds, no other await-in-loop, caps all verified.

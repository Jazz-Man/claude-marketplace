---
# cc-sdd-fkwy
title: 'lsp-proxy: simplify safeJsonParse signature'
status: completed
type: task
priority: low
created_at: 2026-10-22T15:43:35Z
updated_at: 2026-10-22T16:03:11Z
---

safeJsonParse<T = unknown> (guards/index.ts) — both live callers (framing.ts deliverBody, sync-extensions.ts mergeIntoLspJson) bind the default; the generic was added on owner request before any consumer existed. Decide: drop the generic or keep for a future typed call site. One-line change + strict + battery.

## Summary of Changes

Generic dropped 2026-10-22 (pq-fkwy-impl, sonnet, subagent): safeJsonParse(text: string): unknown, bare return JSON.parse(text) — no cast. Both callers compiled unchanged (they inferred unknown via the old default); zero test references to safeJsonParse in tests/ (grep), suite unmodified. Verified by coordinator: diff exactly +2/-2 in guards/index.ts. NOTE: subagent tool surface degraded (Read+Bash present, Edit/Write absent) — edit applied via sed -i, byte-exact.

## Validation

bun test 160/160 · biome clean · strict 0/86 · build-bin success.

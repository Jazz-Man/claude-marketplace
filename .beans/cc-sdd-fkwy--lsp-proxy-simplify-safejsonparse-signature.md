---
# cc-sdd-fkwy
title: 'lsp-proxy: simplify safeJsonParse signature'
status: todo
type: task
priority: low
created_at: 2026-10-22T15:43:35Z
updated_at: 2026-10-22T15:43:35Z
---

safeJsonParse<T = unknown> (guards/index.ts) — both live callers (framing.ts deliverBody, sync-extensions.ts mergeIntoLspJson) bind the default; the generic was added on owner request before any consumer existed. Decide: drop the generic or keep for a future typed call site. One-line change + strict + battery.

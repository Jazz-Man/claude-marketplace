---
# cc-sdd-9r14
title: 'lsp-proxy: parked audit line — keying, orphans, shutdown wait'
status: completed
type: task
priority: low
created_at: 2026-10-22T15:43:35Z
updated_at: 2026-10-22T16:12:19Z
---

Three parked behaviors from cycle reviews (justified then, worth one audit pass): (1) registerReply keyed by server name — a client initialize retry replaces the Downstream while the old child may still be alive; both children resolve under one key (Task 8 report); (2) mixed-boot failure — all spawns fire before Promise.all rejects, healthy children keep running after the -32603 reply (client-owns-lifecycle rationale); (3) shutdown after failed initialize waits ~30s for the broken entry's timeout (BASE was forever-hang; strictly better). Rulings and context: .superpowers/sdd/2026-10-22-lsp-proxy-production-quality/progress.md tasks 8-9.

## Summary of Changes

Read-only audit (pq-9r14-audit, opus, 2026-10-22; full report: .superpowers/sdd/2026-10-22-lsp-proxy-production-quality/bean-9r14-report.md). Verdicts: 1 ACCEPT (gen-guard holds against stale generations; residual modes bounded), 2 ACCEPT (fast -32603, no hang, harm = leaked processes + duplicate diagnostics), 3 ACCEPT (30s confirmed; client gets NO reply, not late — but no deadlock, session already failed). SHARP FINDINGS deferred with fixes sketched: FM1.3 orphan death tears down the CURRENT generation (onExit carries name only, proxy-server.ts:106-109 -> dropServer by name); FM1.4 global nextId vs per-server mux ids share one numeric space, broker-first routing can resolve a pending client request with an initialize payload (one-line offset fix at proxy-server.ts:50); transactional-boot (3-line catch-block drop) fixes FM1.2 + behavior 3 together. Flips to FIX-NOW only on: retrying client evidence, live FM1.4, or a second proxy consumer. Follow-ups tracked in the new hardening bean.

## Validation

bun test 160/160 · strict 0/86 (run on the analyzed tree).

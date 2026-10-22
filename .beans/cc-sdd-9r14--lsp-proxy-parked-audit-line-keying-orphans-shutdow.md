---
# cc-sdd-9r14
title: 'lsp-proxy: parked audit line — keying, orphans, shutdown wait'
status: todo
type: task
priority: low
created_at: 2026-10-22T15:43:35Z
updated_at: 2026-10-22T15:43:35Z
---

Three parked behaviors from cycle reviews (justified then, worth one audit pass): (1) registerReply keyed by server name — a client initialize retry replaces the Downstream while the old child may still be alive; both children resolve under one key (Task 8 report); (2) mixed-boot failure — all spawns fire before Promise.all rejects, healthy children keep running after the -32603 reply (client-owns-lifecycle rationale); (3) shutdown after failed initialize waits ~30s for the broken entry's timeout (BASE was forever-hang; strictly better). Rulings and context: .superpowers/sdd/2026-10-22-lsp-proxy-production-quality/progress.md tasks 8-9.

---
# cc-sdd-sk5c
title: 'lsp-proxy: generation-collision hardening (deferred FM fixes)'
status: todo
type: task
priority: low
created_at: 2026-10-22T16:12:19Z
updated_at: 2026-10-22T16:12:19Z
---

Deferred fixes from the cc-sdd-9r14 audit (all ACCEPT today; flip triggers: retrying client, live FM1.4, second proxy consumer). Full analysis + fix sketches: .superpowers/sdd/2026-10-22-lsp-proxy-production-quality/bean-9r14-report.md. (1) FM1.4 id-space collision — offset ServerSide.nextServerId start at a large constant (proxy-server.ts:50, one line) so global initialize/shutdown ids can never collide with per-server mux ids via broker-first routing; unit-test by pre-seeding a broker waiter at an initialize id. (2) FM1.3 orphan-death teardown — pass Downstream or a generation token into onExit closure (proxy-server.ts:106-109) and compare against the map entry before dropServer. (3) FM1.2 + shutdown-no-reply — transactional boot: catch block in handleInitialize drops all started servers via dropServer (proxy.ts:196-204, ~3 lines) — kills orphan accumulation AND the 30s shutdown wait (cleared map makes shutdownServers resolve immediately). Test inventory for all: bean-9r14-report.md section 4.

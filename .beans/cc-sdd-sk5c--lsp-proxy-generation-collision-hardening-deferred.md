---
# cc-sdd-sk5c
title: 'lsp-proxy: generation-collision hardening (deferred FM fixes)'
status: completed
type: task
priority: low
created_at: 2026-10-22T16:12:19Z
updated_at: 2026-10-22T16:55:51Z
---

Deferred fixes from the cc-sdd-9r14 audit (all ACCEPT today; flip triggers: retrying client, live FM1.4, second proxy consumer). Full analysis + fix sketches: .superpowers/sdd/2026-10-22-lsp-proxy-production-quality/bean-9r14-report.md. (1) FM1.4 id-space collision — offset ServerSide.nextServerId start at a large constant (proxy-server.ts:50, one line) so global initialize/shutdown ids can never collide with per-server mux ids via broker-first routing; unit-test by pre-seeding a broker waiter at an initialize id. (2) FM1.3 orphan-death teardown — pass Downstream or a generation token into onExit closure (proxy-server.ts:106-109) and compare against the map entry before dropServer. (3) FM1.2 + shutdown-no-reply — transactional boot: catch block in handleInitialize drops all started servers via dropServer (proxy.ts:196-204, ~3 lines) — kills orphan accumulation AND the 30s shutdown wait (cleared map makes shutdownServers resolve immediately). Test inventory for all: bean-9r14-report.md section 4.

## Summary of Changes

All three FM fixes landed 2026-10-22 (pq-sk5c-impl + fix round): FM1.4 id-offset (nextServerId = 1_000_000 — global initialize/shutdown ids can never collide with per-server mux ids under broker-first routing); FM1.3 generation token (onExit passes the Downstream instance; handleServerExit ignores stale exits before any mutation — before capabilities.delete/dropServer/sweep/recordDeath, so stale exits also never consume the two-death budget); FM1.2+§3 transactional boot (handleInitialize catch rejects+dropServers every map entry — orphan accumulation gone, shutdown-after-failed-boot resolves immediately with a null reply). 5 tests RED-first (FM1.4/FM1.3 units; mixed-boot fast -32603 + healthy child dead via ESRCH; failed-boot shutdown immediate; retry-twice zero live pids). REVIEW STORY: in-session review after 2 tool-less review dispatches (labeled deviation) — REJECTED one blocking: an openDocument 'compaction' changed semantics (malformed didOpen opened a phantom empty doc instead of skipping); fixed in round 1 (pq-sk5c-fix1) to the exact restored shape; scoped re-review APPROVED. Accepted gap: no pin for malformed-didOpen-skip — no clean test seam exists (openDocument is proxy.ts internal; harness is child-process; no in-process LspProxy seam) — candidate for future testability work.

## Validation

bun test 165/165 · biome clean + 1 known baseline info · strict 0/87 · build-bin success · proxy.ts 300/300 at cap · proxy-server 298/300 · zero comments.

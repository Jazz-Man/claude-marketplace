---
# cc-sdd-ls3i
title: Auto-detect pull diagnostics from initialize response (drop config flag)
status: completed
type: task
priority: normal
created_at: 2026-10-21T20:57:19Z
updated_at: 2026-10-21T21:00:03Z
parent: cc-sdd-hi1x
---

Replace ServerConfig.pullDiagnostics manual flag with auto-detection: servers declaring capabilities.diagnosticProvider in their initialize response get textDocument/diagnostic pulls on didOpen/didChange; remove stripPullDiagnostics and forwardedInitParams; forward client capabilities as-is.

## Summary of Changes

Replaced the manual ServerConfig.pullDiagnostics flag with LSP-spec auto-detection: a server whose initialize response declares capabilities.diagnosticProvider receives textDocument/diagnostic pulls on didOpen/didChange; its reply is synthesized into publishDiagnostics.

- config.ts: removed pullDiagnostics field, validation, and pass-through
- capabilities.ts: deleted stripPullDiagnostics + forwardedInitParams; client capabilities now forwarded as-is to all servers
- proxy-server.ts: new ServerSide.pullCapable(downstreams) derives pull capability from the stored capabilities map (single source of truth — reject/exit delete from it, respawn re-stores); respawn path forwards clientParams directly
- proxy.ts: forwards clientParams unmodified; filters live recipients through pullCapable before broker.pullDiagnostics
- proxy-requests.ts: broker.pullDiagnostics now takes live Downstream[] (didOpen/didChange gating retained)
- stub fixture: pullDiagnosticsMode -> declareDiagnosticProvider, drives the initialize declaration and no-push-on-didOpen
- tests: removed stripPullDiagnostics + pullDiagnostics config suites; integration test now proves detection (pull server never pushes, yet its diagnostics arrive); exact-count assertion guards against spurious pulls to push servers

Verified: bun test 70/70 (76 minus 6 intentionally removed), biome clean, bun check --strict 0 errors, build-bin success. No commits (human owns git).

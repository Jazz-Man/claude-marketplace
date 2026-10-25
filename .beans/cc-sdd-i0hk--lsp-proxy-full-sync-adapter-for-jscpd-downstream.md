---
# cc-sdd-i0hk
title: 'lsp-proxy: full-sync adapter for jscpd downstream'
status: completed
type: feature
priority: normal
created_at: 2026-10-25T22:14:57Z
updated_at: 2026-10-25T22:38:53Z
---

jscpd LSP declares textDocumentSync change:1 (Full) and is rejected by the incremental-only capabilities merge. Fix: merge accepts change 1 or 2 (advertised client contract stays Incremental); on didChange, full-sync recipients receive synthesized full-text contentChanges from DocumentStore (applied text); incremental recipients unchanged. Config side done by owner: args --lsp (default analyses clones) + .jscpd.json (semantic off, complexity/clones/deadCode on). Gates: pkg tests, biome, strict, build-bin; then live test on packages/lsp-proxy/src.

## Summary of Changes

Full-sync adapter: capabilities merge accepts textDocumentSync 1|2 (numeric or object), advertised client contract stays Incremental; src/sync-adapt.ts (new) synthesizes full-text contentChanges from DocumentStore post-apply for change:1 recipients on didChange; broadcastDocument wires per-recipient lookup; proxy.ts 300->295. Config by owner: jscpd args --lsp (analyses default clones), .jscpd.json (semantic off, ast 0.8, clones 100 tokens, complexity 15, deadCode, allFiles false).

## Validation

177/177 (+12 RED-first), biome 0, strict 95 files, build-bin deployed. Review APPROVED (opus: ordering pinned, mixed recipients both sides, C1/C2 ruled legit; minors: respawn race pre-existing/self-healing, unknown-doc passthrough unreachable). LIVE SMOKE PASS 2026-10-25: 3 servers spawned, jscpd accepted, merged diagnostics with (jscpd) tag — merge.ts renamed-code x2 (mergeTaggedArrays/mergePlainArrays 63 tok), framing.ts:102 vs framing.test.ts (50 tok); .jscpd.json thresholds filtering md-noise as configured.

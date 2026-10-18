---
# cc-sdd-6jwd
title: "Research: Claude Code multi-LSP handling per file type"
status: completed
type: task
priority: normal
created_at: 2026-10-05T21:09:36Z
updated_at: 2026-10-05T21:25:55Z
---

Workflow (sonnet subagents): how CC registers LSP servers (project/plugin/manifest), what first-registered-wins means for order, whether conflicts are per-extension-exclusive or per-capability (empirical: biome diagnostics on .ts owned by vtsls?), diagnostics routing; compare IDE multi-server models; practical guidance for sdd-local plugins. Output: docs/multi-lsp-collision-handling.md

## Validation

- Workflow wf_e538ac9c-f55: 4 sonnet agents (2 docs miners + 1 live experimenter + synthesizer), 318k tokens, ~14 min, zero errors. Doc: docs/multi-lsp-collision-handling.md (147+ lines), every rule sourced, conflicts surfaced not reconciled.
- Parent-session supplementary evidence added post-synth: (a) real-file test on vitest.config.ts - unsorted-keys edit pushed ONLY (ts)[2307] while biome CLI flags the same file; zero (biome) pushes for .ts - per-extension exclusivity confirmed on real content; file restored byte-identical (empty git diff). (b) main conversation received <new-diagnostics> for subagent-written probes - push surface is the main conversation regardless of editing agent; resolves the synth's subagent-silence caveat.
- Probe cleanup verified (no lsp-probe-* left).

## Summary of Changes

docs/multi-lsp-collision-handling.md created: registration sources + within/across-plugin order (cross-plugin order undocumented; empirically install-order, [Inference]); per-extension exclusivity with no fallback (decisive: plugin:biome-lsp:biome 'Method not found' on .json documentSymbol - no fan-out; real-file .ts test); no per-capability split (only diagnostics toggle); push model + main-conversation surfacing; subagent/-p/cloud facts; IDE comparison marked [Inference]; practical guidance for vtsls+biome-lsp partition (keep; narrow extensionToLanguage to .json/.jsonc/.css to silence the 6 notes if desired); 7 open questions [Unverified].

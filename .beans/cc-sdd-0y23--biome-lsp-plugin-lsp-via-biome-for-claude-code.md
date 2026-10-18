---
# cc-sdd-0y23
title: "biome-lsp plugin: LSP via biome for Claude Code"
status: completed
type: feature
priority: normal
created_at: 2026-10-05T20:52:51Z
updated_at: 2026-10-05T21:00:34Z
---

New plugin plugins/biome-lsp (.claude-plugin/plugin.json + .lsp.json wiring biome lsp-proxy for .ts/.tsx/.js/.jsx/.mjs/.cjs/.json/.jsonc/.css), marketplace.json entry, remove biome dup from project .lsp.json (tsgo-only), CLAUDE.md layout. Plan approved 2026-10-05. Key facts: plugin .lsp.json unwrapped at plugin root; validate does NOT read it; first-registered wins extension conflicts (order plugin-vs-project undocumented - verify empirically); command absolute /opt/homebrew/bin/biome (PATH shim broken).

## Progress

- plugins/biome-lsp created: .claude-plugin/plugin.json (manifest by sdd template), .lsp.json (biome lsp-proxy, absolute /opt/homebrew/bin/biome, full ext set .ts/.tsx/.js/.jsx/.mjs/.cjs/.json/.jsonc/.css), README (provides diagnostics/format/codeActions, NOT symbols/hover; no-deps note).
- marketplace.json: biome-lsp entry added, description pluralized.
- Project .lsp.json: biome entry removed (tsgo-only) per user decision - plugin is the single biome home.
- CLAUDE.md: intro + layout tree updated.
- claude plugin validate . PASS (2 plugins); all 4 JSON files valid; claude plugin install biome-lsp@sdd-local OK (user scope).
- Pending: user /reload-plugins, then verification matrix (.json diagnostics, .ts symbols preserved, /plugin Errors, .css first coverage).

## Validation (live, fresh session with plugin enabled)

- .ts symbols intact: documentSymbol on packages/agent-types/src/index.ts full tree (vtsls serves TS/JS family - first-registered-wins put it ahead of biome for .ts/.tsx/.js/.jsx/.mjs/.cjs; the 6 /plugin notes are the expected informational conflicts).
- .json diagnostics LIVE: unsorted-keys scratch file -> <new-diagnostics> [assist/source/useSortedKeys] (biome) arrived automatically; matches CLI ground truth.
- .css diagnostics LIVE: duplicate-property scratch -> <new-diagnostics> [lint/suspicious/noDuplicateProperties] (biome), severity error. First CSS coverage in this setup.
- Effective split: vtsls = TS/JS symbols+hover; biome = .json/.jsonc/.css diagnostics+format+codeActions. Outcome optimal.
- User edits kept in plugins/biome-lsp/.lsp.json: settings {goto_definition: true, require_config_file: true}. Caveat recorded: biome docs name the config-gating extension setting 'require_configuration' - whether 'require_config_file' is the wire name this integration reads is unverified; if gating does not behave, that is the first suspect.

## Summary of Changes

New plugin plugins/biome-lsp (manifest + .lsp.json wiring biome lsp-proxy, absolute binary path - PATH shim broken on this machine; README). marketplace.json: second entry + plural description. Project .lsp.json: biome entry removed (tsgo-only; biome's home is now the plugin, works across all projects). CLAUDE.md: intro + layout tree updated. claude plugin validate PASS.

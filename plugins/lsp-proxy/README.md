# lsp-proxy

One registered LSP for Claude Code that fans out to multiple downstream
stdio LSP servers (vtsls + biome by default) and merges their results:
diagnostics from every server, merged hover/completion/definition,
formatting by config priority.

## What it provides

- **Merged diagnostics** — findings from every downstream server arrive
  as a single server's `publishDiagnostics`.
- **Merged semantic requests** — hover contents joined, completion items
  concatenated, definition/references arrays concatenated.
- **Formatting** — first non-null answer in `lsp-proxy.config.json`
  priority order.

## Requirements

- `bun` on PATH at BUILD time only — the proxy ships as a standalone
  binary (`bun run build-bin` in `packages/lsp-proxy`), written to
  `~/.local/bin/lsp-proxy`.
- Downstream commands resolvable on PATH (verified 2026-10-20:
  `vtsls` → `~/.bun/bin/vtsls`, `biome` → `/opt/homebrew/bin/biome`).

## Maintenance

All downstream configuration — commands, extensions, initialization
options, settings — lives ONLY in
`packages/lsp-proxy/lsp-proxy.config.json` (array order = priority).
After editing it, regenerate the plugin's extension map:

    cd packages/lsp-proxy && bun run sync-extensions

The `.lsp.json` extension map is generated; never edit it by hand.
Closing a Claude Code session terminates the proxy through the protocol
`shutdown` request followed by SIGTERM; the proxy cascades that to its
downstream servers itself.

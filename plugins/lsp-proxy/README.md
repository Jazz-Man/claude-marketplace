# lsp-proxy

One registered LSP for Claude Code that fans out to multiple downstream
stdio LSP servers (vtsls + biome by default) and merges their results:
diagnostics from every server, merged hover/completion/definition,
formatting by config priority.

## What it provides

- **Merged diagnostics** — push diagnostics from every downstream server
  arrive as a single server's `publishDiagnostics`; servers that declare
  `diagnosticProvider` (pull model) are auto-detected and pulled after
  didOpen/didChange, results converted into the same push stream.
- **Merged semantic requests** — hover contents joined, completion items
  concatenated, definition/references arrays concatenated; server
  `error.data` passes through to the client.
- **Formatting** — first non-null answer in `lsp-proxy.config.json`
  priority order.
- **Code actions** — actions are tagged with their origin server;
  `codeAction/resolve` routes back to the originating server (first
  configured server as fallback).

## Liveness model

A downstream crash is a routine event, not a proxy failure:

- Pending requests on a dead server are swept with a synthetic error —
  the client always gets a reply; every request additionally carries a
  15 s timeout.
- The server respawns and open documents are replayed to it. A second
  death within 60 s gives up on that server; the counter resets after a
  stable minute.
- Initialize has a 30 s timeout and answers the client with an error
  instead of hanging on a broken command or a silent server; a failed
  boot kills everything it started, so a later `shutdown` replies
  immediately.
- A handler throw in either read loop (client or server side) is logged
  and dropped — the loop survives; frame-level garbage resyncs.
- An orphaned old generation's exit cannot tear down the live one
  (generation-guarded), and internal initialize/shutdown ids live in a
  separate numeric range from request ids.
- Exits are owned by `main.ts`: stdin close, SIGTERM, and the protocol
  `exit` notification all drain to the servers (SIGTERM, then SIGKILL
  after 2 s) and exit 0.

## Observability

`.lsp.json` enables file logging (`LSP_PROXY_LOG=1`); the log lands in
`~/.local/state/lsp-proxy.log`. The client's full initialize request is
logged on connect — its `capabilities` field is the authoritative answer
to "what does the Claude Code LSP client support" (hover, definition,
references, documentSymbol, callHierarchy, diagnostics; no completion,
codeAction, rename, or formatting).

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
The config is validated on load: a bad shape fails fast with collected
field-level errors. After editing it, regenerate the plugin's extension
map:

    cd packages/lsp-proxy && bun run sync-extensions

The `.lsp.json` extension map is generated; never edit it by hand.

## Development

Source lives in `packages/lsp-proxy/src` (165 tests, `bun test`):

- `guards/ constants/ types/ utils/` — shared primitives: validation
  guards, error codes, timeouts, priority sort
- `boundary.ts` — parse-and-narrow helpers for client params
- `methods/` — the single per-method policy registry (capability,
  merge, fan-out, pull triggers)
- `config/` — validating config classes (fail-fast constructor,
  collected-errors parse path)
- `framing.ts docstore.ts mux.ts merge.ts capabilities.ts` — pure
  protocol cores
- `proxy.ts proxy-server.ts proxy-requests.ts downstream.ts` —
  process/session orchestration
- `main.ts` — entrypoint; owns process exits and the log lifecycle

Gates for any change: `bun test`, `rtk proxy biome check
packages/lsp-proxy --write`, `bun check --strict`,
`bun run build-bin`. House rules: zero comments in source, biome
preset "all" (sorted keys, 300-line file cap, 50-line function cap),
and all existing tests stay green.

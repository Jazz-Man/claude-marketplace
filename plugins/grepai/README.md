# grepai

The grepai semantic code search as a Claude Code plugin: the grepai MCP
server (`grepai mcp-serve`) plus one skill, `grepai-workflow`.

## What it provides

- **MCP server** — `grepai-api` exposing search, trace (callers/callees/
  graph), refs, and index-status tools against the project's grepai index.
- **grepai-workflow skill** — per-project setup (config `ignore` defaults,
  `.grepaiignore` dependency curation with `!` negations, `search.boost`
  shaping), intent-shaped search doctrine with a mandatory "already exists"
  pre-check before building, and the LSP synergy matrix: grepai discovers,
  LSP verifies, Read reads only the verified range.

## Requirements

- `grepai` CLI on PATH (`go install github.com/yoanbernabeu/grepai@latest`
  or the project's install docs). The plugin wires the CLI as an MCP server;
  it does not install it.
- An embedding backend reachable at search time (default: local Ollama).

## Per-project state

Everything grepai needs lives in the target project (`.grepai/config.yaml`,
`.grepaiignore`, the index) — this plugin carries no runtime state of its
own.

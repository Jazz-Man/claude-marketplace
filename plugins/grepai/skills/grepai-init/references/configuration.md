# grepai configuration reference

Scope: a solo-developer profile — local Ollama embedder, GOB store, one
machine. The machine truth is `references/config.schema.json` in this
skill; this file is the prose map. Anything not covered here is in the
schema.

Config lives at `.grepai/config.yaml`, written by `grepai init` (which also
offers inheriting the config from a detected git worktree's main checkout).
Most options are optional at load —
but a missing `search:` section leaves boost and dedup off (see
pitfalls), and an empty `provider` errors at runtime. Unknown YAML keys
are silently ignored by grepai itself (the schema flags them as typos).

## The solo baseline

```yaml
version: 1
embedder:
  provider: ollama
  model: bge-m3
  endpoint: http://localhost:11434
  dimensions: 1024              # MUST match what the model returns
  request_timeout_seconds: 60   # raise for a shared/slow GPU
store:
  backend: gob                  # .grepai/index.gob, per-project
chunking:
  size: 512
  overlap: 50
  strategy: ast                 # needs a treesitter build; else falls back to fixed
search:
  boost:
    enabled: true               # keep the rule lists non-empty — see pitfalls
  hybrid:
    enabled: true               # default is false; see the cost note
  dedup:
    enabled: true
trace:
  enabled_languages: [".ts", ".tsx", ".js", ".jsx"]   # this project's languages
rpg:
  enabled: true                 # default is false; the index builds the graph
external_gitignore: ~/.gitignore   # the owner's global gitignore
```

`grepai init --yes` writes nomic-embed-text at 768d with `fixed` chunking
and hybrid off; the baseline is four edits away: `embedder.model`,
`embedder.dimensions`, `chunking.strategy`, `search.hybrid.enabled`.

## embedder

- `provider`: ollama | lmstudio | openai | synthetic | openrouter | requesty.
  An empty value is NOT auto-filled — only `grepai init` writes the
  provider; an empty string fails at runtime with
  `unknown embedding provider`.
- `model`: per-provider defaults differ (ollama: nomic-embed-text 768d;
  bge-m3 returns 1024d — set `dimensions` to match).
- `dimensions`: the embedder identity — provider+model+dimensions, with the
  endpoint deliberately excluded — is recorded in
  `.grepai/index-meta.json`; a mismatch triggers a rebuild. Local providers
  default to 768 when unset.
- `parallelism`, `max_retries`, `max_batch_size`, `max_batch_tokens`:
  consumed ONLY by the openai provider — ollama silently ignores them.
- `api_key`: local providers ignore it; cloud providers resolve from env
  (OPENAI_API_KEY and per-provider fallbacks) — but an env key is only sent
  to the provider's OFFICIAL endpoint; a custom endpoint requires an
  explicit `api_key` (embedder/env_key.go guards this). Rotating a key does
  NOT invalidate the index (excluded from the cache namespace).
- `request_timeout_seconds`: default 60s (synthetic hardcodes 90s);
  consumed by all providers except requesty — the one tuning knob that
  matters for slow self-hosted Ollama.

## store

- `backend: gob` — single file `.grepai/index.gob`, per-project, not
  shareable. This is the solo default.
- `postgres` (pgvector, `dsn`) and `qdrant` (gRPC, port 6334, TLS/api_key for
  Cloud) exist for teams and shared workspaces — and workspaces REJECT gob
  (file-based stores cannot be shared).

## chunking

- `size` (tokens, default 512; with strategy=ast converted to non-whitespace
  characters), `overlap` (default 50; unused by ast).
- `strategy`: fixed (sliding window) | ast (syntax-tree split; covers ~30
  tree-sitter languages — the authoritative list is the `strategy` enum's
  description in the schema and references/chunking.md; everything else
  falls back to fixed; requires a treesitter-tagged build, otherwise warns
  and falls back).
- `max_file_size_bytes`: per-file indexing cap, default 1048576 (1 MB);
  takes effect after a re-index (and a watch-daemon restart). Minified and
  binary files stay excluded unconditionally.
- `custom_extensions`: extra indexed extensions, each with a leading dot
  (e.g. `.tengo`); binary detection still applies.

## framework_processing

Node-based preprocessing of single-file components before chunking (line
numbers remapped back). Only Vue has a real compiler; svelte/astro/solid are
scaffolds (auto = passthrough, require = fail). `mode`: auto | require |
off; `node_path` defaults to `node`. `enabled: false` forces off.

## watch

- `debounce_ms`: 500 default, groups rapid edits before reindexing.
- `rpg_persist_interval_ms` (>=200), `rpg_derived_debounce_ms` (>=100),
  `rpg_full_reconcile_interval_sec` (>=30), `rpg_max_dirty_files_per_batch`
  (>=1): validated AT CONFIG LOAD — an invalid value breaks every command,
  not just watch.
- `last_index_time`: INTERNAL — grepai reads and rewrites it; never edit.
- `discover_worktrees`: default true — watch auto-initializes linked git
  worktrees; only the main worktree's config is consulted.

## search

- `boost`: path-based score multipliers applied after retrieval, before
  ranking — reorder-only, never a filter. Rules: case-sensitive substring on
  the project-relative path with a leading `/` prepended; factors multiply
  cumulatively; <1 penalizes, >1 promotes. Shipped defaults penalize tests
  (x0.5), mocks/fixtures/generated (x0.4), docs (`.md`, `/docs/` x0.6) and
  bonus `/src/`, `/lib/`, `/app/` (x1.1). A custom list REPLACES the
  defaults — append, don't replace.
- `hybrid`: vector + word-overlap fused via Reciprocal Rank Fusion
  (`k`, default 60). Default OFF. Works on every backend but loads ALL
  chunks through the store to score them — fine on a solo gob index,
  costly on large ones.
- `dedup`: default true — keeps only the best chunk per file (over-fetches
  4x, then collapses).

## trace

Only `enabled_languages` exists (extensions with a leading dot; empty =
shipped default). The regex extractor covers .go .js .ts .jsx .tsx .py
.php .lua .c .h .zig .rs .cpp/.hpp/.cc/.cxx/.hxx .java .cs .pas .dpr .fs
.fsx .fsi .gd .rb — and it is the only extractor wired into indexing: a
tree-sitter symbol extractor also exists in the source, but no command
selects it; symbols always come from the regex extractor.
`.vue` works through framework_processing. Extensions outside extractor
coverage are indexed but yield no symbols.

## rpg

Repository Program Graph (`.grepai/rpg.gob`) — hierarchy with
invokes/imports/semantic edges, queried via rpg search/fetch/explore.
Default OFF. `feature_mode`: local (heuristics) | hybrid | llm (an
OpenAI-compatible chat model at `llm_endpoint`; empty `llm_model` falls
back to local with a warning). When enabled: `drift_threshold` 0.0–1.0
(literal 0 resets to 0.35), `max_traversal_depth` 1–10; violations reject
the whole config at load. `feature_group_strategy`: sample | split.

## ignore and external_gitignore

`ignore` entries are layered on top of every `.gitignore` in the project
and compile as root-level gitignore patterns; a nested `.grepaiignore`
can re-include (override) even these entries. The layer semantics, the
shipped default list, and the owner-curation rule live in
references/ignore.md — the prose home for everything ignore.

`external_gitignore`: path to one more gitignore applied from the project
root (supports `~`); a missing file only warns.

The ignore layer excludes files from BOTH indexes at once — the vector
search index and the trace symbol index.

## Solo pitfalls

1. `dimensions` mismatch with the model → embedder identity mismatch →
   index rebuild. bge-m3 = 1024.
2. A missing `search:` section means boost and dedup are OFF — search has
   no load-time defaults; keep the block that `grepai init` wrote.
3. Empty `penalties:`/`bonuses:` lists are not "use defaults" — they are
   an empty rule set; boost becomes a no-op.
4. Changing embedder model or dimensions requires a full reindex; changing
   boost rules does not (applies to the next search).
5. watch `rpg_*` keys are validated at config load — one bad value breaks
   every grepai command.
6. gob is per-project and not shareable; multi-project workspaces require
   postgres or qdrant.

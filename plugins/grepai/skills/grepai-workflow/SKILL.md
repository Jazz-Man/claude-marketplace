---
name: grepai-workflow
description: Set up and work with grepai semantic code search — configure the index for the project (ignore defaults, .grepaiignore dependency curation, search boost), run intent-shaped searches, and combine grepai with LSP into one discovery workflow. Use when initializing grepai in a project, before building new functionality to check whether it already exists, for natural-language questions about the codebase ("how does this project use X", "what implements the framing logic"), for questions about a curated dependency's source, or when no LSP server covers the language.
---

# grepai workflow — semantic search configured per project, working with LSP

grepai embeds the codebase into a searchable index. LSP answers exact symbol
questions (definition, references, types); grepai answers intent questions and
works with no language server at all. The two compose: grepai discovers,
LSP verifies.

## Setup (first run in a project)

1. Run `grepai init` — it writes `.grepai/config.yaml`.
2. `ignore` entries are root-level gitignore patterns (no slash — match at
   any depth; leading slash — anchored), layered on top of every
   .gitignore; the file's list is the effective list verbatim — nothing
   merges at runtime, so keep the defaults `grepai init` wrote and append
   to them. `.grepaiignore` negations override config ignore entries (a
   deeper .gitignore can still win).
3. Curate dependency sources with `.grepaiignore` — gitignore syntax, where
   `!` re-includes: JS/TS `!node_modules/<lib>/`, PHP `!vendor/<lib>/`.
   A pattern without a leading slash matches the directory name at ANY depth
   (including versioned store copies like node_modules/.bun/<lib>@1.2.3/…),
   so anchor or version-pin when duplicates matter; after a negation, exclude
   sub-paths you do not want (`!node_modules/<lib>/` then
   `node_modules/<lib>/docs/` keeps only the source).
4. Shape `search.boost`: keep the default rules and add project penalties
   (factor < 1.0) and bonuses (factor > 1.0). Factors multiply cumulatively
   per matched path, applied after similarity — boost REORDERS candidates,
   it never filters or adds files.
5. Index: `grepai index` for a one-shot build, `grepai watch` for a daemon
   that re-indexes on edits.
6. Rust/Go honesty: dependencies live in global caches outside the project
   tree (~/.cargo/registry, $GOPATH/pkg/mod) — negations cannot reach them.
   Skip dependency indexing there and say so; LSP and text search remain.

Verify the setup with a semantic query you can ground-truth; if a curated
library does not surface, check the ignore layers in order: .gitignore →
.grepaiignore → config `ignore`.

## Searching

- Query by intent, not by identifier: "where does the proxy parse incoming
  frames" beats "framing".
- MCP tools (this plugin's server): `grepai_search` (natural-language query,
  optional path prefix, compact mode), `grepai_trace_callers` /
  `grepai_trace_callees` / `grepai_trace_graph` for call structure,
  `grepai_index_status` for index health.
- Before building anything new, run a mandatory pre-check pass —
  "what already exists like this" — and reuse what it finds; duplicated
  functionality found later costs far more than the search.
- Dependency questions: curated libraries are indexed, and boost ranks their
  source above their docs — trust the indexed source over memory or guesses
  about the library's API.

## Synergy with LSP

Pick the tool by question type:

| Question | First tool |
|---|---|
| Exact symbol: definition, references, type, implementations (LSP exists) | LSP (apply the lsp-code-analysis skill where present) |
| Intent / architecture / "does this already exist" | grepai search |
| How a curated dependency works internally | grepai (indexed source) |
| Call structure in a language with no LSP server | grepai trace_callers / callees |
| String literals, comments, config values | text Grep |

The composing flow: grepai DISCOVERS candidates → LSP VERIFIES precisely
(coordinates, types) → Read only the bounded range that verification points
to. Never re-verify a classified non-empty LSP result with a text sweep —
cross-tool flow means each tool covers what the other cannot, not double
work.

## References

- **`references/configuration.md`** — full configuration map for the solo
  profile (Ollama embedder, GOB store): every section, defaults, and the
  pitfalls that break indexes. Read it when setting up or editing
  `.grepai/config.yaml`.
- **`references/search.md`** — how to search through MCP: intent-vs-identifier
  query craft, tool-call shapes (path scoping, compact economy pattern),
  reading RANKS instead of absolute score thresholds, iterative refinement,
  and the stale-index/ignore-layer checks behind "no results". Read it
  before writing the first query.
- **`references/ignore.md`** — the five ignore layers and the curation
  craft: .gitignore → .grepaiignore negations → config `ignore` →
  external_gitignore → built-ins; name-vs-anchored pattern semantics,
  dependency re-inclusion recipes, the ignore-vs-boost division, and the
  re-index requirement. Read it when setting up ignore or curating
  dependencies.
- **`references/trace.md`** — call-graph tools through MCP: the symbol-index
  prerequisite, tool-call shapes, the VERIFIED trust profile (call_site
  coordinates are exact; enclosing-symbol attribution and graph caller-side
  are not), language coverage, and the refs family for JS/TS property
  access. Read it before any who-calls/what-it-calls question.
- **`references/search-boost.md`** — ranking rules: mechanics (reorder-only,
  cumulative, config-only), pattern semantics, shipped defaults, the
  curation-interplay rule (never penalize what `.grepaiignore` curated in),
  project recipes, and the pitfalls. Read it before editing `search.boost`.
- **`references/chunking.md`** — how files split into chunks: the `fixed`
  window strategy with tuning tables, the `ast` syntax-aware strategy
  (active in this build — treesitter + CGO), custom extensions, and the
  re-index rule after any chunking change. Read it before touching
  `chunking:` in the config.
- **`references/config.schema.json`** — the machine truth for the config,
  generated from grepai source (v1.1.0 + 2026-10-28). Consult it for any
  key not covered in the prose reference, or to validate a config shape.

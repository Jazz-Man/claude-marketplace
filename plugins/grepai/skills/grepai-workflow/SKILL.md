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
2. `ignore` in that file compares by NAME (not glob), and setting the list
   REPLACES the defaults (.git, node_modules, vendor, bin, dist, …) — start
   from the defaults and append project-specific names.
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

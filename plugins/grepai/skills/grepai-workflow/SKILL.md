---
name: grepai-workflow
description: Set up and work with grepai semantic code search — configure the index for the project (ignore defaults, .grepaiignore dependency curation, search boost), run intent-shaped searches, and combine grepai with LSP into one discovery workflow. Use when initializing grepai in a project, before building new functionality to check whether it already exists, for natural-language questions about the codebase ("how does this project use X", "what implements the framing logic"), for questions about a curated dependency's source, or when no LSP server covers the language.
---

# grepai workflow — semantic search configured per project, working with LSP

grepai embeds the codebase into a searchable index. LSP answers exact
symbol questions (definition, references, types); grepai answers intent
questions and works with no language server at all. The two compose:
grepai discovers, LSP verifies.

## Setup (first run in a project)

1. `grepai init` — writes `.grepai/config.yaml` (embedder and store are
   settled for this workflow: local Ollama, GOB backend).
2. Shape the ignore layers and curate the dependency sources worth
   trusting — the five layers, negation craft, and the Rust/Go honesty
   rule: references/ignore.md.
3. Shape `search.boost` ranking — rules, defaults, and the
   curation-interplay rule: references/search-boost.md.
4. Never run indexing or watching yourself — the owner builds and maintains
   the index (`grepai index` / `grepai watch`); after any change that
   requires a re-index (ignore layers, chunking, embedder identity, the RPG
   graph), your job is to SAY so, not to run it.
5. Verify with a ground-truth query; if a curated library does not
   surface, walk the ignore layers in order.

The full config map and the solo pitfalls: references/configuration.md.
Chunking (the `ast` strategy is active in this build):
references/chunking.md.

## Searching

Query by intent, not identifier ("where does the proxy parse incoming
frames", not "framing"). Tool map:

- `grepai_search` — semantic search, path scoping, compact economy mode
- `grepai_trace_callers` / `_callees` / `_graph` — call structure
- `grepai_rpg_search` / `_fetch` / `_explore` — feature orientation
  (word-overlap queries, not embeddings)
- `grepai_index_status` — index health; a stale index explains "missing"
  code

Before building anything new, run the "what already exists like this"
pre-check and reuse what it finds; for a curated dependency, trust the
indexed source over memory. Query craft, score reading, and refinement
protocols: references/search.md, references/trace.md,
references/rpg.md.

## Synergy with LSP

| Question | First tool |
|---|---|
| Exact symbol: definition, references, type, implementations (LSP exists) | LSP (apply the lsp-code-analysis skill where present) |
| Intent / architecture / "does this already exist" | grepai search |
| Which feature does this belong to / what sits around it | grepai RPG (fetch/explore) |
| How a curated dependency works internally | grepai (indexed source) |
| Call structure in a language with no LSP server | grepai trace_callers / callees |
| String literals, comments, config values | text Grep |

The composing flow: grepai DISCOVERS candidates → LSP VERIFIES precisely
(coordinates, types) → Read only the bounded range that verification
points to. Never re-verify a classified non-empty LSP result with a text
sweep — cross-tool flow means each tool covers what the other cannot, not
double work.

## References

- **configuration.md** — the config map for the solo profile and its pitfalls
- **ignore.md** — five ignore layers, curation craft, ignore-vs-boost division
- **search.md** — query craft, score bands, refinement, the no-results ladder
- **search-boost.md** — ranking rules, shipped defaults, their reorder-only limits
- **chunking.md** — fixed vs ast strategies, tuning tables, the re-index rule
- **trace.md** — call graphs: verified trust profile, language tiers, refs
- **rpg.md** — the feature graph: word-overlap search, node IDs, edge types
- **config.schema.json** — the machine truth for the config

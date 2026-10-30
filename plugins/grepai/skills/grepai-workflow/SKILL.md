---
name: grepai-workflow
description: This skill should be used when the user asks to "set up grepai" or configure it (.grepaiignore, search boost), mentions the grepai tools (grepai_search, trace, rpg), or needs any code discovery that is not an exact symbol lookup — natural-language codebase questions ("what implements the framing logic"), pre-build "does this already exist" checks, curated-dependency internals, call structure where no LSP server covers the language, feature orientation ("which feature does this belong to"). grepai discovers, LSP verifies.
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
   rule: references/ignore.md. The ignore list is the OWNER's curation:
   `grepai init` defaults are a starting point the owner may prune — never
   re-add entries the owner removed; a shorter list is usually intentional
   (the .gitignore layers still cover the big trees).
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
frames", not "framing"). Default call shape — the token-economy contract:
`compact: true` and `limit: 3-5` on every search; fetch content ONLY for
the winning hit via a bounded Read; stop at the score cliff (a gap means
the answers above it are all there are). Whole-file reads stay correct
only for comprehension-shaped tasks or small files (~under 150-200 lines);
after LSP/trace coordinates, read the symbol span, not from line 1.
Tool map:

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

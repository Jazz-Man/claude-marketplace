# grepai RPG reference (MCP-only)

Scope: the Repository Planning Graph — a feature-level overlay on top of
the symbol index and vector chunks. Search answers "which code matches
this intent"; RPG answers "which FEATURE does it belong to, and what sits
around it". It groups code into a hierarchy (area → category →
subcategory → file → symbol → chunk) and links nodes with typed edges.

Enabled in config (`rpg.enabled` — default off), stored in
`.grepai/rpg.gob`, built from the same languages as trace
(`trace.enabled_languages`). `grepai_index_status` shows `rpg_enabled`
plus node and edge counts. Failing states: "RPG is not enabled or index is
empty" (enable + build), or an outdated-graph error after a grepai upgrade
(rebuild the graph).

## The query craft is the opposite of semantic search

`rpg_search` scores by WORD OVERLAP (Jaccard) between the query and
feature labels / symbol names — no embeddings. Query with the words that
appear in names: "command line search flow", not an intent description.
An embedding-style phrase scores zero here; an identifier-style word list
scores well — the exact opposite of references/search.md.

```
grepai_rpg_search { query: "frame encoding", limit: 5 }
grepai_rpg_search { query: "callers trace", kinds: "symbol,file", scope: "cli" }
```

- `kinds` — comma-separated from area, category, subcategory, file,
  symbol, chunk. DEFAULT IS `symbol`: files, areas and categories stay
  invisible unless requested.
- `scope` — feature-path prefix filter (e.g. `cli`, `rpg/query`).
- Results carry the node ID — the handle for fetch and explore.

## Node IDs

| Kind | ID | Example |
|---|---|---|
| symbol | `sym:<path>:<name>` (methods: `sym:<path>:<Receiver>.<name>`) | `sym:cli/search.go:runSearch` |
| file | `file:<path>` | `file:cli/search.go` |
| area / category / subcategory | `area:<name>` / `cat:<area>/<name>` / `subcat:<parent>/<name>` | |
| chunk | `chunk:<chunk-id>` | |

## fetch — one node in full context

```
grepai_rpg_fetch { node_id: "sym:cli/search.go:runSearch" }
```

Returns the node's hierarchy parents (symbol → file → subcategory →
category → area), its edges, and a code preview — the fastest way to
answer "what feature is this file/symbol part of".

## explore — neighborhoods, not exact call graphs

```
grepai_rpg_explore { start_node_id: "sym:cli/search.go:runSearch", depth: 2 }
```

Breadth-first walk with `direction` (forward | reverse | both), `depth`,
`limit`, and `edge_types` filtering:

| Edge type | Meaning |
|---|---|
| `feature_parent` | hierarchy node to its child |
| `contains` | file to the symbols it defines |
| `invokes` | symbol calls symbol |
| `imports` | file imports file/package |
| `maps_to_chunk` | symbol to the vector chunk holding its code |
| `semantic_sim` | symbols with similar features or call patterns |

Explore is the ORIENTATION tool — "what sits around this node". For exact
caller/callee coordinates use trace (references/trace.md); explore trades
precision for neighborhood breadth.

## Feature labels and modes

`feature_mode: local` derives verb-object labels ("validate token") from
symbol names with heuristics — fast, deterministic, and occasionally
keyword noise (a file's feature may read like "operate if" when its
dominant symbols are control flow). `llm` / `hybrid` ask an
OpenAI-compatible chat model instead (`llm_endpoint`, `llm_model`; both
currently behave the same and fall back to local on error or when the
model is unset). Treat feature paths as NAVIGATION structure, not as
semantic truth about the codebase.

`drift_threshold` (0.0–1.0) controls how much a file's features must
change before it moves in the hierarchy during incremental updates;
`feature_group_strategy` (sample | split) trims oversized `semantic_sim`
groups.

## Integration with the rest

With RPG enabled, `grepai_search` results and trace symbols carry their
`feature_path` — a one-field answer to "which feature is this from" on
every hit, no extra call.

The composing loop: search locates the chunk → `rpg_fetch` on the symbol
places it in the feature hierarchy → `rpg_explore` (semantic_sim, invokes)
surveys the neighborhood → trace or LSP verifies exact relationships.

## Pitfalls

1. Embedding-style intent queries return nothing — word overlap wants the
   names' words.
2. `kinds` defaults to `symbol`: to browse structure, ask for
   `file`, `subcategory`, or `area` explicitly.
3. Feature labels are heuristic (or LLM-guessed) — navigation aid, never
   documentation.
4. RPG covers only trace-enabled languages; config/markup files have no
   nodes even when indexed for search.

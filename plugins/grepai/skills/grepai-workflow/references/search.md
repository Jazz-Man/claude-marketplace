# grepai search reference (MCP-only)

Scope: how to find information with the grepai MCP server. Every example is
an MCP tool call — the CLI is not part of this workflow. The main tool is
`grepai_search`; `grepai_index_status` guards against searching a stale
index.

## The mindset: intent, not identifier

Semantic search matches MEANING. It is for when you do not know the exact
name — the exact-name cases belong to text Grep or LSP (see the synergy
matrix in SKILL.md).

| Wrong (identifier) | Right (intent) |
|---|---|
| `getUserById` | fetch user record from database by ID |
| `handleError` | error handling and response to client |
| `auth` | user authentication middleware |
| `parse` | parse JSON request body |

Query rules: describe what the code DOES, not what it is called; 3-7
descriptive words; English always (embedding models are English-first);
question phrasing works ("how are users authenticated"); no code syntax; do
not over-specify implementation details ("async function using axios" —
just "fetch data from external API").

## Tool calls

Health check before blaming the query — a stale index explains "missing"
code:

```
grepai_index_status { root: "<project>" }
```

Watch `total_files`, `last_updated` (versus how recently the code changed),
and `symbols_ready` for the structure tools.

Basic search — full chunks with content:

```
grepai_search { root: "<project>", query: "validate user credentials" }
```

Scoped to a subtree — `path` keeps only results whose project-relative path
starts with the prefix:

```
grepai_search { root: "<project>", query: "retry failed requests", path: "packages/api/" }
```

Token-economy pattern for agents — `compact: true` drops the content field
and returns the map (score, file, line range); use it to locate, then Read
only the bounded range of the best hit:

```
grepai_search { root: "<project>", query: "frame encoding", compact: true, limit: 5 }
```

`limit` (default 10) — 3-5 while iterating, 15-20 when surveying. `format`:
`json` (default) or `toon` (token-oriented, roughly half the JSON size).
`workspace` + `projects` scope a search across a configured multi-project
workspace.

## Reading results

Each result carries score, file, start/end lines, the chunk content, and —
with RPG enabled — symbol_name / feature_path hints.

**Read ranks, not absolute thresholds — verified, not folklore.** The score
scale depends on BOTH the embedding model and the scoring path:

- Raw bge-m3 cosine similarity for code lives in a narrow, high-biased band:
  ~0.46 for unrelated code, ~0.53 for a perfect intent match, 1.0 only for
  identical text (measured 2026-10-28 via the Ollama embed endpoint). The
  "0.9 = excellent match" bands from generic docs are unreachable on this
  model.
- With `search.hybrid.enabled: true` (this setup, k=60), grepai reports
  Reciprocal Rank Fusion scores instead: a top rank in both lists lands
  around 1/61 + 1/61 ≈ 0.033, one list ≈ 0.016 — exactly the small values
  a perfect hit actually returns.

To verify any model's scale yourself, embed the pair directly and take the
cosine — one call to the Ollama endpoint:

```
POST http://localhost:11434/api/embed
{"model": "bge-m3", "input": ["<query>", "<chunk text>"]}
```

What carries signal within one result set: the ORDER (boost-shaped — see
references/search-boost.md), the RELATIVE gap between adjacent scores (a
cliff after the third hit means three real answers), and whether the same
file returns with multiple chunks.

## Iterative refinement

1. Broad intent query, limit 5, compact — survey the landscape.
2. If ranks look off-topic, add context words ("JWT token validation
   middleware", not "authentication").
3. Scope with `path` when the answer must live in one subtree.
4. Try one synonym round ("credential validation" vs "user login
   verification") — semantic recall varies with phrasing.
5. Still nothing: `grepai_index_status` (stale index?), simpler query, then
   the ignore layers (is the file indexed at all?) — a file the index never
   saw is invisible to every query.

## Patterns that recur

- Behavior: "retry failed HTTP requests", "send notification when order is
  placed", "cache frequently accessed data".
- Entry points: "application startup", "HTTP server initialization".
- Error paths: "catch and log exceptions", "error response to client".
- Config: "load configuration from environment", "database connection
  settings".
- The anti-DRY pre-check before building anything new: "existing
  implementation of <intent>" — cheap, and the duplicate it prevents costs
  far more.

## Pitfalls

1. Exact identifiers as queries — wasted call; that is Grep/LSP territory.
2. Absolute score thresholds as quality gates — model-relative noise; use
   ranks and gaps.
3. Judging freshness by memory — check `last_updated` in index status.
4. Analyzing code from `compact` output — it has no content; it is a map,
  not a source. Read the pointed range.
5. Empty result ≠ nonexistent code — it can mean "not indexed" (ignore
   layers) or "stale index". Rule those out before concluding absence.

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

Token-economy contract — the DEFAULT, not an option: `compact: true`
drops the content field and returns the map (score, file, line range);
locate with the map, then Read only the bounded range of the WINNING hit.
Full-content search results are the single largest avoidable token spend:
they dump several whole chunks where one bounded Read of the winner
suffices at equal or better precision:

```
grepai_search { root: "<project>", query: "frame encoding", compact: true, limit: 5 }
```

When a WHOLE-FILE read is still the economical choice — two legitimate
cases: (a) the task is comprehension-shaped (evaluate a module for reuse,
explain how it works) — the module itself is the answer, so its full span
is the bounded range; (b) the file is small (~under 150-200 lines) —
slicing costs more calls than it saves. For lookup-shaped questions on
large files, slice; and once LSP/trace handed you exact coordinates, read
the symbol span plus a little context — never restart from line 1.

`limit` — 3-5 by default; 15-20 only when deliberately surveying. `format`:
`json` (default) or `toon` — the saving is structural: near half the size
with `compact: true` (combine both for the floor), barely smaller with
full content (content passes through verbatim).
`workspace` + `projects` scope a search across a configured multi-project
workspace.

## Reading results

Each result carries score, file, start/end lines, the chunk content, and —
with RPG enabled — symbol_name / feature_path hints.

**Read ranks, not absolute thresholds — verified, not folklore.** The score
scale depends on BOTH the embedding model and the scoring path:

- Raw bge-m3 cosine similarity for code lives in a narrow, high-biased band:
  ~0.46 for unrelated code, ~0.53 for a perfect intent match, 1.0 only for
  identical text. The "0.9 = excellent match" bands from generic docs are
  unreachable on this model.
- With `search.hybrid.enabled: true` (this setup, k=60), grepai reports
  Reciprocal Rank Fusion scores instead: a top rank in both lists lands
  around 0.033, one list around 0.016 — exactly the small values a perfect
  hit actually returns.

Trust the numbers by band (hybrid on, single-project search):

- **~0.03x** — rank-1 in both fused lists: a direct, strong hit. Small
  numbers are normal here; never read 0.03 as "3% relevant".
- **~0.016x** — rank-1 in one list only: a plausible hit; check the chunk
  content before acting on it.
- **Below ~0.016** — the tail: weak fusion support; treat as leads, not
  answers.
- With hybrid off, judge by distance above the ~0.46 unrelated-code floor,
  not by distance from zero.

Two qualifiers: boost multiplies the fused value, so a both-lists hit on a
penalized path (docs, tests) can read in the single-list band — the bands
hold exactly for boost-neutral paths; and workspace-mode searches never
fuse (they report cosine and may repeat a file across projects).

What actually carries signal within one result set: the ORDER (boost-shaped
— see references/search-boost.md) and the RELATIVE gap between adjacent
scores (a cliff after the third hit means three real answers). The same
file repeating with multiple chunks is a signal only when dedup is off —
the default keeps the single best chunk per file, so each file appears at
most once.

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

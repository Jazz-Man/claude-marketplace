# grepai trace reference (MCP-only)

Scope: structural call-graph questions — who calls a symbol, what it calls,
the graph around it. Tools: `grepai_trace_callers`, `grepai_trace_callees`,
`grepai_trace_graph` (plus the property-level `grepai_refs_*` family, one
paragraph below). Trace reads a local symbol index and never touches the
embedding provider. Its niche in the synergy matrix: the structural
substitute when no LSP server covers the language, and a zero-setup
first pass everywhere else.

## Prerequisite: the symbol index

Trace queries a separate symbol index (`<project>/.grepai/symbols.gob`)
built by indexing/watching. Before blaming a query, check
`grepai_index_status { root }` — `symbols_ready: true` is what the trace
tools need. An empty symbol index fails with "symbol index is empty"; that
is an index-build problem, not a query problem — flag the rebuild to the
owner, never run it yourself.

## Tool calls

Who calls a symbol — call sites with file:line and the context line:

```
grepai_trace_callers { root: "<project>", symbol: "encodeFrame" }
```

What a symbol calls:

```
grepai_trace_callees { root: "<project>", symbol: "decodeChunks" }
```

Graph around a symbol — `depth` (default 2) bounds the traversal:

```
grepai_trace_graph { root: "<project>", symbol: "buildBinary", depth: 3 }
```

All three accept `compact: true` (drops context lines — coordinates only)
and `format: "json" | "toon"`; `workspace` + `project` scope to a
configured workspace (per-project symbol indexes are then merged; RPG
feature paths are not attached in workspace mode).

## Verified accuracy profile — what to trust

Live-tested on real call graphs. Split every result into two fields and
trust them differently:

**TRUST — `call_site` (file, line, context):** coordinates are precise and
the result is semantic: string literals, comments, and same-named symbols
in other scopes never appear. An 11-caller verification returned 11/11
exact sites with zero false positives — the same set an LSP
findReferences produced.

**TRUST — `callees` overall:** resolved callees are accurate, including
callback invocations inside the body (callback names carry empty symbol
records but correct call sites); arguments that are merely passed, not
called, are correctly absent.

**DISTRUST — the enclosing `symbol` attribution of a caller:** for call
sites inside a proper named function it resolves correctly, but for
module-level or inline sites the attribution can name a keyword
pseudo-symbol ("if", "for") from a completely unrelated file — the
regex-based extractor is the root cause. Read the caller's identity from
the call_site context line, not from symbol.name, whenever the enclosing
symbol looks wrong.

**DISTRUST — `graph` caller-side:** trace_graph reliably returns the
callee subtree, but caller edges are often absent even when trace_callers
finds them, and property accesses inside object literals can appear as
pseudo-call edges. For a caller view, run trace_callers; treat graph as a
callee dependency map.

## Language coverage — two tiers

The semantic index and the symbol index cover different worlds:

- **Search tier** — every file with a supported extension (~60: all major
  languages plus Shell, SQL, HTML/CSS, Markdown, YAML/JSON/TOML/XML, ini,
  env, proto, terraform), extended by `chunking.custom_extensions`.
  Detection is by file EXTENSION ONLY — no shebang or content sniffing —
  and files over 1 MB or binary are skipped regardless of any config.
- **Trace tier** — only languages with an extractor: Go, JS/JSX, TS/TSX,
  Vue SFC (converted to TS first via framework processing), Python, PHP,
  Lua, GDScript, Ruby, C/C++, Rust, Zig, C#, Java, F#, Pascal/Delphi.
  Extracted kinds: functions, methods, classes, interfaces, types.

Everything else — Swift, Kotlin, Scala, Dart, Elixir, Erlang, Clojure,
Haskell, OCaml, Elm, Nim, and all config/markup — is searchable but yields
no call graphs. Custom extensions are indexed for search with the fixed
chunker and are never traced.

Ruby caveat: receiver.method calls are found with or without parentheses;
bare parenthesis-less calls are not (indistinguishable from variables for
the extractor). Expect misses wherever syntax is dynamic — dynamic
dispatch, magic methods, reflection-based calls: the extractor reads
explicit syntax only.

Only extensions in `trace.enabled_languages` get symbol extraction; configs
from older grepai versions may lack newer entries (`.vue`, F#) — add them
by hand if a language silently yields nothing.

File-level exclusion from trace has exactly ONE mechanism: the top-level
`ignore` layer — and it removes the files from BOTH indexes (vector and
symbol) at once. A trace-specific exclude does not exist; wanting files in
vector search but out of trace is not an expressible configuration.

## refs — property-level reads and writes

`grepai_refs_readers` / `grepai_refs_writers` / `grepai_refs_graph` answer
where a PROPERTY is read or assigned (`store.uid = id`), not called.
JavaScript/TypeScript and Vue only — other languages extract call
references only and refs returns nothing for them. Live-tested caveats:
readers dominated by dependency noise when node_modules is not curated out
of the index (fix is ignore, not refs), and writers miss closure-variable
assignments. Treat refs as a lead generator, then verify by reading the
sites.

## Workflow patterns

- Pre-refactor impact: `trace_callers` on the symbol about to change —
  every impact point with coordinates in one call.
- Dependency map for understanding: `trace_callees` for one function,
  `trace_graph` (depth 2-3) for a subsystem's internal structure.
- With an LSP available: LSP remains the precision instrument for exact
  references (apply the lsp-code-analysis skill); trace wins on zero-setup
  coverage across languages and on the context line each site carries.

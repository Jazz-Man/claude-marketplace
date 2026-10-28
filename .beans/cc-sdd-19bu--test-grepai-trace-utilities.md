---
# cc-sdd-19bu
title: Test grepai trace utilities
status: in-progress
type: task
priority: normal
created_at: 2026-10-28T08:58:15Z
updated_at: 2026-10-28T12:41:40Z
---

Exercise grepai_trace_callers/callees/graph against known ground-truth symbols (encodeFrame 11 callers, decodeChunks callees createDecoder/decode, buildBinary graph) and record whether results are empty or populated.

## Summary of Changes

Tested grepai trace utilities with index_status diagnostic. NOT empty (user suspicion refuted): index healthy (3432 files, 9433 chunks, symbols_ready=true, ollama/bge-m3, updated 2026-10-27 23:34). trace_callers(encodeFrame): 11/11 call sites exact (file:line + context), perfect recall/precision at call-site level, but enclosing-symbol attribution garbage for module-level/inline sites (attributes to unrelated keyword-symbols like 'if'/'for' from other files); function-scoped sites (startProxy) attribute correctly. trace_callees(decodeChunks): accurate (createDecoder resolved + callback calls with correct lines). trace_graph(buildBinary): callee-subtree only despite docstring promising callers+callees (no caller edges from build.ts callers); property accesses (binName/target/entrypoints) pollute edges as pseudo-calls.

## Round 2 (index rebuilt 2026-10-28 11:11)

rpg_*: empty as expected (rpg_enabled=false) — search/fetch/explore all refuse. trace_*: NOT empty — symbols_ready=true survived the rebuild, all three tools return the same full results (the changed setting did not disable symbol extraction). refs_*: populated-but-useless — refs_readers(buffer) 9/10 hits from three bun-types versions in node_modules, one real workspace hit; refs_writers(buffer) empty despite the real closure write (buffer = extractFrames) at framing.ts:126. Caller-attribution garbage now pools from node_modules (unbash dist).

## Round 3 (rebuilt from scratch 11:46, RPG ON — 16363 nodes/13793 edges)

Full 14-tool battery. Working: search (good workspace-relevant top hits), trace_callers (11/11 sites, same node_modules attribution garbage), trace_callees (accurate), trace_graph (callee-only + property pseudo-edges), refs_readers (9/10 node_modules noise), refs_writers (empty, misses closure writes), rpg_search (top-2 real symbols then node_modules noise), rpg_fetch (full hierarchy+edges+preview), rpg_explore (BFS works), index_status, stats (all zeros — fresh), list_workspaces ([]), list_projects (requires workspace param). Root cause of noise across refs/rpg/search: node_modules indexed (3x bun-types, unbash dist) — ignore key must exclude it; docs note ignore REPLACES defaults. rpg feature labels are keyword-noise ('operate-if' as file feature).

## Docs collection (for the refutation research)

Sonnet subagent collected all 55 sidebar pages of https://yoanbernabeu.github.io/grepai/ verbatim into docs/grepai/<page>.md (guides, full CLI reference, community). Verified: 55 files, no 404/empty. Caveats: every file carries site chrome (nav+sidebar, ~50 lines) before the article body; blog pages (incl. benchmark-grepai-vs-grep-claude-code) excluded by the sidebar-only rule — candidate add for the LSP-vs-grepai research.

## search.boost configuration

Root cause found: config had search.boost enabled but with EMPTY penalties/bonuses — custom lists replace defaults, so boost was a complete no-op. Configured: full default rule set (tests x0.5, mocks/fixtures/generated x0.4, docs .md+/docs/ x0.6, /src|lib|app bonuses x1.1) + project rules (/node_modules/ x0.1, /tmp/ x0.3, /.superpowers/ x0.4). Verified live via MCP (root param hot-reloads config, no reindex): 'json rpc frame encoding' top-5 went from test/fixtures-polluted to all /src/ production files. Limitation confirmed by second probe: boost only REORDERS the returned pool — node_modules still fills results when the pool has nothing else; real fix for node_modules is ignore+reindex (ignore also replaces defaults — current list lacks node_modules/tmp/.superpowers).

## .grepaiignore + boost interplay

User's curation: .gitignore:18 excludes node_modules/ (layer 1), .grepaiignore re-includes !node_modules/bun-types/ (+exclusions CLAUDE.md, vendor/) and !node_modules/unbash/dist/ (layer 2, gitignore syntax with !). Fixed my collision: removed the /node_modules/ x0.1 boost penalty I added earlier — it sank exactly what the user deliberately re-included. Verified: 'bun spawn subprocess stdin write' now ranks bun.d.ts spawn chunks top (0.0154/0.0141/0.0139), child-process.mdx guides below at x0.6 — source-first as intended. Observation: all three bun-types store versions (1.4.2/1.4.4/canary) indexed — each hit triplicates; narrowing the negation to one version is an option.

## Store rebuild + reindex verification (final)

rm node_modules + bun install rebuilt the store clean (single bun-types@1.4.4, 113 pkgs). Full reindex at 14:40: 3432->1701 files, 9433->4556 chunks, 77->36.8 MB, RPG 16363->8149 nodes. Bun-API probe: all hits from bun-types@1.4.4 only (no 1.4.2/canary duplicates), bun.d.ts source on top, mdx guides below via .md x0.6 — source-first as designed. Old noise probe (encoding conversion typed array) now returns curated relevant bun-types 1.4.4 material instead of triple-version noise. grepai re-saved config.yaml on its own (normalization: comments dropped) — rules intact.

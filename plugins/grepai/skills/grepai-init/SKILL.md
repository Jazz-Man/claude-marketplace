---
name: grepai-init
description: This skill should be used when the user asks to "set up grepai" or configure it, or when a project has no .grepai/config.yaml yet — running grepai init and then adapting the config it wrote to the project (ignore list, global gitignore, search boost, hybrid and dedup, trace languages, RPG, chunking, embedder) — and when a grepai search misses code or ranks it wrongly for a config reason (a file not indexed, tests outranking source). Searching the index (grepai_search, trace, rpg) is the grepai-workflow skill. The owner builds the index; this skill shapes its config.
---

# grepai init — initialize, then adapt the config to the project

grepai embeds a codebase into a searchable index, and every later search
reads what that index holds and how it ranks. Both are decided per project
by `.grepai/config.yaml` and `.grepaiignore`; this skill writes them.
Searching the finished index is the `grepai-workflow` skill.

`grepai init` only starts the job. It writes the same generic config for
every project: trace on for 27 extensions, RPG off, hybrid search off, no
global gitignore, and no idea where this project keeps its product code or
what its agent tools leave in the tree. Left like that, the index treats
`CLAUDE.md`, `.claude/` and editor state as source, call graphs answer for
languages the project never uses, and ranking is blind to the layout. The
setup is finished when every row of the checklist below holds in the file
and `grepai config validate` exits with code 0.

## Initialize

`grepai init --yes` writes `.grepai/config.yaml` without asking anything (a
bare `grepai init` prompts on stdin). In a project that already has the
file it only reports the path and changes nothing: go straight to adapting.
It also keeps the index out of git: adds `.grepai/` to the project's
`.gitignore`, or writes `.grepai/.gitignore` when the project has none.
Its output suggests `grepai watch` — indexing is the owner's; never run
`grepai index` or `grepai watch`.

## Read the project

Every value in the checklist comes from the project itself; four questions
give them all:

1. **Which languages is it written in?** An extension census of the tracked
   files: `git ls-files | sed -E 's|.*/||; s/^.*\.//' | sort | uniq -c | sort -rn`.
   In a project that is not a git repository, count the files on disk
   instead: `find . -type f -not -path './node_modules/*' | sed -E 's|.*/||; s/^.*\.//' | sort | uniq -c | sort -rn`.
2. **What do the agent and editor tools leave in the tree?** The root
   listing; `git check-ignore -q <name>` tells for each candidate whether
   git already ignores it (exit 0). grepai honors gitignore files, so
   those names need no entry. Without a git repository only the global
   gitignore can pre-exclude a name: search `~/.gitignore` for it.
3. **Where are the tests, mocks, fixtures and generated code — by directory
   and by file naming?**
4. **Which directories are the product?** The source roots.

## Adapt the config

Edit `.grepai/config.yaml` row by row:

| Key | `grepai init` writes | It must hold |
|---|---|---|
| `external_gitignore` | nothing | `~/.gitignore`, the owner's global gitignore — confirm the file exists |
| `ignore` | 15 shipped defaults | this project's own list: the shipped entries that can occur here and its agent and editor artifacts that git does not ignore — nothing for other ecosystems — references/ignore.md |
| `search.boost` | on, 20 shipped rules | on, with rules shaped for this project — references/search-boost.md |
| `search.hybrid.enabled` | `false` | `true` |
| `search.dedup.enabled` | `true` | `true` |
| `trace.enabled_languages` | 27 extensions | the languages the project is written in, each as a whole family — TypeScript is `.ts .tsx .js .jsx`, kept together even where the census finds only `.ts`; only extensions the extractor knows |
| `rpg.enabled` | `false` | `true` |
| `embedder`, `chunking.strategy` | nomic-embed-text, 768d, `fixed` | the solo baseline — references/configuration.md |

At init the lists are yours to shape. In a config the owner has already
curated the reverse holds: add what a row lacks and leave the rest as it
is — never re-add entries the owner removed (references/ignore.md).

Check the file twice — after `grepai init`, after every edit and before
you report:

- **The format**: `grepai config validate`. It lists every problem at
  once — an option that does not exist, a value the key does not accept, a
  number out of range — and exits with code 1 when it finds one. It starts
  nothing. Every other grepai command and every MCP tool runs the same
  checks and refuses to work while the file has a problem.
- **The rows**: the command checks the format only. Whether the values fit
  this project — the boost rules, agent-tool directories beyond the base
  names — is yours to judge by re-reading the file against the table.

Three rows deserve a word:

- Hybrid ships off because every query then scans all chunks. The owner
  wants it on; on a very large index, say what it costs instead of leaving
  it off. `k` stays 60.
- RPG keeps `feature_mode: local` unless the owner names a chat model for
  `llm_model`; `llm` and `hybrid` fall back to `local` without one. The
  graph is built from the trace languages, so settle that row first.
- The layout cannot tell you which documentation the owner wants ranked
  above source. Ask once, when you report.

The store is not a row: `gob` is right up to about 50,000 chunks. Past
that the documentation points to `qdrant`, which needs a server the owner
runs — say so instead of switching it.

## Report, hand over, verify

Re-read the file, check every row, and report one line per key: what you
set, and what in the project made you set it. The last
`grepai config validate` must exit with code 0. A row you cannot fill is a
question to the owner, not a silent default.

The owner then builds the index — ignore, trace, RPG, chunking and embedder
changes only take effect in a fresh one, while boost, hybrid and dedup
apply to the next search. `grepai index` takes the project's writer lock,
so it cannot run while `grepai watch` is active, and a running watcher
never reloads the config: the owner restarts it. Expect the file to change
after the build — the index run rewrites it to store
`watch.last_index_time`. After the build, `grepai_index_status { root }`
should show a sensible `total_files`, `symbols_ready: true` and
`rpg_enabled: true` with node and edge counts. Run one ground-truth query
per tool — a search for code you know is there, `grepai_trace_callers` on a
known symbol, `grepai_rpg_search` on a known feature word — and confirm the
agent files stayed out. If a curated library does not surface, walk the
ignore layers in order (references/ignore.md).

Chunking (the `ast` strategy is active in this build): references/chunking.md.

## References

- **configuration.md** — the config map for the solo profile and its pitfalls
- **ignore.md** — five ignore layers, curation craft, ignore-vs-boost division
- **search-boost.md** — ranking rules, shipped defaults, their reorder-only limits
- **chunking.md** — fixed vs ast strategies, tuning tables, the re-index rule

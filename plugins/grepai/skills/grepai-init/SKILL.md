---
name: grepai-init
description: This skill should be used when the user asks to "set up grepai" or configure it, or when a project has no .grepai/config.yaml yet — running grepai init, curating .grepaiignore and the config ignore list, shaping search boost, chunking, embedder or store settings — and when a grepai search misses code or ranks it wrongly for a config reason (a file not indexed, tests outranking source). Searching the index (grepai_search, trace, rpg) is the grepai-workflow skill. The owner builds the index; this skill shapes its config.
---

# grepai init — the per-project setup of the search index

grepai embeds a codebase into a searchable index. What that index holds,
and how it ranks what it holds, is decided per project by two files:
`.grepai/config.yaml` and `.grepaiignore`. This skill shapes them;
searching the finished index is the `grepai-workflow` skill.

## First run in a project

1. `grepai init --provider ollama --model bge-m3 --backend gob --yes` —
   writes `.grepai/config.yaml` without asking anything (embedder and
   store are settled for this workflow: local Ollama, GOB backend). Pass
   the flags: a bare `grepai init` prompts on stdin and falls back to
   nomic-embed-text. The new file is three edits short of the solo
   baseline in references/configuration.md: set
   `embedder.dimensions: 1024`, `chunking.strategy: ast`, and
   `search.hybrid.enabled: true`.
2. Shape the ignore layers and curate the dependency sources worth
   trusting — the five layers, negation craft, and the Rust/Go honesty
   rule: references/ignore.md. The ignore list is the OWNER's curation —
   never re-add entries the owner removed; the full rule lives in the
   reference.
3. Shape `search.boost` ranking — rules, defaults, and the
   curation-interplay rule: references/search-boost.md.
4. Never run indexing or watching — the owner builds and maintains
   the index (`grepai index` / `grepai watch`); after any change that
   requires a re-index (ignore layers, chunking, embedder identity, the RPG
   graph), say so, never run it. `grepai init` prints `grepai watch` as
   its next step and `ollama pull` as a hint — both are the owner's, so
   never pull a model.
5. Verify with a ground-truth query; if a curated library does not
   surface, walk the ignore layers in order.

In a project that already has `.grepai/config.yaml`, `grepai init` only
reports the file and changes nothing — start at the step the request is
about. `grepai init` also keeps the index out of git: it adds `.grepai/`
to the project's `.gitignore`, or writes `.grepai/.gitignore` when the
project has none.

The full config map and the solo pitfalls: references/configuration.md.
Chunking (the `ast` strategy is active in this build):
references/chunking.md.

## References

- **configuration.md** — the config map for the solo profile and its pitfalls
- **ignore.md** — five ignore layers, curation craft, ignore-vs-boost division
- **search-boost.md** — ranking rules, shipped defaults, their reorder-only limits
- **chunking.md** — fixed vs ast strategies, tuning tables, the re-index rule
- **config.schema.json** — the machine truth for the config

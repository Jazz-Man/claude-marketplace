---
# cc-sdd-nkjq
title: Sync grepai skills with the rewritten upstream docs
status: completed
type: task
priority: normal
created_at: 2026-11-28T14:07:08Z
updated_at: 2026-11-28T14:25:02Z
---

Owner request 2026-11-28: the grepai documentation in ~/tools/grepai/docs/src/content/docs was fully rewritten (all options and settings, CLI, MCP; v1.2.0-30). Study it in Sonnet subagents, audit every claim of plugins/grepai/skills/grepai-init and grepai-workflow against it, then bring both skills in line. Three parallel audits: configuration and init; search, ranking and code graph; CLI and MCP surface. Reports in $TMPDIR/grepai-docs-audit. Followed by the full eval cycle (separate bean).

## Summary of Changes

- Three Sonnet subagents studied only `/Users/vasilsokolik/tools/grepai/docs/src/content/docs` (first attempts were stopped: their briefs had allowed source, binary and skill files). Digests: search/boost/hybrid/trace/RPG/workspaces; configuration, embedders, stores, watch, worktrees, init; CLI and MCP surface.
- `grepai-init/references/configuration.md` rewritten as a complete reference in the documentation's terms: how the file is loaded (defaults not filled for provider, model, backend and ignore; `search` has no load-time defaults; unknown keys dropped when index/watch rewrite the file), the files in `.grepai/`, one table per section (embedder, store, chunking, framework_processing, watch, search, trace, rpg, ignore), and the solo baseline. `rpg.max_traversal_depth` now reads as the docs say: accepted for compatibility, no effect. The source-code reference `embedder/env_key.go` is gone.
- `ignore.md`: layers reordered as the documentation lists them (`.gitignore`, config `ignore`, `.grepaiignore`, `external_gitignore`, built-in); the re-inclusion rule corrected — a negation does reach into a folder ignored by `.gitignore` or the `ignore` list, but `.grepaiignore` itself cannot negate below a directory it ignores; new section "Index only one folder" with the documentation's example and its three wrong variants; watcher restart wording.
- `chunking.md`: a change to any chunking key re-chunks only files that changed — applying it to the whole project means deleting the index; the docs' list is the authority instead of the schema enum; `fixed` is the documented recommendation, `ast` experimental.
- `grepai-init/SKILL.md`: trace row limited to extensions the extractor knows; store size note (gob up to about 50,000 chunks); hand-over names the writer lock, the watcher restart and the rewrite of `config.yaml` by the index run; schema copy described as key names and valid ranges.
- `grepai-workflow/references/search.md`: `path` is a plain prefix test; workspace searches use the default boost rules with hybrid, dedup and RPG off; `root` and `workspace` never together; hybrid keyword mechanics; pitfall on exact identifiers corrected for hybrid on.
- `trace.md`: recorded and ignored refs accesses; the Vue processor trust note; empty `trace.enabled_languages` falls back to the defaults; `trace.mode` and `trace.exclude_patterns` never had an effect; `refs_writers` before a rename.
- `rpg.md`: defaults for `limit`, `direction`, `depth`, `edge_types`; RPG tools take no `root`; `feature_group_strategy` cuts groups over 100; the two-step graph update under watch. `grepai-workflow/SKILL.md`: dispatch contract says `root` and `workspace` never together.

## Notes

- Every MCP call shape in both skills matches the documented 14 tools and their parameters; `.mcp.json` and the `code-explorer` tool list match too.
- Not done, owner's call: `references/config.schema.json` is a copy of the source schema and was not re-read or re-synced (source was off limits); its wording can lag the docs, so configuration.md now says the documentation wins.
- Owner doctrine left as is although the docs differ: the skills prefer `ast` chunking (docs recommend `fixed`); score bands and the trace trust profile are the owner's live measurements, which the docs neither confirm nor contradict.
- Facts kept that the docs do not state but earlier scratch runs showed: `grepai init` is a no-op in an initialized project and writes `.grepai/.gitignore` when a project has no `.gitignore`.
- Verified: `claude plugin validate .` passed; frontmatter and reference-pointer checks pass; no ollama command left in grepai-init/SKILL.md.

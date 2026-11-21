---
# cc-sdd-z31a
title: 'Update grepai-workflow skill: full actualization'
status: completed
type: task
priority: normal
created_at: 2026-11-21T14:55:21Z
updated_at: 2026-11-21T15:05:05Z
---

Full cycle per plugin-dev:skill-development: fact-check all references against live grepai source (post AST expansion + description fixes), rewrite stale content (chunking.md coverage, schema copy sync, search.md wording), add dispatch-contract section to SKILL.md from the 2026-11-21 behavioral tests (subagents need explicit dispatch demands), validate + skill-reviewer review.

## Parking lot

- Split grepai-workflow into two skills (setup/init vs search/usage) — user's idea, deferred until the whole investigation settles. Rationale: different audiences (owner-curated rare setup vs every-session search), sharper triggers per skill, leaner always-relevant surface.

## Summary of Changes

Full skill-development cycle: fact-checked all 9 files against live grepai source (chunker_ast.go, config.go, index_meta.go, cli/index.go, mcp/server.go); synced references/config.schema.json verbatim; rewrote ast coverage (~30 languages) in chunking.md + configuration.md with schema-as-authority pointers; added chunking-vs-trace coverage disambiguation in both files; max_file_size_bytes propagated to configuration/ignore/trace; trace extractor claim made precise (regex is the only WIRED extractor, tree-sitter symbol extractor is dead code); DRY: ignore prose consolidated into ignore.md; dispatch contract completed (root, index_status, identifiers) and de-absolutized (n=2); second-person sweep complete; description phrasing fixed. Reviewer findings 1-11 all resolved: 1,2,3,6,7,8,9,10,11 fixed on our side; 4,5 verified PROSE-CORRECT (schema is the stale side -> grepai-source bugs). claude plugin validate passes; 884 words.

grepai-source doc bugs found (for the next brief): (a) schema embedder-identity claim wrong (endpoint IS excluded, file is index-meta.json per config/index_meta.go); (b) schema header 'missing values filled from defaults' imprecise for search section (applyDefaults does not fill Search; missing search = boost/dedup OFF); (c) schema 'precise tree-sitter extractor' describes dead code (not wired; cli/index.go:115 always RegexExtractor).

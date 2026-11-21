---
# cc-sdd-2vxs
title: Verify grepai-workflow skill claims 100% against source
status: completed
type: task
priority: normal
created_at: 2026-11-21T15:11:18Z
updated_at: 2026-11-21T15:18:34Z
---

Full verification pass: every testable claim in SKILL.md + 7 references checked against ~/tools/grepai source via grepai-source-mcp (exception to bundled-MCP rule, user-authorized for this task only).

## Summary of Changes

100% verification of grepai-workflow skill claims against ~/tools/grepai source via grepai-source-mcp (search + trace + rpg + bounded reads). ~60 claims checked across SKILL.md + 7 references: ZERO falsehoods found. Highlights verified with code evidence: boost substring/leading-slash/cumulative/reorder-only (search/boost.go), fetchLimit x2/x4 + dedup-best-per-file (search/search.go, dedup.go), RRF k=60, newline backup (chunker.go:223), maxReChunkAttempts=3 + verbatim log (indexer.go:608,738-808), binary UTF-8+null (scanner.go:296), deepest-.grepaiignore-wins + deeper-.gitignore-beats-negation (gitignore.go:181), symbols.gob (config.go:20), keyword pseudo-symbol maps (patterns.go:403+), workspace trace merge dedup (server.go:1513-1530), RPG cat:/subcat: IDs + ClassifyFile (hierarchy.go), Jaccard + camelCase-NOT-split (query.go:716 normalizeWords delimiters - _ / space . @), drift 0.35/depth 3/sample/local, ignore defaults list, RPG watch defaults, GetDimensions 768 local / 1536+ cloud, synthetic 90s, env-key official-endpoint guard.

Two doc gaps found and fixed in configuration.md: env keys only sent to official endpoints (embedder/env_key.go); grepai init offers worktree config inheritance (cli/init.go:73-97). validate passes.

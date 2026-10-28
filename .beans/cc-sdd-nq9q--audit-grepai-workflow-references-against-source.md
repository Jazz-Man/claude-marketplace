---
# cc-sdd-nq9q
title: Audit grepai-workflow references against source
status: completed
type: task
priority: normal
created_at: 2026-10-28T21:52:28Z
updated_at: 2026-10-28T22:51:52Z
---

Verify every factual claim in each of the 7 prose references (configuration, ignore, search, search-boost, chunking, trace, rpg) against the grepai source at /Users/vasilsokolik/tools/grepai via grepai-source-code-api MCP. One sonnet subagent per file, sequential; orchestrator applies corrections from FALSE verdicts. config.schema.json excluded (source-generated artifact).

## Summary of Changes

Full audit campaign: 7 sonnet subagents, one per prose reference, sequential; every claim verified against /Users/vasilsokolik/tools/grepai source via grepai-source-code-api MCP + direct reads. Totals: ~250 claims checked. FALSE findings fixed: configuration.md 5 (empty-provider reset myth, identity without endpoint + index-meta.json filename, synthetic 90s timeout, invented gob size warning, blanket-defaults overstatement) + provenance/treesitter notes; search.md 2 (toon size scoped to compact, file-repetition signal requires dedup off) + RRF-band boost-shift qualifier + workspace-never-fuses; chunking.md 2 (invented logical-boundary splitting — newline-backup only; overlap 1-49 works as a lever) + mislabeled example + silent dot-drop + ast ReChunk fallback; trace.md 3 (graph has no compact, name-only matching without scope resolution, ignore is the only CONFIGURABLE exclusion with minified/1MB/binary unconditional) + graph collision-cap + callees pseudo-leak. ignore.md 0 FALSE (3 tightenings). search-boost.md 0 FALSE (hot-reload strengthened to every-call). rpg.md 0 FALSE (38/38 TRUE; fetch children/feature_path, endpoint-or-model fallback, camelCase non-splitting added). Post-audit rule applied throughout: agent never runs indexing/watch — warns the owner. claude plugin validate passes.

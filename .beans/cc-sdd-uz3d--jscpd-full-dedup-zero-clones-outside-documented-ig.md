---
# cc-sdd-uz3d
title: 'jscpd full dedup: zero clones outside documented ignores'
status: in-progress
type: feature
priority: normal
created_at: 2026-10-26T19:05:10Z
updated_at: 2026-10-26T23:13:06Z
---

159 clones / 35.7% under current .jscpd.json thresholds. Policy (owner, 2026-10-26): every finding gets CODE-FIX or IGNORE-DOCUMENTED (data tables / src-test mirrors / architectural similarity, each with written reason); thresholds stay; .jscpd.json applied by owner from triage-doc proposals. Plan: docs/superpowers/plans/2026-10-26-jscpd-dedup.md. All work in subagents; loop jscpd until clean outside ignores.

AMENDMENT 2026-10-27: owner reversed terminal policy — FIX ABSOLUTELY EVERYTHING. No ignore entries (node_modules/dist only), goal 0 clones. Waves: A tables (compact forms), B src-test mirrors (derived), C 11 src twins (real merges), D test mass (full dissolution), E loop to flat 0. ignore-proposal §2 void.

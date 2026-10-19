---
# cc-sdd-0iyy
title: Biome to Bun lint/fmt migration
status: in-progress
type: epic
created_at: 2026-10-18T15:36:04Z
updated_at: 2026-10-18T15:36:04Z
---

Full migration of lint/format truth from biome.json to bunfig.toml ([lint]/[fmt] + local lint/plugin.ts: no-comments, exports-last). Spec: docs/superpowers/specs/2026-10-18-biome-to-bun-migration-design.md. Plan: docs/superpowers/plans/2026-10-18-biome-to-bun-migration.md. biome.json frozen (D1), .zed/ owner-only (D6), severity error-or-off (D7), zero new deps beyond owner-installed @types/eslint (D5).

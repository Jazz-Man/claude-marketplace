---
# cc-sdd-0iyy
title: Biome to Bun lint/fmt migration
status: scrapped
type: epic
priority: normal
created_at: 2026-10-18T15:36:04Z
updated_at: 2026-10-19T12:29:37Z
---

Full migration of lint/format truth from biome.json to bunfig.toml ([lint]/[fmt] + local lint/plugin.ts: no-comments, exports-last). Spec: docs/superpowers/specs/2026-10-18-biome-to-bun-migration-design.md. Plan: docs/superpowers/plans/2026-10-18-biome-to-bun-migration.md. biome.json frozen (D1), .zed/ owner-only (D6), severity error-or-off (D7), zero new deps beyond owner-installed @types/eslint (D5).

## Reasons for Scrapping

Aborted by owner 2026-10-19 mid-Task-4 stop point: Bun has no LSP server for editors, so editor-integrated diagnostics and formatting (the biome-lsp bridge's role) cannot move to Bun. Tasks 1-4 executed and reviewed (four commits + one uncommitted sweep diff); biome.json untouched throughout; full state snapshot in .superpowers/sdd/2026-10-18-biome-to-bun-migration/progress.md.

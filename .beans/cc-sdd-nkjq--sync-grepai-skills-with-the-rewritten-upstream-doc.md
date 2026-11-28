---
# cc-sdd-nkjq
title: Sync grepai skills with the rewritten upstream docs
status: in-progress
type: task
created_at: 2026-11-28T14:07:08Z
updated_at: 2026-11-28T14:07:08Z
---

Owner request 2026-11-28: the grepai documentation in ~/tools/grepai/docs/src/content/docs was fully rewritten (all options and settings, CLI, MCP; v1.2.0-30). Study it in Sonnet subagents, audit every claim of plugins/grepai/skills/grepai-init and grepai-workflow against it, then bring both skills in line. Three parallel audits: configuration and init; search, ranking and code graph; CLI and MCP surface. Reports in $TMPDIR/grepai-docs-audit. Followed by the full eval cycle (separate bean).

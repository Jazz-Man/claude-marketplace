---
# cc-sdd-rkoo
title: Replace the validator scripts with grepai config validate; sync skills with the updated docs
status: in-progress
type: task
created_at: 2026-11-28T15:41:30Z
updated_at: 2026-11-28T15:41:30Z
---

Owner request 2026-11-28: grepai now ships a config validation command (grepai config validate) and reports config errors from CLI commands and MCP tools; the documentation in ~/tools/grepai/docs/src/content/docs is updated. Study the docs with subagents (documentation folder only), remove plugins/grepai/skills/grepai-init/scripts, and point both skills at the built-in command. Proof commands allowed in the repository root: grepai config validate, grepai config --help.

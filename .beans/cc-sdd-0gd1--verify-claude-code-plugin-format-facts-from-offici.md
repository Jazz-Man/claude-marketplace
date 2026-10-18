---
# cc-sdd-0gd1
title: Verify Claude Code plugin format facts from official docs
status: completed
type: task
priority: normal
created_at: 2026-09-22T16:16:01Z
updated_at: 2026-09-22T16:17:28Z
---

Team lead needs authoritative facts on plugin repo structure, plugin.json fields, directory conventions, local dev loading, , context contribution, and SKILL.md frontmatter - verified against current code.claude.com docs.

## Summary of Changes

Verified all six points against live docs (fetched 2026-09-22): plugins-reference, plugins, skills, discover-plugins. Key findings: .claude-plugin/plugin.json with only 'name' required and manifest itself optional; marketplace.json not needed for local plugins; skills are namespaced /plugin-name:skill-name (not bare /foo); confirmed plus CLAUDE_PLUGIN_DATA, CLAUDE_PROJECT_DIR, CLAUDE_SKILL_DIR; plugin CLAUDE.md is NOT loaded as project context; SKILL.md frontmatter has ~20 fields, all optional, description truncated at 1536 chars, metadata free-form with no documented shared-rules behavior. Report delivered to team lead.

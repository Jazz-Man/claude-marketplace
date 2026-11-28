---
# cc-sdd-dax9
title: 'grepai-init: YAML validator script, drop the schema copy'
status: in-progress
type: task
created_at: 2026-11-28T14:34:20Z
updated_at: 2026-11-28T14:34:20Z
---

Owner requests 2026-11-28: (1) a script in plugins/grepai/skills/grepai-init/scripts that validates the YAML format of .grepai/config.yaml with Bun's built-in YAML parser (node_modules/bun-types/docs/runtime/yaml.mdx), run with bun and used by the skill at every step; (2) delete references/config.schema.json from the skill — the owner keeps the documentation and the skill in sync instead.

---
# cc-sdd-7izh
title: 'grepai-init: adapt the generated config to the project'
status: in-progress
type: task
created_at: 2026-11-28T12:53:21Z
updated_at: 2026-11-28T12:53:21Z
---

Owner's practice edits (2026-11-28) after the split (cc-sdd-rsis): agents stop after grepai init and leave its generic config. The skill must make them adapt, per project: external_gitignore -> the owner's global ~/.gitignore; ignore -> agent and editor artifacts not already git-ignored; search.boost on and shaped for the project; hybrid and dedup on; trace.enabled_languages -> the project's languages; RPG on with its settings. Also remove the ollama-related commands from the skill. Full skill-creator eval cycle follows these edits (owner's decision).

---
# cc-sdd-rkoo
title: Replace the validator scripts with grepai config validate; sync skills with the updated docs
status: completed
type: task
priority: normal
created_at: 2026-11-28T15:41:30Z
updated_at: 2026-11-28T15:48:28Z
---

Owner request 2026-11-28: grepai now ships a config validation command (grepai config validate) and reports config errors from CLI commands and MCP tools; the documentation in ~/tools/grepai/docs/src/content/docs is updated. Study the docs with subagents (documentation folder only), remove plugins/grepai/skills/grepai-init/scripts, and point both skills at the built-in command. Proof commands allowed in the repository root: grepai config validate, grepai config --help.


## Summary of Changes

- `plugins/grepai/skills/grepai-init/scripts/` (config-rows.ts, config-shape.ts, validate-config.ts) deleted; the plugin README no longer lists `bun` as a requirement.
- `grepai-init/SKILL.md`: `grepai config validate` replaces the bun validator — after init, after every edit and before the report. It checks the format only, so the rows are verified by re-reading the file against the table. No-git fallback added: an extension census from disk, and a search of the global gitignore when the project is not a git repository.
- `configuration.md`: "How the file is loaded" rewritten per the documentation — strict loading (an option that does not exist at any depth, a wrong type, an unknown name, a number out of range, an entry that would be ignored), the scope of `grepai config validate`, what it does not check, the `invalid configuration` tool error; `chunking.strategy` rejects unknown names; the watcher skips its config write when the file became invalid; a pitfall on a misspelled option.
- `chunking.md`: an unknown strategy and a dotless custom extension stop the command instead of being dropped silently. `ignore.md`: the no-git fallback for agent names.
- `grepai-workflow`: SKILL.md hands `invalid configuration` over to the init skill; search.md explains the tool error; trace.md and rpg.md point to it; trace.md notes the entry rule for `trace.enabled_languages`.

## Notes

- Proof in the repository root: `grepai config --help` shows `validate`; `grepai config validate` prints `Configuration is valid` and exits with code 0.
- A Sonnet subagent read the documentation folder only; its digest is at /tmp/claude-501/grepai-docs-audit/d-config-validate.md.
- Gates: biome clean on the plugin; `bun check --strict --all` clean (73 files); `claude plugin validate .` passed.
- The built-in command checks the format, not the owner's checklist rows. Whether agents still fill every row without the bun validator is what iteration 2 of the eval cycle measures (cc-sdd-y5le).

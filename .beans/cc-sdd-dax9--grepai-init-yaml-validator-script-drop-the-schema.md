---
# cc-sdd-dax9
title: 'grepai-init: YAML validator script, drop the schema copy'
status: completed
type: task
priority: normal
created_at: 2026-11-28T14:34:20Z
updated_at: 2026-11-28T14:51:14Z
---

Owner requests 2026-11-28: (1) a script in plugins/grepai/skills/grepai-init/scripts that validates the YAML format of .grepai/config.yaml with Bun's built-in YAML parser (node_modules/bun-types/docs/runtime/yaml.mdx), run with bun and used by the skill at every step; (2) delete references/config.schema.json from the skill — the owner keeps the documentation and the skill in sync instead.

## Summary of Changes

- New `plugins/grepai/skills/grepai-init/scripts/`: `validate-config.ts` (command line through `node:util` `parseArgs` with typed options, parsing with Bun's `Bun.YAML.parse`, the report), `config-shape.ts` (duplicate top-level keys, unknown keys, block shapes) and `config-rows.ts` (reads the checklist rows, `git check-ignore`, root directories outside ignore). Run as `bun <skill>/scripts/validate-config.ts [project-root | path/to/config.yaml]`: exit code 0 and `complete` only when the format is valid and every row holds, 1 otherwise.
- `grepai-init/SKILL.md`: the validator is part of the flow — after `grepai init`, after every edit and before the report; the report uses its per-row status; the schema line in References gave way to the script. `configuration.md` no longer points at the schema. Plugin README names the validator and lists `bun` as a requirement.
- `references/config.schema.json` deleted on the owner's decision; no mention of it is left in the plugin.

## Notes

- Bun's parser (1.4.6) throws on tabs, unresolved aliases and broken tokens, but silently accepts a mis-indented block (it reads as empty) and duplicate keys (the last one wins). The script therefore also checks block shapes and top-level duplicates, the latter by a scan of column-0 keys; duplicates nested deeper are not detected.
- Rows the script judges: external_gitignore (set and the file exists), ignore (the agent and editor base names, skipping those git ignores), the boost, hybrid and dedup switches, the trace list (open while it equals the shipped 27), the rpg switch, embedder and chunking against the baseline constants (bge-m3, 1024, ast). Not judged: whether the boost rules fit the project.
- Observed: this repository's config prints `complete`; a generic `grepai init` config leaves six rows open; the owner's curated config with two gaps leaves exactly external_gitignore and rpg open.
- Gates: biome clean on the scripts and on the plugin; `bun check --strict --all` clean (76 files); `claude plugin validate .` passed.
- Not verified: that `${CLAUDE_SKILL_DIR}` expands inside the skill's indented code block; that agents run the script as told — the eval cycle will show.
- The baseline and the shipped language list are now stated in the script as well as in the references; they change together.


Follow-up the same day, owner's request: `parseArgs` gained a typed `--config <file>` option that names the config file itself. The positional argument is now only the project root (default: the working directory) — a YAML path passed positionally is treated as a project root and reported as a missing config. Usage: `bun validate-config.ts [project-root] [--config path/to/config.yaml]`. Verified on the repository's own config (complete), a test copy with open rows, a missing file, `--config` without a value and `--help`; biome, `bun check --strict --all` and `claude plugin validate .` pass.


Second follow-up, owner's review of the script: no existence pre-checks and no `resolve` around file reads. `validate-config.ts` now reads the config with `Bun.file(path).text()` and reports a failed read as `invalid — not found`; `config-rows.ts` reads the external gitignore file the same way and marks the row open when Bun throws. `resolve` remains only where the full path is built from the project root, since `Bun.file` resolves a relative path against the working directory. A relative `external_gitignore` value is therefore read against the working directory, not the project root. Also `SHIPPED_LANGUAGES` became a plain array. Verified: a missing config and a missing external gitignore are reported; the repository's own config still prints `complete`; biome, `bun check --strict` and the plugin gates pass.

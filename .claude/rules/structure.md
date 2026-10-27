# Structure — where things live and what may touch what

There is no canonical directory tree pinned in `CLAUDE.md` — the tree changes faster than any copy of it, so the filesystem is the truth. This rule carries what a tree cannot say: ownership and dependency direction.

## Two worlds: this repo vs the target project

Everything under `skills/`, `assets/`, `bin/`, `hooks/` is the PLUGIN. The `.sdd/` directories, spec files, and `.claude/rules/sdd.md` that skills operate on live in whatever project the plugin is USED on — never here as product state. When dogfooding (this repo runs its own workflow), the same rule reads: plugin files are product; `.sdd/` and `.beans/` are working state, not shippable content.

## The unit of structure: one skill directory

- `skills/<bare-name>/SKILL.md` is the atom — bare lowercase-hyphen names, invoked `/sdd:<name>`. The 15-skill census is a pinned invariant: adding, renaming, or removing a skill changes it and obligates the full verification battery (CLAUDE.md §Verification).
- Two skills carry more than their SKILL.md: `impl/` owns `templates/` — the five subagent role prompts (implementer, task-reviewer, re-review, code-reviewer, debugger), the only in-skill templates; `steering/` owns `references/` (authoring philosophy and core rule templates).
- A new skill gets its directory beside the others — no per-phase subdirectories, no shared skill modules. Cross-skill sharing goes through `assets/`.

## Shared assets and how they are reached

- `assets/rules/` — protocol and rule content (EARS format, review gates, design principles, task generation) that fork skills read and follow.
- `assets/templates/` — document skeletons (requirements, design, research) the fork skills fill by writing.
- Reference both ONLY as `${CLAUDE_PLUGIN_ROOT}/assets/...`; never inline their content into a skill text, and never edit an asset without checking which skills consume it.
- `assets/workflow-map.md` is the default workflow map — the single source of truth for workflow rules. This repo's own `.claude/rules/sdd.md` is its stripped image (the `init` skill's sed pipeline removes the hook-injection wrappers); change them together or not at all.

## Dependency direction (what may touch what)

- `skills/**` may reference: `assets/` (via `${CLAUDE_PLUGIN_ROOT}`), files inside the same skill via `${CLAUDE_SKILL_DIR}`, the `bin/` helpers, the beans CLI, and target-project paths under `.sdd/`.
- `bin/` reads and writes beans only. One writer: `sdd-promote`.
- `hooks/` touches `assets/workflow-map.md` (SessionStart injection), the beans CLI, and the `bin/` helpers (`sdd-phase` behind the skill gate, `sdd-write-guard`'s rules) — nothing else, and never skill bodies.
- `assets/` and `bin/` never reference back into `skills/` — no cycles; shared content stays consumer-agnostic.
- `docs/` depends on everything; nothing depends on `docs/`. `docs/guides/` is user-facing documentation; `docs/superpowers/` is the conversion's own historical record (spec + plan) — read-only history, excluded from the invariant greps by design. Live rules never go there.
- Root `CLAUDE.md` and `.claude/rules/` are development context and steering for THIS repo, not plugin payload; the root CLAUDE.md does not load as plugin context.

## Development state in this repo

Work is tracked in beans (`.beans/`); conversion-era task briefs and reports live under `.superpowers/sdd/`. Follow `CLAUDE.md` §Development workflow — check for an existing bean before starting; the human commits.

_Intent: keep the plugin's shape obvious — skills own behavior, assets own shared knowledge, bin owns mechanical gates, docs own explanation — with dependencies pointing one way._

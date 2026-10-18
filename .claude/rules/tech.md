# Tech — the stack and its verification

There is no application code here. The "source" is:

- **Markdown skill texts** — `skills/<name>/SKILL.md`, each with YAML frontmatter: `name`, `description`, optionally `argument-hint` and `disable-model-invocation` (user-invoked skills such as `discovery` and `init` set the latter), plus `context: fork`, `background` (fork-only), and `model` — all functional per the skills docs. The claude CLI parses this frontmatter; `claude plugin validate .` is the compiler.
- **POSIX sh** — `bin/_sdd-lib.sh` (shared beans-query parsing) plus `bin/sdd-phase`, `bin/sdd-gate`, `bin/sdd-next`, `bin/sdd-verdict`, `bin/sdd-promote`. Read them before changing bean-body formats: they mechanically parse `## Validation` lines, `Doc-hash:` records, and `blockedByIds` edges. `shellcheck` (installed on this machine) must stay clean on every change to `bin/` or `hooks/`.
- **JSON** — `.claude-plugin/plugin.json` (name `sdd`), the co-located `marketplace.json`, and `hooks/hooks.json`.

No package manager, no build step, no test framework. Assume this toolchain: the `claude` CLI, the `beans` CLI, standard `sh`/`grep`/`shasum`. Anything beyond it is missing — report it, never install it.

## Plugin variable resolution

- `${CLAUDE_PLUGIN_ROOT}` — the plugin checkout root; the ONLY way skill texts reference `assets/` and `bin/`.
- `${CLAUDE_SKILL_DIR}` — the invoking skill's directory; used by impl for its `templates/` role prompts.
- Both expand in the main conversation only. Subagent dispatch prompts are plain text: resolve to absolute paths before dispatching (impl Hard rule 3).

## Hook mechanics

`hooks/hooks.json` wires four events:

- **SessionStart** (matcher `startup|clear|compact`): if the target project has no `.claude/rules/sdd.md`, the hook cats `${CLAUDE_PLUGIN_ROOT}/assets/workflow-map.md` — the wrapped default map. `beans prime` also runs on SessionStart and PreCompact so tracker context survives compression. Precedence is by design: a user-owned rules file silences the injection, even when stale.
- **PreToolUse** (matcher `Skill`): `hooks/sdd-skill-gate.sh` normalizes the skill name and runs `bin/sdd-phase`; a failed precondition denies the call (exit 2 — the diagnosis, with its fixing `/sdd:<name>` command, reaches the model as the denial reason). Covers model-initiated Skill calls; a user typing `/sdd:<name>` goes through UserPromptExpansion instead.
- **PreToolUse** (matcher `Edit|Write`): `hooks/sdd-write-guard.sh` blocks tracker-integrity violations — file writes into `.beans/` (CLI-only) and checkbox lists written under `.sdd/` (the plan and its progress live in the bean graph).
- **UserPromptExpansion** (matcher `^sdd:`): the same `sdd-skill-gate.sh` gates directly typed `/sdd:<name>` commands before expansion (this event covers the typed path — PreToolUse does not — and can block). Matcher semantics matter: a letters-only value would be an EXACT match and never hit `sdd:<name>` commands; the `^sdd:` regex (non-alphanumeric chars switch to regex mode) is required. The skills' own mandatory first-step `sdd-phase` run covers the path even where the hook does not fire.

## bin/ helper contracts

| Helper                                        | Writes                           | Contract                                                                                                                                                                                          |
| --------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sdd-phase <skill-name>`                      | nothing                          | exit 0 iff the skill's phase precondition holds (per-skill map; `impl` delegates to the full `sdd-gate`); failure prints a one-line diagnosis naming the fixing command                           |
| `sdd-gate <epic-id>`                          | nothing                          | exit 0 iff the epic is impl-ready: three completed phase beans, `validated` tags plus current `Doc-hash:` on requirements/design, and a runnable or finished task queue anywhere in the task tree |
| `sdd-next`                                    | nothing                          | prints the next actionable leaf of the active feature's task tree (`NEXT:`), pending `ROLLUP:` containers, or `FINISHED`; blockers, ancestor chaining, and `## Blocker` notes gate the selection  |
| `sdd-verdict <bean-id> [field]`               | nothing                          | prints the latest `- FIELD: TOKEN` token from the bean body; rounds append, so the last match wins                                                                                                |
| `sdd-promote <epic-id> --all \| <bean-id>...` | `beans update <id> -s todo` only | the sole write helper in the plugin; promotes draft descendants of the epic (any depth, phase beans never); everything else stays read-only                                                       |

The task tree shape is a beans-CLI constraint, not a choice: task beans parent only under milestone/epic/feature, and feature-under-feature is refused — so majors are `feature`-type containers and leaves are `task` beans; deeper decomposition flattens to dotted numbers plus `blockedByIds` edges.

Adding a second write path or broadening `sdd-promote`'s writes is a design change, not a convenience — raise it, don't slip it in.

## Verify before claiming done

After any content change to `skills/`, `assets/`, `hooks/`, or `bin/`:

1. `claude plugin validate .` — must pass.
2. The invariant grep battery and the Revision 9 twin checks — scope, exact patterns, and the paired-diff method are pinned in `CLAUDE.md` §Verification (which points into the two design docs under `docs/superpowers/specs/`). Run them from there; do not copy patterns into summaries — copies drift.
3. `plugins/sdd/helper-tests.sh` — the `bin/` helper sandbox suite (25 checks: phase gates, stale-hash + latest-wins, drafts, promote guards, tree walk, rollups, ancestor chaining, resume, finished, single-active). Self-contained mktemp store; leaves nothing behind. `shellcheck` must stay clean on any change to `bin/` or `hooks/`.

For manual testing: `claude --plugin-dir /path/to/cc-sdd`; `/reload-plugins` in-session then picks up skill-text edits without a restart.

## Conventions that keep the plugin loadable

- Reference shared content, never inline it: skill texts point at `${CLAUDE_PLUGIN_ROOT}/assets/...`; the global beans guide gets one-line references only (CLAUDE.md §Editing rules).
- Document templates under `assets/templates/` are instruction-style — fork skills fill them by writing content; a double-brace placeholder is an invariant-grep failure.
- Keep user-facing docs (`docs/guides/`: skill reference, workflow walkthrough, rationale) in step with behavior changes.

_Intent: treat prompts, shell helpers, and the validate-plus-grep battery as this project's language, compiler, and tests — and run them before every "done"._

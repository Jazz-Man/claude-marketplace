# sdd — Kiro-style Spec-Driven Development (Claude Code plugin)

This repository is a local Claude Code plugin marketplace. Its main product is
the sdd plugin — prompt-only skills for spec-driven development (discovery →
requirements → design → tasks → implementation → validation) with
subagent-first execution, invoked as `/sdd:<name>`; other plugins live beside
it as siblings and change over time. Settled layout facts: every plugin (with
its skills, hooks, and LSP configs) lives under `plugins/`; TypeScript sources
for the binaries some plugins ship live under `packages/`. There is no
installer and no runtime data directory created in user projects — specs live
under `.sdd/` in whatever project the plugin is used on.

This file is development context for THIS repository, not user documentation.

## Editing rules

- The user reviews, tests, and commits at each stop point.
- Skills may NOT flip task checkboxes or write progress/approval state — beans
  is the only tracker.
- Do not duplicate the global beans guide in skill texts; one-line references
  only.
- No double-brace placeholders anywhere — templates are instruction-style
  documents the fork skills fill by writing content.

## Verification

- `claude plugin validate .` must pass. With a marketplace manifest present it
  validates the marketplace and passes clean; this root `CLAUDE.md` does not
  load as plugin context.
- Invariant greps over the sdd plugin's content (`plugins/sdd/`) must return
  zero hits: unresolved double-brace placeholders, the old Kiro
  settings-directory convention, and old skill names carrying the Kiro prefix.
- The skill directories under `plugins/sdd/skills/` stay in sync with the
  workflow map's skill table (`plugins/sdd/assets/workflow-map.md`).
- The Revision 4-9 battery (twin checks, six-fork count-greps, and the
  checkbox/git/beans duplication greps) was pinned in design docs that no
  longer exist and left no git trace — re-derive before relying on it.
- After content changes to skills or assets, re-run the greps and
  `claude plugin validate .` before claiming done.

## Development workflow (this repo)

- Work is tracked in beans (`.beans/`); before starting, check for an existing
  bean, otherwise create one and keep its checklist current. Commit messages
  include the bean file changes alongside code.
- The human reviews and commits.

<!-- rtk-instructions v2 -->

# Command output

Command output here is condensed to save tokens, keeping every signal and
dropping costly noise. Treat it as the complete result: run commands
normally, and batch related commands into one call to avoid extra turns.
Truncated results state their recovery path in their own output. Re-run a
command as `rtk proxy <cmd>` only when its result is unusable: empty when
output was clearly expected, contradicting its exit code, or garbled.
<!-- /rtk-instructions -->

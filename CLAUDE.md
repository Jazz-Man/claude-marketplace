# sdd — Kiro-style Spec-Driven Development (Claude Code plugin)

This repository is a local Claude Code plugin marketplace; the sdd plugin lives
at `plugins/sdd/` (the main plugin) alongside `plugins/biome-lsp/` (a
language-server plugin wiring biome for JS/TS/JSON/CSS) and
`plugins/security-guard/` (a PreToolUse guard running the
claude-code-cli-hook policy binary). The sdd plugin ships prompt-only
skills for spec-driven development (discovery → requirements → design → tasks →
implementation → validation) with subagent-first execution. Skills are invoked as `/sdd:<name>`; skill texts resolve
shared files via `${CLAUDE_PLUGIN_ROOT}`. There is no installer and no runtime data
directory created in user projects — specs live under `.sdd/` in whatever project
the plugin is used on.

This file is development context for THIS repository, not user documentation.

## Layout

```
cc-sdd/                          marketplace root (this repository)
├── .claude-plugin/
│   └── marketplace.json        marketplace manifest; the sdd entry's source
│                               resolves the plugin at plugins/sdd
├── plugins/
│   └── sdd/                    the sdd plugin — complete, self-contained unit;
│                               future plugins land as sibling subfolders
│       ├── .claude-plugin/
│       │   └── plugin.json     plugin manifest (name: sdd)
│       ├── skills/             one directory per skill, bare names
│       │   ├── init/           writes the user-owned .claude/rules/sdd.md (opt-in)
│       │   ├── discovery/      action-path triage; writes the workstream brief
│       │   │                   (.sdd/brief.md); queues follow-up features as
│       │   │                   milestone/epic beans
│       │   ├── spec-init/      creates spec skeleton under .sdd/specs/<feature>/
│       │   ├── spec-requirements/  EARS requirements + review gate
│       │   ├── validate-requirements/  EARS/completeness/contradictions gate (generative fork)
│       │   ├── spec-design/    design + discovery + review gate (generative fork)
│       │   ├── spec-tasks/     task plan + sanity review (generative fork)
│       │   ├── impl/           orchestrator; templates/ holds subagent prompts
│       │   ├── review/         task-local adversarial review protocol
│       │   ├── debug/          root-cause-first debug protocol
│       │   ├── verify-completion/  fresh-evidence completion gate
│       │   ├── validate-gap/   requirements vs existing codebase analysis
│       │   ├── validate-design/  interactive design quality review
│       │   ├── validate-impl/  feature-level GO/NO_GO validation
│       │   └── steering/       manages .claude/rules/ in target projects
│       ├── assets/             shared content referenced by skills
│       │   ├── rules/          rule files (EARS format, review gates, …)
│       │   ├── templates/      document templates (requirements, design, research, …)
│       │   ├── workflow-map.md the default workflow map (SessionStart injection)
│       │   └── design-system_flow.png  design-system flow diagram
│       ├── bin/                _sdd-lib.sh + sdd-phase, sdd-gate, sdd-next,
│       │                       sdd-verdict, sdd-promote helpers (Revision 7 + tree model)
│       ├── hooks/              SessionStart (map injection), PreToolUse skill gate
│       │                       + write guard, UserPromptExpansion direct-typing gate
│       ├── docs/guides/        user-facing guides
│       └── README.md           plugin README
│
├── plugins/biome-lsp/          biome language server as a plugin:
│       ├── .claude-plugin/
│       │   └── plugin.json     plugin manifest (name: biome-lsp)
│       ├── .lsp.json           biome lsp-proxy for .ts/.tsx/.js/.jsx/.mjs/
│       │                       .cjs/.json/.jsonc/.css (diagnostics/format/code
│       │                       actions; no symbols/hover)
│       └── README.md           requirements + what it covers
│
├── plugins/security-guard/     PreToolUse(Bash) guard as a plugin:
│       ├── .claude-plugin/
│       │   └── plugin.json     plugin manifest (name: security-guard)
│       ├── hooks/hooks.json    matcher Bash -> claude-code-cli-hook binary
│       │                       (packages/cli-hook policies: filesystem,
│       │                       no-deps, git-readonly, no-inline-scripts;
│       │                       fail-open)
│       └── README.md           build prerequisite + migration notes
├── CLAUDE.md                   development context (this file)
├── LICENSE                     repository-level license for the whole tree
├── docs/superpowers/           this conversion's spec and plan (self-referential;
│                               excluded from invariant greps)
└── .sdd/  .beans/  .superpowers/  .claude/  .zed/  .beans.yml  .gitignore
                                working state and repo config
```

Skill texts reference assets as `${CLAUDE_PLUGIN_ROOT}/assets/rules/...` and
`${CLAUDE_PLUGIN_ROOT}/assets/templates/...`. In-skill prompt templates used by the
impl orchestrator live beside its `SKILL.md` under
`plugins/sdd/skills/impl/templates/`.

## Editing rules

- The user reviews, tests, and commits at each stop point (spec §5.4).
- Skills may NOT flip task checkboxes or write progress/approval state — beans
  is the only tracker (spec §6).
- Do not duplicate the global beans guide in skill texts; one-line references only.
- No double-brace placeholders anywhere — templates are instruction-style
  documents the fork skills fill by writing content.

## Verification

- `claude plugin validate .` must pass. With `.claude-plugin/marketplace.json`
  present it validates the marketplace manifest and passes clean — the old
  "missing `author`" accepted-warning is gone (the field exists; the marketplace
  manifest also changes what validate reports on). This root `CLAUDE.md` still
  does not load as plugin context.
- Invariant greps (must return zero hits; scope `plugins/sdd/skills/
plugins/sdd/assets/ plugins/sdd/hooks/ plugins/sdd/README.md CLAUDE.md
plugins/sdd/docs/guides/`, plus `plugins/sdd/bin/` for the convention set):
  unresolved double-brace placeholders, the old Kiro settings-directory
  convention, and old skill names carrying the Kiro prefix. Exact patterns and
  the full battery (checkbox-flip, git-write, beans-duplication, and the
  Revisions 4-7 convention invariants: zero plan-document/notes-file
  references, NO_GO spelling, six forks, 15-skill census) are in
  `docs/superpowers/specs/2026-09-22-sdd-plugin-conversion-design.md` §10.
- Twin checks (Revision 9, scope `plugins/sdd/skills/`): the GP-1
  fork-resolution and RS-1 FORK-identity count-greps each return exactly 6 —
  one hit per fork file; the spec-requirements/spec-design approve-gate twin
  blocks (`plugins/sdd/skills/spec-requirements/SKILL.md` and
  `plugins/sdd/skills/spec-design/SKILL.md`) are slot-substitution-identical
  (diff empty after the four-slot normalization); deleted delegation sentences
  return zero hits; the 15-skill census over `plugins/sdd/skills/` returns
  exactly 15. The working patterns and paired-diff method are pinned in the
  §4 erratum of
  `docs/superpowers/specs/2026-09-25-content-normalization-design.md`.
- The pattern texts pinned in the two historical design documents above apply
  with the `plugins/sdd/` prefix; those documents are append-only records and
  are not edited.
- e2e dry run per the re-pointed runbook.
- After content changes to skills or assets, re-run the greps and
  `claude plugin validate .` before claiming done.

## Development workflow (this repo)

- Work is tracked in beans (`.beans/`); before starting, check for an existing
  bean, otherwise create one and keep its checklist current. Commit messages
  include the bean file changes alongside code.
- The human reviews and commits.
- The conversion spec and task plan live in `docs/superpowers/`; task briefs and
  reports live in `.superpowers/sdd/2026-09-22-sdd-plugin-conversion/`.

<!-- rtk-instructions v2 -->

# Command output

Command output here is condensed to save tokens, keeping every signal and
dropping costly noise. Treat it as the complete result: run commands
normally, and batch related commands into one call to avoid extra turns.
Truncated results state their recovery path in their own output. Re-run a
command as `rtk proxy <cmd>` only when its result is unusable: empty when
output was clearly expected, contradicting its exit code, or garbled.
<!-- /rtk-instructions -->

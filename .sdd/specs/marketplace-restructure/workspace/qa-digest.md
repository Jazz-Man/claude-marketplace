# Q&A digest — marketplace-restructure (2026-09-26)

Feature: marketplace-restructure — restructure the repo into a personal
Claude Code plugin marketplace with sdd as the first plugin in its own
subfolder.

User intent from the invoking request: requirements are expected to be
LEAN ("вимог не багато"); all future plugins live in a `plugins/` folder
at the repo root; the organization should follow the official Claude
Code documentation and its recommendations (docs research dispatched;
summary appended below when it returns).

## Interview

Q1 (from invocation): Where do plugins live?
A1: Every current and future plugin gets its own subfolder under
`plugins/` at the repository root. The sdd plugin moves to
`plugins/sdd/`.

Q2: What must be true when the restructure is done? (multi-select)
A2: THREE acceptance criteria selected:

- **Validate green**: `claude plugin validate` passes on the new layout
  (root `marketplace.json` listing plugins by path;
  `plugins/sdd/.claude-plugin/plugin.json` in place).
- **Working install**: after the user re-points the local marketplace
  registration, `/sdd:*` skills load, the SessionStart hook injects the
  workflow map, `${CLAUDE_PLUGIN_ROOT}` resolves to `plugins/sdd`.
- **Battery green**: the invariant greps and Revision 9 twin checks are
  re-scoped to the new paths and pass (zero hits / exactly 6 where
  pinned today).
  NOT selected — **clean root**: no requirement that the repo root hold
  zero plugin-payload files; the move itself is the core change but root
  cleanliness is not an acceptance criterion.

Q3: Rename the marketplace identity `sdd-local`?
A3: Keep `sdd-local` for now; renaming is deferred until a second
plugin actually lands. The plugin reference in the user's config stays
`sdd@sdd-local`.

## Settled scope

- **In**: move plugin payload (`skills/`, `assets/`, `bin/`, `hooks/`,
  `plugin.json`) into `plugins/sdd/`; root `marketplace.json` re-pointed
  (`source: "./plugins/sdd"`); verification battery + CLAUDE.md
  (§Layout, §Verification) + README + e2e-runbook re-scoped to new
  paths; user re-adds the local marketplace.
- **Out**: adding any second plugin; changes to skill texts (files move
  verbatim); `.zed/` and `.github/workflows/`; publishing to public
  marketplaces; renaming the marketplace identity.

## Constraints, rules, edge cases

- File moves execute as `git mv` ONLY — the agent issues commands at
  the right moments, the user runs them (git stays human-owned).
- Transition edge: the existing `sdd@sdd-local` registration breaks on
  `source` change until the user re-adds it; same marketplace name means
  the re-add replaces in place.
- Repo-level working state (`.sdd/`, `.beans/`, `.superpowers/`,
  `.claude/rules/`, `CLAUDE.md`, `docs/superpowers/`) is not plugin
  payload and is not required to move; final placement of borderline
  items (`docs/guides/`, README, LICENSE) is a design decision recorded
  in `.sdd/brief.md` open questions.
- Requirements must be technology-agnostic (WHAT not HOW); layout detail
  beyond `plugins/<name>/` belongs to design.

## Research context

Official Claude Code docs research (2026-09-26), 4 pages:

1. Multi-plugin marketplaces are the documented model: root
   `.claude-plugin/marketplace.json` (required `name`, `owner`,
   `plugins`); each entry requires `name` + `source`; `source` accepts
   a relative path string from the marketplace root (must start `./`,
   `..` fails validation), a bare name when `metadata.pluginRoot` is
   set (v2.1.239+), or an object (`github`, `url`, `git-subdir`, `npm`,
   `archive`, `command`). Absolute paths are not a documented form.
2. Layout: no normative rule, but the documented walkthrough uses
   marketplace root + `plugins/<name>/` subdirs with
   `source: "./plugins/<name>"` — matching this feature's settled
   `plugins/` decision. Plugin folders at repo root also work.
3. Per-plugin `.claude-plugin/plugin.json` at each plugin root;
   `skills/`, `hooks/` etc. sit at the plugin root, NOT inside
   `.claude-plugin/`. Manifest optional (standard layout scanned), but
   present here.
4. `claude plugin marketplace add <local-path>` reads the root
   marketplace.json; relative sources resolve from the marketplace
   root; local marketplaces load plugin files in place — edits live at
   next session or `/reload-plugins`. Missing dirs fail at install,
   not validate.
5. `strict` (default) requires entry `name` == manifest `name` (holds:
   `sdd`/`sdd`). NOT documented: shared assets across sibling plugins,
   README placement, source-path overlap rules — open for design.

Sources:

- https://code.claude.com/docs/en/plugins
- https://code.claude.com/docs/en/plugins/create-marketplace
- https://code.claude.com/docs/en/plugins/marketplace-reference
- https://code.claude.com/docs/en/plugins/manifest-reference

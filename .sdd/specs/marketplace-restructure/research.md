# Research & Design Decisions

## Summary

- **Feature**: `marketplace-restructure`
- **Discovery Scope**: Extension (light discovery — restructures the existing repository layout; no new runtime code, no new dependencies)
- **Key Findings**:
  - The Claude Code platform's documented multi-plugin marketplace model covers
    everything this feature needs: root `.claude-plugin/marketplace.json` with one
    entry per plugin, each `source` a relative path from the marketplace root.
    `source: "./plugins/sdd"` is the documented walkthrough form; nothing has to
    be invented.
  - Every internal cross-reference inside the plugin payload already travels
    through `${CLAUDE_PLUGIN_ROOT}` (skills → assets, hook → workflow map, impl →
    bin helpers), so the payload moves verbatim with zero content edits.
  - The only content edits after the moves are path references outside the
    payload: the root marketplace manifest `source` line, CLAUDE.md §Layout and
    §Verification, a handful of README lines, and one e2e-runbook line.

## Research Log

### Platform behavior (marketplace manifest, sources, registration)

- **Context**: The design leans on exact `source` semantics, plugin-manifest
  placement, and re-registration behavior. The Q&A digest (2026-09-26) carried a
  4-page official-docs summary; the load-bearing facts were re-verified against
  the marketplace-reference page during this discovery.
- **Sources Consulted**:
  - https://code.claude.com/docs/en/plugins/marketplace-reference (fetched 2026-09-26)
  - https://code.claude.com/docs/en/plugins/create-marketplace (via qa-digest research)
  - https://code.claude.com/docs/en/plugins/manifest-reference (via qa-digest research)
- **Findings** (quotes from marketplace-reference, 2026-09-26):
  - "Save the marketplace file at `.claude-plugin/marketplace.json` in your
    marketplace's directory."
  - "The directory that contains `.claude-plugin/` is called the marketplace
    root, and every relative plugin source resolves from it, not from
    `.claude-plugin/`."
  - "`./plugins/formatter` is `<root>/plugins/formatter` even though the
    marketplace file is in `<root>/.claude-plugin/`. A path containing `..`
    fails validation." — confirms `source: "./plugins/sdd"` resolves correctly.
  - "Use a relative path for a plugin in a subdirectory of the marketplace
    repository itself." — our exact case (directory-type marketplace source).
  - "`plugin.json` present: `plugin.json` is the manifest." — the plugin's own
    `.claude-plugin/plugin.json` inside `plugins/sdd/` is authoritative; the
    entry's display fields (description) remain advisory.
  - "Each user registers one marketplace per `name`, so a user can't have two
    marketplaces with the same name registered at once." — underpins re-add
    replacing the `sdd-local` registration in place.
  - Bare names under `metadata.pluginRoot` (`"pluginRoot": "./plugins"` +
    `"source": "sdd"`) are a documented alternative; "Requires Claude Code
    v2.1.239 or later."
- **Implications**: The marketplace manifest stays at the repo root and only its
  `source` value changes. The plugin manifest moves with the plugin. No
  version-gated features are needed.

### Codebase survey: what moves, what stays, what references what

- **Context**: File Structure Plan and battery re-scoping need a complete
  inventory of tracked content and every cross-reference that could break.
- **Sources Consulted**: `git ls-files`, direct reads of both manifests,
  `hooks/hooks.json`, `.claude/settings.json`, README, CLAUDE.md, bin helpers,
  e2e runbook; greps for `skills/`, `assets/`, `bin/`, `hooks/`, `docs/guides`,
  `plugin-dir` across the repo.
- **Findings**:
  - Tracked plugin payload at root today: `skills/` (15 skills), `assets/`
    (rules/templates/workflow-map + one png), `bin/` (sdd-gate, sdd-promote,
    sdd-verdict), `hooks/hooks.json`, `.claude-plugin/plugin.json`,
    `.claude-plugin/marketplace.json` (the marketplace manifest — stays),
    `docs/guides/` (3 user-facing guides), `README.md`, `LICENSE`.
  - Repo-level working state (does not move): `.sdd/`, `.beans/` + `.beans.yml`,
    `.superpowers/` (gitignored), `.claude/` (rules + settings.json),
    `docs/superpowers/`, `CLAUDE.md`, `.zed/`, `.gitignore`, `tmp/` (gitignored).
  - Payload-internal references are all `${CLAUDE_PLUGIN_ROOT}`-relative:
    hooks.json → `assets/workflow-map.md`; skills → `assets/rules/*`,
    `assets/templates/*`, `bin/sdd-gate` etc. They survive the move verbatim
    because `CLAUDE_PLUGIN_ROOT` resolves to the plugin root (`plugins/sdd`).
  - Path references that DO break and need edits (all outside the moved payload
    except README):
    - `.claude-plugin/marketplace.json`: `source: "./"` → `"./plugins/sdd"`.
    - `README.md`: `claude --plugin-dir /path/to/cc-sdd` (line 24), relative
      `docs/guides/...` links (lines 256-258 — stay valid only if README moves
      with the guides), `docs/superpowers/` mention (line 260), `[LICENSE](LICENSE)`
      link (line ~268).
    - `.superpowers/sdd/2026-09-22-sdd-plugin-conversion/e2e-runbook.md`:
      `claude --plugin-dir ~/www/cc-sdd` (line 15) → `~/www/cc-sdd/plugins/sdd`.
    - `CLAUDE.md`: §Layout tree and §Verification battery scope strings.
  - bin helpers contain no repo-relative path assumptions (they operate on beans
    and document paths passed in).
  - `docs/guides/` internal path mentions are prose, not links — no breakage.
  - Current registration (read-only check, `claude plugin marketplace list`):
    `sdd-local` → Directory (`/Users/vasilsokolik/www/cc-sdd`); repo
    `.claude/settings.json` enables `sdd@sdd-local`.
  - Baseline: `claude plugin validate` passes today on the root marketplace
    manifest with `source: "./"`.
- **Implications**: The move set is settled; the edit set is small and enumerable.
  README + guides must move together (relative links); LICENSE placement and the
  README's repo-level references are the only genuinely open placement choices.

### Verification battery inventory

- **Context**: R5 requires the battery to check the same invariants over the new
  layout with pinned results (zero hits, or exactly 6 where pinned).
- **Sources Consulted**: CLAUDE.md §Verification;
  `docs/superpowers/specs/2026-09-22-sdd-plugin-conversion-design.md` §10;
  `docs/superpowers/specs/2026-09-25-content-normalization-design.md` §4 + erratum.
- **Findings**:
  - Battery members today: zero-hit greps (`{{`, `.kiro`, `kiro-`,
    checkbox-flip, spec.json phase writes, git-write instructions, beans-guide
    duplication, delegation-absence sentences) over scope
    `skills/ assets/ hooks/ README.md CLAUDE.md docs/guides/`; convention set
    additionally over `bin/`; three exactly-6 twin count-greps over `skills/`;
    the approve-gate paired-diff (awk/sed/diff) over spec-requirements +
    spec-design; the 15-skill census; `claude plugin validate .`; the e2e dry
    run.
  - Every pattern's target content moves verbatim, so pinned counts are
    position-invariant: re-scoping is purely a scope-string change
    (`plugins/sdd/` prefix on the moved members; `CLAUDE.md` stays unprefixed).
  - The authoritative pattern texts live in `docs/superpowers/` spec docs,
    which are self-referential conversion history (deliberately excluded from
    the battery scope). CLAUDE.md §Verification is the living summary that
    pins the scope.
- **Implications**: Re-scope = update CLAUDE.md §Verification scope strings;
  leave the historical spec docs untouched (they record the conversion as it
  happened); the e2e runbook's `--plugin-dir` line gets the new plugin path.

## Architecture Pattern Evaluation

| Option                                   | Description                                                                                                                                             | Strengths                                                                                                                                                              | Risks / Limitations                                                                                                                                                                                           | Notes                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| A. Self-contained plugin folder          | Everything plugin-facing (code, manifests, guides, README) moves under `plugins/sdd/`; repo root keeps marketplace manifest, LICENSE, and working state | Plugin is a complete movable unit; symmetric shape for future plugins; battery scope becomes one uniform prefix; matches the documented marketplace walkthrough layout | GitHub repo page loses its root README render (minor for a personal, local, unpublished marketplace); README→LICENSE link needs a repo-level pointer                                                          | Recommended                                 |
| B. Code moves, docs stay at root         | skills/assets/bin/hooks + plugin.json move; README, docs/guides, LICENSE stay at repo root as marketplace-level docs                                    | GitHub page keeps rendering README                                                                                                                                     | Plugin documentation lives outside the plugin; README's relative guide links break and become cross-tree links; future plugins' docs would collide at root — the exact collision problem this feature removes | Rejected                                    |
| C. Source form via `metadata.pluginRoot` | Root manifest sets `"pluginRoot": "./plugins"` and entries use bare names (`"source": "sdd"`)                                                           | Shorter entries as plugin count grows                                                                                                                                  | Requires Claude Code v2.1.239+; saves nothing with one plugin; adds a metadata indirection to learn                                                                                                           | Rejected (revisit if the marketplace grows) |

## Design Decisions

### Decision: plugin payload placement (Option A)

- **Context**: R1 fixes `plugins/sdd/`; the placement of `docs/guides/`,
  README.md, and LICENSE is explicitly left to design.
- **Alternatives Considered**: A (self-contained plugin folder) vs B (code moves,
  docs stay) as in the evaluation table above.
- **Selected Approach**: A — `plugins/sdd/` holds skills, assets, bin, hooks,
  `.claude-plugin/plugin.json`, `docs/guides/`, and `README.md`. LICENSE stays at
  the repository root as the single license covering the whole marketplace repo;
  the moved README's license section points at the repository-level LICENSE.
- **Rationale**: One folder = one plugin, complete and movable; future plugins
  repeat the shape without root collisions; the battery scope collapses to a
  single `plugins/sdd/` prefix plus `CLAUDE.md`. A personal local marketplace
  gains nothing from a root README that option B would preserve.
- **Trade-offs**: The GitHub repo page will render no README (acceptable;
  publishing is out of scope). README's `docs/superpowers/` mention and LICENSE
  link become repo-level references (`../../`), edited under R5.
- **Follow-up**: Verify README links resolve from their new location during
  implementation.

### Decision: source form — explicit relative path

- **Context**: R2.1 requires the manifest to reference the plugin by path under
  `plugins/`.
- **Alternatives Considered**: `"source": "./plugins/sdd"` (explicit) vs
  `metadata.pluginRoot` + bare name (Option C above).
- **Selected Approach**: `"source": "./plugins/sdd"`.
- **Rationale**: Documented walkthrough form; resolves from the marketplace root
  by platform rule; no minimum CLI version; the entry remains self-describing.
- **Trade-offs**: One extra path segment per entry compared to pluginRoot —
  irrelevant at one plugin.
- **Follow-up**: None.

### Decision: battery definition home after re-scope

- **Context**: R5.1-5.2 require the same invariants with pinned results over the
  new layout; the pattern texts live in historical spec docs whose scope strings
  describe the pre-move layout.
- **Alternatives Considered**: (1) CLAUDE.md §Verification carries the re-scoped
  scope strings and stays the living definition; (2) edit the historical spec
  docs' §10 scope strings in place; (3) add a standalone battery document.
- **Selected Approach**: (1). CLAUDE.md §Verification names the post-restructure
  scope (`plugins/sdd/...` members plus `CLAUDE.md`) and notes that the pattern
  texts pinned in the spec docs apply unchanged with the new prefix.
- **Rationale**: The spec docs are append-only conversion history — editing them
  falsifies the record; a new battery document duplicates CLAUDE.md's summary
  (DRY violation). CLAUDE.md is already the living verification entry point.
- **Trade-offs**: Historical docs and living battery differ in scope spelling —
  mitigated by CLAUDE.md stating the prefix mapping explicitly.
- **Follow-up**: None.

### Decision: single move batch, then manifest, then re-registration

- **Context**: R4 requires user-run `git mv` of unmodified files; R3.6
  acknowledges a broken-registration window.
- **Alternatives Considered**: One atomic move batch (all `git mv` commands
  together) vs staged batches per directory with validate checkpoints between.
- **Selected Approach**: One move batch (directories pre-created with
  `mkdir -p` in the same handed block, since `git mv` requires an existing
  destination directory), then the one-line manifest edit, then validate as the
  first green checkpoint, then battery/doc re-scoping, then the user re-adds the
  marketplace, then a fresh-session behavioral check.
- **Rationale**: Every intermediate state between the first `git mv` and the
  manifest edit is red (plugin.json absent from the old root path); a single
  batch makes the broken window one interval with one repair, and the validate
  checkpoint lands at the first genuinely consistent state.
- **Trade-offs**: The handed block is ~8 commands instead of ~3 — still one
  reviewable unit.
- **Follow-up**: Confirm `git log --follow` reaches pre-move history for a
  sample of moved files (R4.3).

## Risks & Mitigations

- Re-add behavior: replace-in-place is documented (one registration per name)
  and pinned by R3.2, but if the CLI refuses a same-name re-add, the fallback is
  `claude plugin marketplace remove sdd-local` followed by
  `claude plugin marketplace add <repo-path>` — verify at execution.
- Undocumented validation rules about the marketplace root containing
  non-plugin directories (`.sdd/`, `.beans/`, `docs/`, ...) — none are
  documented, and the current root already passes with similar content
  present; validate immediately after the move batch + manifest edit.
- README relative links from the new depth (`docs/superpowers/`, `LICENSE`) —
  enumerate and re-point in the same change; link-check by eye during review.
- The e2e runbook being updated (R5.3) lives in gitignored `.superpowers/` —
  the update is real but unversioned; noted so nobody expects it in the commit.

## References

- [Marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference) — source forms, marketplace root resolution, registration semantics (fetched 2026-09-26)
- [Create a marketplace](https://code.claude.com/docs/en/plugins/create-marketplace) — documented `plugins/<name>/` walkthrough layout (via qa-digest research, 2026-09-26)
- `docs/superpowers/specs/2026-09-22-sdd-plugin-conversion-design.md` §10 — battery definition (historical)
- `docs/superpowers/specs/2026-09-25-content-normalization-design.md` §4 + erratum — twin-check working patterns (historical)
- `.sdd/specs/marketplace-restructure/workspace/qa-digest.md` — interview intent and prior platform research

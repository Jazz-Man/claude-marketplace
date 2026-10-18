# Workstream Brief

## security-guard (2026-10-07)

### Intent

The user runs Claude Code almost always with bypass permissions on and wants a
full security guard that still binds in that mode: a personal plugin (third
`plugins/` sibling) whose PreToolUse hooks block filesystem reads/writes
outside the working directory and into secret paths, and security-scan Bash
commands — while allowing plugins (`plugins/sdd` today) to read their own
templates and run their own scripts from their plugin folders. Engine:
`packages/cli-hook` (Bash-only PreToolUse policy router today, unwired).
Mandated design input: `docs/claude-code-security-guard-bypass-permissions.md`
(§10 blueprint, §11 empirical findings).

### Scope

- **In**: cli-hook extension (Read/Edit/Write/Glob/Grep payload shapes,
  path-based policies with canonicalization, trusted plugin-root allowlist,
  executable packaging); new `plugins/` sibling with hooks.json + marketplace
  entry + validation battery; deny-rules/settings hardening kit per research
  §10 (documented, human-applied); folding in §11 findings (config
  self-modification vector, new-file-creation gap).
- **Out**: changes to `plugins/sdd` itself; publishing/public distribution;
  automated enforcement of sandbox settings (plugin payload is hooks only).

### Decisions

- Route: **single new feature `security-guard`**, full sdd cycle. Rationale:
  the engine has no standalone value without the plugin and the plugin is
  empty without the engine — the seams are design-internal, not independent
  deliverables. Multi-spec rejected (first spec would ship nothing
  user-visible); no-spec rejected (large architectural surface — new payload
  kinds, canonicalization, packaging, placement — deserves design review).
- No active epic existed at discovery (2026-10-07); the feature starts
  immediately — `/sdd:spec-init` births the epic, no queueing needed.
- Discovery survey (one general-purpose agent, 2026-10-07) established:
  cli-hook is a fail-open Bash-only PreToolUse router consumed nowhere;
  plugins/sdd reaches its own folder via Read (`${CLAUDE_PLUGIN_ROOT}/assets`,
  `${CLAUDE_SKILL_DIR}/templates`), hook exec, and Bash runs of `bin/`
  helpers — all outside a target project's working dir. The collision with
  the user's live global `blockReadsOutsideWorkingDirectories` + deny rules
  is real today.
- No-deps compatibility: building on cli-hook is the only path on the
  already-installed stack (unbash, agent-types, Bun).

### Open Questions

- Does Claude Code auto-add plugin roots to working directories? [Unverified]
  — resolved in design; determines how loud the plugin-root allowlist must be.
- Runtime shape of the hook entry (bun-invoked TS vs compiled shim) vs the
  fail-open timeout budget — design.
- Secret-path deny set, plugin naming, interplay with the existing global
  `blockReadsOutsideWorkingDirectories` (keep / replace / complement) —
  requirements.

### Queue

No beans yet — `/sdd:spec-init` births the epic for this feature.

## marketplace-restructure (2026-09-26)

### Intent

The user wants one personal repo hosting multiple Claude Code plugins/skills under
separate namespaces, each plugin in its own subfolder. Today the repo root IS the
single sdd plugin (`.claude-plugin/marketplace.json` lists it with `source: "./"`),
so nothing else can be added without colliding. When done, the repo is a
marketplace: sdd lives in its own namespaced subfolder as the first plugin, the
manifest and verification battery reflect the new structure, and future plugins
have a place to land.

### Scope

- **In**: target layout design (plugin subfolder vs repo-level split for every
  current root item), marketplace.json re-pointing to the plugin subfolder,
  plugin.json relocation, re-scoping the verification battery and CLAUDE.md
  (§Layout, §Verification) to new paths, README/e2e-runbook path updates,
  ordered `git mv` batches handed to the user at stop points, re-pointing the
  local marketplace registration (`sdd@sdd-local`).
- **Out**: adding any second plugin (separate follow-up features); changes to
  skill texts themselves (files move verbatim); `.zed/` and
  `.github/workflows/`; publishing/public-marketplace distribution.

### Decisions

- **Route: single new feature `marketplace-restructure`**, full sdd cycle.
  Rationale: beyond the moves themselves there is real correctness surface —
  manifest schema, plugin-vs-repo-level split, re-scoping every invariant grep —
  that deserves design review; no genuine seams for a multi-spec split;
  "no spec" rejected because unreviewed battery re-scoping is drift risk.
- **Moves execute as `git mv` only.** The agent issues the commands at the
  right moments; the user runs them (git stays human-owned; agents are
  git read-only by global rule).
- **Future plugins are separate follow-up features**, queued later — not part
  of this boundary.
- **Discovery survey subagent skipped**: session context plus CLAUDE.md already
  covered the module layout (verified this session: 15 skills, `bin/` x3,
  `hooks/hooks.json`, marketplace `source: "./"`).
- **Folder/namespace naming deferred to design** (`plugins/sdd/` vs root-level
  `sdd/`, marketplace identity naming).

### Open Questions

- Target folder convention for plugins — resolved in design.
- Repo/marketplace naming (`sdd-local`, repo `cc-sdd`) — requirements or design.
- Destination of `docs/guides`, README, LICENSE — plugin payload or repo
  level — design.
- Manifest placement: plugin.json inside the plugin subfolder, marketplace.json
  at repo root only — design.

### Queue

Empty — no beans yet. `/sdd:spec-init "marketplace-restructure"` births the
epic and phase beans; beans becomes the source of truth from that point.

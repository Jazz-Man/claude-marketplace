# Biome → Bun lint/fmt migration — design

Date: 2026-10-18. Status: awaiting owner review.

## 1. Context and goal

The repo's only linter (besides `tsc`) and formatter is Biome, configured by the
root `biome.json`. Bun 1.4.4 (installed) ships a native linter (`bun lint`,
1048 built-in rules: `eslint/*`, `@typescript-eslint/*`, `react/*`, `import/*`,
`unicorn/*`, `json/*`, `bun/*`) and a Prettier-compatible formatter
(`bun fmt`), both configured in the already-present root `bunfig.toml`. The
owner ordered a full migration of linting and formatting truth from Biome to
Bun.

The driving pain: agents write excessive, often hallucinated comments. Biome
cannot lint comment content at all (no rule exists; GritQL plugins cannot see
CST trivia — pinned empirically in `code-style.md`). Bun's ESLint plugin API
exposes every comment (`context.sourceCode.getAllComments()`), making the
comment policy mechanically enforceable for the first time.

## 2. Locked decisions (owner rulings, 2026-10-18)

| # | Decision | Consequence |
|---|---|---|
| D1 | **`biome.json` is byte-for-byte untouchable by agents.** No edit, no reformat, no "temporary" formatter flip inside it. Ever. | The IDE-vs-`bun fmt` conflict is solved outside `biome.json` (§7). Verified: `.zed/` has no format-on-save settings, so no automatic conflict exists. |
| D2 | `plugins/biome-lsp/` stays temporarily as an IDE diagnostics bridge reading `biome.json`. | Two configs of overlapping knowledge exist by owner's explicit choice; the drift risk is documented (§8) and a follow-up bean tracks the bridge's removal. |
| D3 | Comment policy is **maximally strict**: every comment is an error, except a closed system allowlist (§5). No JSDoc, no block-comment invariants. | `code-style.md`'s comment section is rewritten from convention to mechanical law; the existing comment corpus is deleted (§6 step 5). |
| D4 | Rule coverage replaces Biome's `preset: "all"` with `[lint.categories]` `pedantic = "error"`, `style = "error"` on top of Bun's defaults, plus explicit per-rule parity (§4). | Closest practical equivalent to "all rules on"; noise is triaged in a probe pass before the config lands. |
| D5 | Zero new dependencies. | Everything is built-in rules plus ONE local plugin file. npm ESLint plugins would be installs — forbidden; if ever wanted, the owner installs. Sole owner-made addition: `@types/eslint` (9.6.1, root devDependencies) for typing the plugin — installed by the owner, part of the fixed set. |
| D6 | **`.zed/` is the owner's editor configuration — agents never touch it.** | No modification of any kind, in this migration or after. Read-only observation (D1's note) is the only interaction ever. |
| D7 | **Severity doctrine (the owner's universal linter principle): every enabled rule emits `error`.** Warnings become errors; anything that would emit `info` becomes `warn`. The owner's release valve is an explicit per-rule `"off"` — never a downgrade to warn. | `[lint.categories]` sets every enabled category explicitly to `"error"`; the config contains zero `warn` entries; `--max-warnings 0` guards the gate against future defaults sneaking in at warn/info. |

## 3. Target architecture

```
bunfig.toml            single source of lint/format truth ([lint], [fmt] appended
                       to the existing file; [test]/[install] untouched)
lint/plugin.ts         local ESLint plugin (typed via the owner-installed
                       @types/eslint): no-comments + exports-last
lint/plugin.test.ts    its tests (bun test)
biome.json             FROZEN (D1): read by plugins/biome-lsp only, until the
                       bridge is retired (follow-up bean)
biome-config-schema.json  owner's untracked scratch — untouched by this migration
```

Verification commands everywhere (`tech.md`, workflows, review briefs):
`bun lint` (exit 1 on errors) and `bun fmt --check` (exit 1 when files need
formatting), replacing `rtk biome check`. Under D7 a plain `bun lint` run
should emit zero warnings — everything enabled is error; `--max-warnings 0`
stays in the gate as a regression guard against future defaults sneaking in
at warn/info.

`bun lint` checks `.js/.jsx/.ts/.tsx` only; markdown (skill texts, specs,
guides) is never linted. `bun fmt` DOES format markdown by default — see the
exclusion in §4, which exists to keep the skill texts byte-stable (twin checks
and invariant greps pin exact bytes).

The `packages/cli-hook` compiled guard binary is unaffected: its
`autoloadBunfig: false` compile flag means the root `bunfig.toml` never loads
inside the guard, by design.

## 4. bunfig.toml target shape

Appended to the existing file:

```toml
[fmt]
sortImports = true
ignorePatterns = ["**/*.md", "packages/cli-hook/tests/fixtures/**"]

[lint]
plugins = ["./lint/plugin.ts"]
ignorePatterns = ["packages/cli-hook/tests/fixtures/**"]

[lint.categories]
correctness = "error"
suspicious = "error"
pedantic = "error"
style = "error"

[lint.rules]
# exact contents produced by the parity pass + probe triage (§4.1, §6 step 2);
# per D7: every entry is "error" or "off" — never "warn"/"info"
```

Formatter options stay at Prettier defaults (width 80, double quotes, 2-space
indent, semicolons) — matching the current Biome formatter settings. The
`**/*.md` fmt-exclusion protects `plugins/sdd/skills/**`, `assets/`, and
`docs/` from reformatting churn: the Revision-9 twin checks diff skill files
after a four-slot normalization, and the invariant greps match exact lines;
prettier-touching those files risks breaking the verification battery for zero
value. JSON/TS files are formatted.

### 4.1 Rule parity table (Biome → Bun)

| Biome rule | Was | Bun replacement | Status |
|---|---|---|---|
| assist `organizeImports` | on | `[fmt] sortImports = true` | mapped |
| assist `useSortedKeys` / `useSortedProperties` | on | `eslint/sort-keys = "error"` | mapped |
| assist `useSortedAttributes` (JSX) | on | `react/jsx-sort-props` | probe; enable if noise-free |
| assist `useSortedInterfaceMembers` | on | — | **loss** (accepted, minor) |
| `noExcessiveLinesPerFunction` | error | `eslint/max-lines-per-function = ["error", { max: 50 }]` | mapped; probe the value against repo reality |
| `noExcessiveLinesPerFile` | error | `eslint/max-lines = ["error", { max: 400 }]` | mapped; probe the value |
| `noExcessiveCognitiveComplexity` | error | — | **loss** (accepted; `max-lines-per-function` covers most) |
| `noUnusedVariables` | error | `eslint/no-unused-vars = "error"` | mapped (Bun's `_`-prefix default matches the repo convention) |
| `noUndeclaredVariables` (+checkTypes) | on | type-check gate (`tsc`/`bun check`) subsumes it; do not enable `no-undef` for TS | subsumed |
| `noTernary` | error | `eslint/no-ternary = "error"` | mapped |
| `useBlockStatements` | error | `eslint/curly = ["error", "all"]` | mapped |
| `useExportsLast` | error | local plugin `local/exports-last = "error"` | mapped (custom port) |
| `useNamingConvention` | off | `eslint/id-length = ["error", { min: 3, ... }]` | **new, stronger** (D-decision in chat); exceptions only from the probe report, each owner-approved |
| `noCommentText` | error | subsumed by `local/no-comments` | subsumed |
| `useSingleJsDocAsterisk` | error | moot under `no-comments` | subsumed |
| `noConsole` | off | `eslint/no-console = "off"` | off-parity |
| `noTemplateCurlyInString` | off | `eslint/no-template-curly-in-string = "off"` | off-parity |
| `noMagicNumbers` | off | `eslint/no-magic-numbers = "off"` | off-parity |
| `noProcessEnv` | off | `unicorn/no-process-env = "off"` | off-parity |
| `noNamespaceImport` | off | `import/no-namespace` = "off" (exact name probed) | off-parity |
| `noNodejsModules` | off | `import/no-nodejs-modules = "off"` | off-parity |
| `noSecrets` | off | — (no equivalent needed, was off) | dropped |
| `noUnknownFunction`, `noDuplicateClasses` (CSS rules) | — | repo has no CSS | dropped |
| `useQwikValidLexicalScope` | off | Qwik-only | dropped |
| `noBarrelFile` | error | probe (`unicorn/*`, `import/*`); else **loss** with optional later plugin port | probe |
| `noReExportAll` | error | probe; else **loss** with optional later port | probe |
| `useTopLevelRegex` | error | probe; else **loss** (minor perf) | probe |
| `preset: "all"` + domains | all | `[lint.categories]` correctness/suspicious/pedantic/style = "error" (D4+D7) | mapped |
| `javascript.globals: ["Bun"]` | — | Bun knows its own globals natively | probe (confirm no `no-undef` noise) |
| fixtures override (assist+linter off) | — | `[lint].ignorePatterns` + `[fmt].ignorePatterns` | mapped |

Every "probe" row is resolved in §6 step 1 BEFORE the config lands, by
inspecting `bun lint --rules` output; every "loss" row lands in §8 as accepted.

## 5. Local plugin `lint/plugin.ts`

TypeScript, typed with the owner-installed `@types/eslint` (a bun-lint plugin
IS an ESLint plugin; the package provides `Rule.RuleModule`/`Rule.RuleContext`).
Bun imports TS natively, so the plugin ships as `.ts`. Zero comments in its
own source, loaded via `[lint].plugins = ["./lint/plugin.ts"]`.
Two rules:

### 5.1 `local/no-comments` (error)

One `Program` handler; iterate `sourceCode.getAllComments()` (line, block,
JSDoc — all of them). A comment is reported unless, after trimming leading
`*` and whitespace, its text starts with one of:

- `eslint-disable` (covers `-next-line`, `-line` forms) and `eslint-enable`
- `prettier-ignore`
- `@ts-` (covers `@ts-check`, `@ts-expect-error`, `@ts-ignore`, `@ts-nocheck`)
- `biome-ignore` (permanent — legacy suppression comments stay valid)

**Options**: the rule takes `["error", { allow = ["<prefix>", ...] }]` — an
additive `allow` array of extra prefixes the owner can extend at will; a
comment whose trimmed text starts with any listed prefix passes. The built-in
allowlist above always applies and cannot be removed via options.

**Anti-circumvention**: a comment matching the allowlist that disables the
plugin's own rules (its text mentions `no-comments` or `exports-last`) is
still an error — not weakenable by options. Message carries no bypass
instructions, per the repo's deny-reason doctrine: "Comments are not allowed."

### 5.2 `local/exports-last` (error)

Port of Biome's `useExportsLast` plus the code-style rule against trailing
`export {}` blocks: walk top-level `Program` body; if any export statement
(`ExportNamedDeclaration`, `ExportDefaultDeclaration`) appears before a
non-export top-level statement, or any standalone trailing export block
exists, report. Inline `export` on declarations is the only accepted shape
(matches `.claude/rules/code-style.md`).

### 5.3 Tests

`lint/plugin.test.ts` (bun test): every allowlisted prefix passes; every other
comment form (line, trailing, block, JSDoc) errors; the `allow` option admits
extra prefixes and does not weaken the self-disable guard; the guard itself
fires; exports-last covers before-declaration, trailing-block, and clean
inline-export shapes. Tests are data-driven literal arrays (repo fixture
style); the plugin file itself is linted by the repo config (self-hosting
must stay green).

## 6. Migration sequence (commit boundaries)

Each step ends at a stop point; the owner reviews and commits.

1. **Probe pass (read-only).** Resolve every "probe" row of §4.1 via
   `bun lint --rules`; run `bun lint` on the repo with the candidate config
   staged in a scratch branch worktree and inventory the pedantic+style noise
   per rule; propose per-class decisions (fix code / off rule / owner call).
   Deliverable: probe report; config contents frozen after it.
2. **Formatter switch + mechanical reformat** (one commit). Add `[fmt]`
   (with the `**/*.md` exclusion), run `bun fmt`, verify `bun fmt --check`
   clean, `bun test` green, twin checks + invariant greps still pass (they
   must be byte-identical — the exclusion guarantees it, this run proves it).
3. **Lint config + plugin** (one commit). Add `[lint]` sections, create
   `lint/plugin.js` + tests, fix the triaged rule noise from step 1. `bun
   lint` green except `no-comments` findings.
4. **Comment sweep** (one commit). Enable `local/no-comments`; delete every
   reported comment in `packages/*/src`, `packages/*/tests`, root scripts
   (fixtures excluded via ignorePatterns). Fix = deletion only — an
   `eslint-disable` for this rule is itself an error (§5.1). `bun test`
   green after (no test asserts on comments).
5. **Docs + wiring** (one commit). §7 below.

## 7. Documentation and process wiring

- `.claude/rules/code-style.md`: comment section rewritten to "mechanically
  enforced, zero comments"; delete the 2026-09-29 biome background note and
  biome rule surnames; exports-last wording points at the plugin.
- `.claude/rules/tech.md`: verification battery swaps `rtk biome check` for
  `bun lint --max-warnings 0` + `bun fmt --check`; note fixtures ignore and
  the md fmt-exclusion with its twin-check rationale.
- `CLAUDE.md` §Layout: mark `plugins/biome-lsp/` as a temporary frozen-config
  IDE bridge (D2) with the follow-up bean; `biome.json` described as frozen
  (D1).
- `plugins/biome-lsp/README.md`: one paragraph noting it is now a read-only
  diagnostics bridge over a frozen config; formatting truth is `bun fmt`.
- Follow-up bean: retire the biome-lsp bridge + `biome.json` when a Bun LSP
  exists — owner-only change, since touching `biome.json` is owner's.
  `biome-ignore` comments stay allowed permanently (§5.1).

## 8. Losses and accepted risks

- `noExcessiveCognitiveComplexity`, `useSortedInterfaceMembers` — gone, no
  equivalent. Accepted (owner informed in chat).
- `noBarrelFile`, `noReExportAll`, `useTopLevelRegex` — probe outcomes; if
  absent, accepted losses (candidate later plugin ports, out of scope now).
- Dual-config drift (`biome.json` vs `bunfig.toml`) — by owner choice (D2);
  mitigated by follow-up bean; `biome.json` never "catches up", it dies.
- The `eslint-disable` allowlist is an inherent escape hatch for OTHER rules;
  the self-disable guard (§5.1) closes it only for the plugin's own rules.
- `id-length` will flag legitimate short names (`id`, catch bindings);
  every exception is owner-approved from the probe report, not silently added.

## 9. Verification (definition of done)

1. `bun lint --max-warnings 0` — clean at repo root.
2. `bun fmt --check` — clean; markdown untouched (`git status` proves no
   skill/assets/docs reformatting).
3. `bun test` — green, same suite count as before the migration.
4. `claude plugin validate .` — passes.
5. Invariant greps + Revision-9 twin checks — byte-identical pass.
6. Live smokes: plant a comment in a src file → `bun lint` errors with the
   no-comments message; plant `const x = 1` → `id-length` errors; trailing
   `export {}` → `exports-last` errors.
7. `biome.json` — `git diff` empty across the whole migration.

## 10. Files map

- Create: `lint/plugin.js`, `lint/plugin.test.ts`, this spec, the plan.
- Modify: `bunfig.toml`, `.claude/rules/code-style.md`, `.claude/rules/tech.md`,
  `CLAUDE.md`, `plugins/biome-lsp/README.md`, plus the comment-sweep and
  rule-noise fixes across `packages/*/src` and `packages/*/tests`.
- Delete: nothing. `biome.json` and `biome-config-schema.json` untouched.

## 11. Global constraints (binding every task)

- `biome.json` is read-only for agents — absolute (D1).
- `.zed/` is the owner's — agents never modify it (D6); nothing in this
  migration touches it.
- No dependency changes of any kind (D5).
- Agent never writes to git; stop points per repo workflow.
- Fixtures stay lint/format-ignored; markdown stays fmt-excluded.
- Rule messages never teach bypasses.
- Severity doctrine (D7): every configured entry is `"error"` or `"off"` —
  `"warn"`/`"info"` never appear in agent-written config; downgrading is the
  owner's edit, not the fix path.
- New code carries no comments — mechanically enforced from step 3 on.

## 12. Review focus (for the plan)

1. Formatter churn reaching markdown despite the exclusion — twin checks are
   the tripwire; verify byte-stability explicitly after the reformat commit.
2. `id-length` exception creep — every exception listed in the probe report
   and owner-approved before entering config.
3. pedantic+style noise burying signal — triage table per rule class before
   the lint-config commit; offs are explicit config lines, never omissions.
4. Plugin self-hosting traps — `lint/plugin.js` linted by its own rules with
   zero comments; its tests linted too.
5. `bun lint` file-coverage surprises (files outside gitignore expectations,
   e.g. root scripts) — inventoried in the probe pass, not discovered in CI.

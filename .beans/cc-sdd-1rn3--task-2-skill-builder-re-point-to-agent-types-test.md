---
# cc-sdd-1rn3
title: "Task 2: skill-builder re-point to agent-types + test infrastructure"
status: in-progress
type: task
priority: normal
created_at: 2026-10-04T15:24:42Z
updated_at: 2026-10-05T15:37:40Z
parent: cc-sdd-f4y5
---

Re-point packages/skill-builder hook types to @cc-sdd/agent-types, add tests dir + effect-bun-test runner, replace index.ts demo with real exports.

## Steps

- [x] Step 1: write failing smoke test (body adapted to runner contract: must return Effect — brief's void callback fails tsgo [2345]; deviation reported)
- [x] Step 3: manifest + tsconfig edit, then user install batch
- [x] Step 4: rewrite skill-frontmatter.ts + clean index.ts (noExportedImports x9 fixed via export-from, reported)
- [x] Step 5: verify — vitest 1 pass; bun test 263/0/10; tsgo pkg 4 files 0 errors; tsgo agg 27 files 0 errors (vitest.config.ts entered count; 4 pre-existing cli-hook msgs); biome 3 err + 1 warn all user-decision-gated (noBarrelFile vs designed barrel; root vitest devDep; noDefaultExport vs vitest contract)

## Notes

• BLOCKER (Step 2): @voila.dev/effect-bun-test@0.112.3 cannot load against effect@4.0.0 stable — static import 'effect/testing/FastCheck' unresolved. FastCheck.js exists in effect 4.0.0-rc.112 dist/testing (verified via tarball), absent in 4.0.0 stable (installed pkg inspected). Latest published runner = 0.112.3 (only 0.112.0/0.112.3 exist). Dependency decision belongs to the user.
• Step 2 color: RED — but on the FastCheck load failure, not any test assertion. 0 pass / 1 fail / 1 error.
• Type gate pre-verified with adapted test: tsgo diagnostics skill-builder project = Checked 4 files, 0 errors. Biome on 3 touched files = clean.

## Route A (controller 2026-10-04)

- [x] skill-builder devDeps: effect-bun-test removed, @effect/vitest catalog:effect added
- [x] root catalog.effect: effect-bun-test removed, vitest 5.0.3 added (sorted)
- [x] bunfig.toml [test] pathIgnorePatterns = [packages/skill-builder/tests]
- [x] root vitest.config.ts created (scoped include, no plugins)
- [x] smoke test import -> @effect/vitest (tarball-verified: export * from vitest)
- [x] red attempt documented: bun test sees 0 skill-builder files (ignore live, 263/0/10 green); @effect/vitest + vitest/config unresolvable pre-install (tsgo 2307)
      STOP: AWAITING_USER_BATCH — user runs bun install

## Summary of Changes

Re-pointed packages/skill-builder hook types to @cc-sdd/agent-types (delete hand-copied HookCommon/5 handlers/HookEvent/HookMatcherGroup/SkillHooks; SDK-derived via export-from), replaced index.ts demo with real exports, added tests/skill-meta-data.test.ts (characterization smoke, vitest green), wired test infra: bunfig pathIgnorePatterns, root vitest.config.ts, runner swap effect-bun-test -> @effect/vitest + vitest 5.0.3 per user route A. All executable gates green. Open: 4 biome diagnostics needing user config/manifest decisions (see task-2-report.md).

## Rulings implemented (controller 2026-10-04)

- [x] root devDeps += vitest catalog:effect (sorted, last)
- [x] biome.json overrides x2 — schema-verified against 2.5.15 (includes: glob array, linter.rules.<group>.<rule>: "off"): skill-builder/index.ts noBarrelFile off; vitest.config.ts noDefaultExport off
- [x] pre-batch check: only noUnresolvedImports remains (install closes it)
      Post-install gates (fresh): biome 43 files 0 diagnostics; vitest 1 pass; bun test 263/0/10; tsgo agg 27 files 0 errors; tsgo pkg 4 files 0 errors. ALL GREEN — task closed, awaiting user review/commit.

---
# cc-sdd-6gn1
title: "Task 8: SkillService + writer + marketplace upsert"
status: completed
type: task
priority: normal
created_at: 2026-10-05T10:54:38Z
updated_at: 2026-10-05T11:58:11Z
parent: cc-sdd-f4y5
---

Implement SkillService (Context.Service pattern) in packages/skill-builder: generate(def, outRoot) composes SKILL.md + references via PromptService, enforces budgets per artifact, writes CC plugin layout with full overwrite (D14), upserts marketplace entry idempotently. Strict TDD: 5 RED tests first. All fs IO through Effect FileSystem (D15). No index.ts export (D18).

## Summary of Changes

- packages/skill-builder/src/skill-service.ts (new): SkillService (Context.Service + deps-threaded module-level steps, Layer.provide(PromptService.layer)); generate(def, outRoot, options?: { sourceDir? }) composes SKILL.md (frontmatter + body + title automap, D4) and each reference via PromptService, budget-checks per artifact (body/refFile, carry-forward 1), full-overwrite writer (D14), verbatim script copy, idempotent key-sorted marketplace upsert (fails on missing marketplace); SkillBuildError {file, reason}; SkillDefinition/SkillBuildReport types.
- packages/skill-builder/tests/skill-service.test.ts (new): 5 its — layout+manifest+sample embed+script copy, SKILL.md contents (frontmatter/body/automap/no-doubled-headings), full-overwrite deletion, upsert idempotency (byte-identical re-run, sdd untouched), refFile hard budget failure naming the file.
- packages/skill-builder/src/schema.ts: getYmlString replaced with a runtime-independent YAML emitter (Bun.YAML is bun-only; vitest runs Node) — plain/quoted scalars, block string lists, JSON-flow fallback.
- packages/skill-builder/src/prompt-service.ts: facade object lifted out of make (make: Effect.succeed(facade)) + exported PromptFacade type; structure only, zero behavior change (class-as-type erases the service record; consumers need it nameable).
- index.ts untouched (D18). No installs, no git writes.

Battery: vitest 40/40 (7 files); bun test 263/0/10 (constant); tsc per-package 0; tsc root 0; biome exit 0 (55 files).

## Fix round 1 (review cc-sdd-6gn1 findings 1-4)

1. Emitter: trailing-space strings take the JSON-quoted branch (!endsWith(" ")); getYmlString filters value === undefined entries (probe: both new() and parse() keep explicit-undefined keys).
2. tests/yaml-emitter.test.ts: 6 its, written RED-first (3 failed on the holes: trailing space, undefined, date shape; 3 pinned existing behavior). Round-trip through Bun.YAML.parse verified in a throwaway bun probe — all 6 emitted docs parse back to the exact source values. Committed vitest tests assert emitted TEXT shape (no YAML parser without a new dep).
3. Date-shape: /^\d{4}-\d{2}-\d{2}/ prefix check quotes slug-legal date/datetime-like scalars.
4. Split: src/skill-compose.ts (298 lines: composer family + SkillBuildError/SkillDeps/PluginBundle/sortedJson/asBuildError) and src/skill-service.ts (175 lines: writer + generate + SkillService); one-way service -> compose; BOTH file-level biome-ignores deleted. Deviation flagged: SkillDefinition/SkillBuildReport/SkillBuildError export from skill-compose.ts, NOT re-exported from skill-service.ts (export-from trips noBarrelFile, export-of-import trips noExportedImports under preset:all; test surface unchanged — tests import only SkillService).
   Battery: vitest 46/46 (8 files); bun test 264/0/10 (+1 from the parallel cc-sdd-1zge workstream, none mine); tsc per-package 0; tsc root clean except that workstream's scratch-skill-verify.ts; biome clean on all files this task touches.

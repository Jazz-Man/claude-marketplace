---
# cc-sdd-eie3
title: "Task 9: directory validator (transposed skill-validator matrix)"
status: completed
type: task
priority: normal
created_at: 2026-10-05T16:33:58Z
updated_at: 2026-10-05T17:08:13Z
parent: cc-sdd-f4y5
---

Create packages/skill-builder/src/validate.ts + tests/validate.test.ts: the Go skill-validator structure matrix transposed to effect-ts (name==dirname, structure, tokens, fences, links, orphans, skill ratio), wired into SkillService.generate's tail. STRICT TDD: 9 RED its, then GREEN.

## Summary of Changes

Created packages/skill-builder/src/validate.ts (the Go skill-validator structure matrix transposed to effect-ts: name==dirname via a line-oriented frontmatter reader + SkillYamlSchema.parse, structure/deep-nesting warnings, token budgets via approximateTokens + BUDGETS, skill ratio, unclosed fences, internal links with realPath escape checks, orphan BFS with path-token boundaries) and tests/validate.test.ts (9 contract its, one per rule, fixtures through the FileSystem service). Wired validateSkillDir into SkillService.generate's tail: error-level findings -> SkillBuildError listing the findings; report gains findings (SkillBuildOutput). RED evidence: 9 fail on missing module; GREEN: vitest 56/56 (9 files), bun test 264/0/10 constant, tsc pkg+root 0, biome clean.

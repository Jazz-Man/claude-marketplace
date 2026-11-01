---
# cc-sdd-ohxk
title: Optimize cli-hook policies one by one (bench-driven)
status: todo
type: task
created_at: 2026-11-01T15:50:34Z
updated_at: 2026-11-01T15:50:34Z
parent: cc-sdd-okin
---

Gradually optimize every policy in packages/cli-hook/src/policies/ with the doctrine proven on core/ast.ts (parseCommand V4, 2026-11-01, -19% same-run A/B): per-policy mitata bench in packages/cli-hook/bench/<policy>.bench.ts over its fixture corpus + full test suite as equivalence gate; optimize only where the bench shows real cost; gates per policy: bun test (cli-hook), rtk proxy biome check, build-bin.

- [x] no-deps (txt-driven map, precomputed tokens + memoized toolOf; 2026-11-01)
- [x] core/ast parseCommand walk (V4 fusion + forEachChild + charCode subst gate; 2026-11-01; bench/parse.bench.ts + bench/equiv.ts as unbash-upgrade regression check)
- [ ] filesystem engine (resolve/tiers/policy/intents - hottest, runs on every Bash call)
- [ ] git-readonly
- [ ] no-inline-scripts

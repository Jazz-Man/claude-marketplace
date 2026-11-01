---
# cc-sdd-ohxk
title: Optimize cli-hook policies one by one (bench-driven)
status: todo
type: task
priority: normal
created_at: 2026-11-01T15:50:34Z
updated_at: 2026-11-01T16:39:59Z
parent: cc-sdd-okin
---

Gradually optimize every policy in packages/cli-hook/src/policies/ with the doctrine proven on core/ast.ts (parseCommand V4, 2026-11-01, -19% same-run A/B): per-policy mitata bench in packages/cli-hook/bench/<policy>.bench.ts over its fixture corpus + full test suite as equivalence gate; optimize only where the bench shows real cost; gates per policy: bun test (cli-hook), rtk proxy biome check, build-bin.

- [x] no-deps (txt-driven map, precomputed tokens + memoized toolOf; 2026-11-01)
- [x] core/ast parseCommand walk (V4 fusion + forEachChild + charCode subst gate; 2026-11-01; bench/parse.bench.ts + bench/equiv.ts as unbash-upgrade regression check)
- [x] filesystem engine (2026-11-01: obvious pass -22%, then E1+E2+E3: check sweep 914->571us = -37%, full cycle 1952->1570us; bench/filesystem.bench.ts 30 arms + self-check; Cookie.parse kept per owner decision; tier toLowerCase fusion rejected on U+0130 semantics)
- [ ] git-readonly
- [ ] no-inline-scripts

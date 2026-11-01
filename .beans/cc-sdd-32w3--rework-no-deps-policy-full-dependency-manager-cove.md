---
# cc-sdd-32w3
title: 'Rework no-deps policy: full dependency-manager coverage'
status: in-progress
type: task
priority: normal
created_at: 2026-10-31T17:52:15Z
updated_at: 2026-11-01T14:15:17Z
parent: cc-sdd-okin
---

Full rework of packages/cli-hook/src/policies/no-deps.ts. Step 1: inventory all dependency managers present on this machine via subagent recon (help-output subcommand lists) -> tmp/pm-inventory.md. Then: rewrite the policy to deny every dep-mutating command and one-shot runners (bunx, npx, uvx, yarn dlx, pnpm dlx, pipx run, ...).

- [x] Dependency-manager inventory (subagent recon -> tmp/pm-inventory.md)
- [x] Policy design from inventory (owner review)
- [x] Implementation + tests + gates (txt-embedded architecture, owner-committed direction)

## Report

Inventory complete: 25 managers + 2 version managers present, 11 candidates absent. Full verbatim subcommand lists in tmp/pm-inventory.md. Key: deno x is a real npx-equivalent; yarn is Classic 1.22.22 (no dlx on this machine); confirmed live guard bypasses include pnpx, bun x, deno x, uv tool run, pipx run, pnpm exec; bundler family and yarnpkg alias absent from policy entirely.

## Brief

Rework packages/cli-hook/src/policies/no-deps.ts to the approved inverted data shape. Starting shape: tmp/no-deps-poc.ts (DENY/RUNNERS/ALIASES/matcher); truth source for subcommand names: tmp/pm-inventory.md (verbatim help lists from this machine).

SHAPE:
- RUNNERS = Set of bare binaries denied on any invocation: npx, bunx, uvx, pnpx.
- ALIASES record resolved before DENY lookup: yarnpkg->yarn, bundler->bundle, python3.15->python3.
- DENY = Map tool -> Set of token patterns; pattern = space-joined tokens (install / global / '-m pip install' / 'tool run'); deny when args START with the pattern tokens, exact case-insensitive compare.
- FETCH_FORMS conditional rules, fired only when the arg immediately after the prefix satisfies the test: go+run -> next arg contains @ (go run pkg@latest); deno+run -> next arg matches ^(https?:|npm:|jsr:) (deno run URL/npm:/jsr:).
- Precompute token arrays at module load (as today MUTATIONS does); matcher semantics otherwise unchanged; keep baseName import from core/ast.ts; keep exports noDepsPolicy and REASON.

DELTAS POC -> final (owner-approved decisions):
1. deno set: remove run and eval (run is conditional via FETCH_FORMS; eval is not a dep op). Keep add, remove, install, uninstall, update, upgrade, cache, ci, x, create, link, compile, bundle.
2. go set: remove run (conditional). Keep get, install, mod download, mod tidy, mod vendor, work sync.
3. composer: replace the four global-verb patterns with single token global (deny ALL composer global ...).
4. yarn: replace global add/install/remove/upgrade with single token global (deny ALL yarn global ...).
5. yarn set has NO dlx and NO 'set version' (machine runs Yarn Classic; dead entries cut).
6. Local run/exec primitives stay ALLOWED: poetry run, bundle exec, composer exec, brew exec, pipx exec, cargo run, rustup run, npm/pnpm/yarn/bun run. Blocked exec family: npm exec, pnpm exec, bun x, uvx/uv tool run, pipx run, pnpm dlx, deno x, uv run.
7. Cross-check every tool row against tmp/pm-inventory.md; add missing mutation verbs found there.
8. REASON -> 'Dependency install/update blocked: do not install, update, or remove packages (pip/uv/pipx/poetry, npm/npx/pnpm/pnpx/yarn, bun/bunx, cargo/rustup, composer, gem/bundler, go, swift package, brew, nix) or run one-shot package runners.'
9. Product code with zero comments (match current file); biome preset all, caps 300/50; no dependency changes; git read-only.

TESTS:
- Extend policy test fixtures and the no-deps test with: bun x cowsay; pnpx vite; deno x cowsay; uv tool run ruff; pipx run ruff; pnpm exec; npm exec; yarnpkg add; bundler install; python3.15 -m pip install; pipx install-all; npm install-ci-test; pnpm self-update; brew update; composer global <anything>; yarn global <anything>; go run pkg@latest DENY vs go run . ALLOW; deno run https://x DENY and deno run npm:x DENY vs deno run mod.ts ALLOW; poetry run ALLOW; bundle exec ALLOW; cargo run ALLOW; npm run build ALLOW; nix run/shell/build DENY; cargo binstall DENY; brew bundle DENY.
- Gates: bun test in packages/cli-hook; rtk proxy biome check; bun run build-bin in packages/cli-hook.

Implementer appends ## Report to this bean (files touched, gates + results, deviations). Never ask the user; return NEEDS_CONTEXT instead.

Implementation (cc-sdd-32w3):
- Files: packages/cli-hook/src/policies/no-deps.ts (rewritten to approved RUNNERS/ALIASES/PATTERNS/FETCH_FORMS shape, tokens precomputed at module load), packages/cli-hook/tests/fixtures/no-deps.ts (table extended per Brief).
- Gates: bun test -> 517 pass, 0 fail, 562 expect() calls across 9 files (489 baseline pre-change); rtk proxy biome check -> clean (384 files, no diagnostics, no fixes); bun run build-bin -> success: true.
- Deviation 1 (fixture): removed "yarn set version 4" (delta 5 cut) and "brew services start" (approved POC shape has no brew services denial; the outgoing policy denied brew services * — owner may want it restored).
- Deviation 2 (fold): core baseName strips version suffixes, so POC lookup keys pip3/python3 became pip/python (python3.15 folds to python before ALIASES can fire). Pinned alias python3.15->python3 kept verbatim and resolved before baseName; observable behavior identical.
- Delta-7 additions from inventory cross-check: npm install-scripts + cache; pnpm store add; pipx uninject + reset; poetry self lock + self remove; swift package experimental-uninstall; pipx exec removed per delta 6. Not added (not install/update/remove ops): uv build/publish, pnpm permissions, pip search.

Round 2 (in-chat, orchestrator): subagent fix-round aborted by owner; PATTERNS Record + compile loop removed; single Map<string, Set<string>> literal via toSet() comma-string rows; on-demand pattern.split in matcher; 170 lines after biome format. Gates re-run: bun test 517/0, biome clean (384 files), build-bin success.

## Notes

Owner rolled back the implementation on 2026-10-31 (shape rejected) and will redo it personally. Still-valid decisions live in ## Brief: npm exec = npx alias -> block; local run/exec allowed; yarn Berry dead entries cut; go/deno run fetch-forms only; composer/yarn global blanket-deny via single token. Recon artifacts kept: tmp/pm-inventory.md (verbatim subcommand truth), tmp/no-deps-poc.ts (POC). Open from review: brew services token (old policy denied brew services <action>), biome.json useTopLevelRegex off provenance, subcommand judgment calls (npm install-scripts/cache, pnpm store add, pipx uninject/reset, poetry self lock/remove, swift experimental-uninstall).

## Notes

Final architecture (2026-11-01): mutable-commands.txt is the single data source, embedded into the bundle by Bun's default text loader (verified in binary); no-deps.ts parses it once at module load into precomputed token patterns (Map tool -> Pattern[]) + RUNNERS set + memoized toolOf (ALIASES + baseName version-fold). FETCH_FORMS predicates implement the two placeholder lines (go run pkg@v, deno run url). Performance: mitata benchmark (tests/no-deps.bench.ts) measured the split-on-demand version 1.7-2.5x slower with GC spikes (worst case 802ns, max iter 211us); after precompute+memo the product is fastest in every case (worst 341ns, no spikes). Owner installed mitata as devDependency for @cc-sdd/claude-code-cli-hook. test-map.ts remains committed but unused by product (owner to decide deletion).

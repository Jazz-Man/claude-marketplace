# jscpd full dedup — implementation plan

## Context

jscpd 5.4.2 is now a live third downstream in the lsp-proxy LSP fan-out (full-sync adapter, bean cc-sdd-i0hk). A full CLI run under the owner's current `.jscpd.json` (minTokens 50, semantic 0.4125/0.6375 via local bge-m3, mode strict) reports **159 clones / 35.7% duplication** (raw report: `.superpowers/sdd/2026-10-24-cli-hook-memory-ask/jscpd-report.txt`). The owner ordered a complete, no-exceptions cleanup: every finding gets either an honest code fix or an explicit, individually-justified ignore entry; thresholds stay as-is (owner decisions, 2026-10-26). All work is executed in subagents.

Goal state: `jscpd . --reporters ai` reports **zero clones outside the documented ignore set**; every ignore entry carries a written reason; all repo gates green; behavior unchanged.

## Category policy (owner-approved)

- **CODE-FIX** — same knowledge changing together: extract/merge (third-instance rule applies within a scope; locals-over-helpers inside one function).
- **IGNORE-DOCUMENTED** — three structural categories, each ignore entry justified in the triage doc:
  1. data tables (UNCONDITIONAL git set, MUTATIONS, INTENTS, METHODS registry, agent-types type aliases) — rows are unique data;
  2. src↔test mirrors (fixtures/helpers deliberately restate commands, payload shapes, frame formats — that IS the test contract);
  3. architectural similarity (proxy-server↔proxy 0.82-0.86, policy check() shapes 0.73-0.78, orchestration twins) — one pattern, different domains; merging breaks module boundaries (structure.md).
- `.jscpd.json` is owner-applied: agents write the proposed ignore entries + reasons into the triage doc at each stop point; the owner merges them into the file. Same standing rule as biome.json.

## Tasks (cluster-batched; each = one implementer subagent + one opus review + owner commit stop point)

### Task 0 — Triage formalization
Subagent (sonnet) turns the 159-pair report into `.superpowers/sdd/2026-10-24-cli-hook-memory-ask/jscpd-triage.md`: one table per section (token/semantic), verdict per pair or per declared GROUP (the git-readonly↔fixtures ×13, fixtures inter-se ×10 etc. collapse into group rows), fix-shape for every CODE-FIX item, ignore-reason for every structural item. Output drives all following tasks. Coordinator pre-seeds known verdicts (merge.ts twins REAL; proxy-requests 91-101~169-179 error-reply ladder REAL — confirmed by read; config duality REAL; data tables / mirrors / architectural IGNORE).

### Task 1 — lsp-proxy src dedup
- `merge.ts` twins `mergeTaggedArrays`/`mergePlainArrays` → one function (tag applied post-hoc or optional tagger param); frees ~12 lines.
- `proxy-requests.ts` error-reply ladder (91-101~169-179) → shared private reply method (both are replyErrorTo+replyTo pairs on resolved outcomes).
- `ServerConfig.ts` validateName/validateCommand (1.00 ast) → single field-parametrized validator.
Gates: pkg tests, biome, strict, build-bin; behavior-identical.

### Task 2 — config validation kernel
The ProxyConfig/ServerConfig/parseConfig duality (0.78-0.88) + `config-oop.test.ts` vs `config.test.ts` (0.83-0.93): keep both public APIs (class fail-fast + collected-errors parse) but extract the shared validation kernel (validators, error shapes) into the config/ module so both front-ends consume one representation; tests converge on shared expectations helpers where ≥3 instances. This is the largest single fix; reviewer must verify no error-message drift (tests pin texts).

### Task 3 — cli-hook src pass
Code-fix: any CODE-FIX items in cli-hook src from triage (candidates: `core/ast.ts`~`intents.ts` 0.78 scanning shape — assess; policy.ts helpers layout). Ignore-entries drafted for: UNCONDITIONAL/MUTATIONS/INTENTS tables, policy-shape architectural pairs (git-readonly↔no-inline-scripts↔no-deps 0.73-0.78), resolve~tiers 0.72.

### Task 4 — test-harness dedup (cli-hook)
- `no-deps.test.ts` ↔ `no-inline-scripts.test.ts` (0.93 + token clone) → shared policy-table test helper in `tests/helpers/policy.ts` (exists — extend, don't invent).
- `run-hook.test.ts` intra pairs (49-56~102-109 etc.) → local consts inside cases (locals-over-helpers); group-level helper only on 3rd stable instance.
- Fixtures inter-se arrays + git-readonly.test headers → ignore (data/table) unless a ≥3-instance stable preamble helper emerges.
Gates: assertion strength preserved (lint-batch review standard — no expect lost, no condition widened).

### Task 5 — test-harness dedup (lsp-proxy)
- Identical preambles across integration tests (architecture~proxy.integration, initialize-failure~proxy.integration 0.78-0.83, full-sync~sync-adapt, mux-byclient~mux) → extend `tests/helpers/proxy-harness.ts` / stub fixtures where ≥3 instances; single-instance similarity → leave for ignore.
- `config-oop~config` residual after Task 2.
- deaths-reset~generation (0.87) → assess shared spawn-fixture helper.
- Remaining ~0.75-0.85 test similarity → ignore (architectural/boilerplate) per triage.

### Task 6 — ignore consolidation + loop verification
- Compile the accumulated ignore proposals into one owner-review diff for `.jscpd.json` (entries + triage-doc reasons).
- Re-run `jscpd . --reporters ai`: any NEW findings (code movement re-reveals pairs) spawn follow-up tasks per the same policy — the loop continues until the run is clean outside ignores.
- Full gates repo-wide + build-bin for both packages if src touched + live LSP check: diagnostics stream on previously-flagged files (e.g. merge.ts) goes quiet.

## Standing constraints (every task)

- Subagents only (owner directive): implementer sonnet, reviewer opus.
- Owner commits at every stop point; agents git-read-only.
- TDD where behavior could shift; refactors are behavior-identical with existing tests green. Zero new comments. Biome preset "all", caps 300/50. No dependency changes. KISS: locals before helpers, helpers before modules, third-instance rule.

## AMENDMENT 2026-10-27 — terminal policy reversed by owner: FIX ABSOLUTELY EVERYTHING

The ignore path is DEAD: no new ignore entries (node_modules/dist only), goal = `check_current_directory` reports **0 clones** with zero project ignores. ignore-proposal.md §2 is void (kept as history). Every remaining row (135 at amendment time) gets a CODE fix across new task waves:

- Wave A (tables): data tables → compact single-expression forms (split-strings; mini-DSL parser for nested tables). Dissolves: UNCONDITIONAL/MUTATIONS/INTENTS/INTERPRETERS/METHODS/agent-types intra rows + git-readonly↔fixtures table rows (both sides compact).
- Wave B (mirrors): src↔test mirrors become derived — tests import src constants/shapes instead of restating (framing↔fixture, payload↔run-hook, policy~helpers, main~utils, merge~merge.test, stub-server twins). Accepted cost (owner direction): weaker pin independence on those shapes.
- Wave C (src twins): the 11 architectural pairs get real merges/extractions (proxy-server↔proxy, downstream↔proxy, capabilities~merge, boundary~proxy, router~sync-extensions, ProxyConfig~validate, resolve~tiers, policy~resolve). Behavior-identity gated by the full suites.
- Wave D (test mass): all remaining intra/inter test pairs dissolve via it.each tables and shared helpers at whatever granularity needed (no third-instance cap now — the goal is dissolution; assertion parity remains the cardinal rule).
- Wave E (loop): rescan after every wave; newly revealed pairs spawn follow-up tasks until a flat 0. Owner calibration (2026-10-27): minimize to the limit, zero where HONEST — a pair killable only by harming readability/format sanity gets parked with a written reason instead of forced. Owner exception (2026-10-27, later the same day): test fixtures are DATA by definition and the one sanctioned ignore — a single `**/tests/fixtures/**` entry in .jscpd.json; fixture files stay plain original array literals, no reader machinery, no restructuring.
- FINAL PUSH (owner, 2026-10-27, second reversal — "no deferrals, fix ALL now"): Waves B and D dispatch immediately (test RESTRUCTURING authorized — parity of existing assertions verbatim, still no new tests); the four weakest-paper parks get real attempts (agent-types + methods tables: Wave-A axis hunt; ProxyConfig~ServerConfig 0.868 seam; resolve~no-inline 0.737 ruling); loop until the scoreboard is provably parks-only or empty.

## Verification

1. Duplication loop via **jscpd-mcp** (owner directive 2026-10-26, replaces all CLI runs): `check_current_directory` after every change batch — **0 clones, zero project ignore entries**; `get_file_clones(path)` targets each refactor; `get_statistics` for the by-kind record.
2. `bun test` (repo root) green; `rtk proxy biome check` clean; `bun check --strict` clean.
3. `bun run build-bin` in packages/lsp-proxy and packages/cli-hook (whenever src touched).
4. Live LSP smoke: open the previously-flagged files — jscpd diagnostics stream empty on them.
5. Exploration/navigation briefs use **grepai-api** (`grepai_search` NL queries, refs tracing) for locating code by intent — complements LSP symbol navigation.

## Post-approval admin

Plan copied to `docs/superpowers/plans/2026-10-26-jscpd-dedup.md`; epic bean created (type feature, in-progress); ledger at `.superpowers/sdd/2026-10-26-jscpd-dedup/progress.md` (fresh workspace per plan conventions).

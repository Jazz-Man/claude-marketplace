# grepai search boost reference

Scope: `search.boost` — path-based score multipliers that rank production
code above tests, mocks, generated files, and docs. Boost runs AFTER
similarity search (and hybrid fusion, if enabled), multiplies each result's
score by every matching rule, then re-sorts.

Three mechanical facts govern everything below:

1. **Reorder-only.** Boost re-sorts the candidates the store returned
   (2x the result limit, 4x with `search.dedup` enabled) — it never filters
   and never pulls in files outside that pool. Filtering is the ignore
   layer's job; if a query's whole pool is penalized material, that material
   still fills the results.
2. **Cumulative.** All matching rules multiply: a docs-page markdown file
   hits `.md` (x0.6) and `/docs/` (x0.6) for a combined x0.36.
3. **Config-only.** Rules live in `.grepai/config.yaml` and apply to the
   next search — no re-indexing. A MISSING `search.boost` block means boost
   is off; PRESENT but empty `penalties:`/`bonuses:` lists are an empty rule
   set, i.e. a no-op — never "fall back to defaults".

## Pattern semantics

Patterns are plain, case-sensitive SUBSTRING matches (no globs, no regex)
against the project-relative path written with forward slashes and a leading
`/` prepended (`/packages/app/src/auth.ts` on every OS).

- `/tests/` matches `tests/auth.py` and `services/api/tests/auth.py`, not
  `contests/auth.py` — a leading-slash segment matches that directory name
  at any depth.
- `.test.`, `_test.`, `__tests__` match by bare substring anywhere.
- Broad substrings cut both ways: `.md` also matches `.mdx`; `test_` also
  matches `contest_results.go`. Prefer anchored segment patterns when the
  bare token is a common word.

## Shipped defaults (what `grepai init` writes)

| Category | Patterns | Factor |
|---|---|---|
| Tests | `/tests/`, `/test/`, `__tests__`, `_test.`, `.test.`, `.spec.`, `test_` | x0.5 |
| Mocks | `/mocks/`, `/mock/`, `.mock.` | x0.4 |
| Fixtures & test data | `/fixtures/`, `/testdata/` | x0.4 |
| Generated | `/generated/`, `.generated.`, `.gen.` | x0.4 |
| Docs | `.md`, `/docs/` | x0.6 |
| Source | `/src/`, `/lib/`, `/app/` | x1.1 |

Custom `penalties:`/`bonuses:` lists REPLACE the defaults — copy the
defaults you want to keep and append yours.

## Curation interplay (the solo-setup rule)

Dependency curation happens at the INDEX layer: `.gitignore` excludes,
`.grepaiignore` `!` negations re-include the chosen libraries (JS/TS
`!node_modules/<lib>/`, PHP `!vendor/<lib>/`). Boost must never penalize a
root you deliberately curated — a `/node_modules/` x0.1-style rule sinks
exactly the source you pulled in. Inside a curated library, ranking emerges
on its own: `.d.ts`/source is neutral while `.md`/`.mdx` docs hit the x0.6
penalty — source above guides, both findable.

Penalize what your project GENERATES (tests, mocks, fixtures, scratch);
never penalize what you deliberately INCLUDE.

## Factors and effect

| Factor | Effect | Use |
|---|---|---|
| 0.3 | −70% | strong penalty |
| 0.5 | −50% | moderate (tests) |
| 0.7 | −30% | mild (examples) |
| 1.1 | +10% | mild bonus (src) |
| 1.2 | +20% | moderate (core package) |

Worked example — `0.82 x/src/middleware.go` with `/src/` x1.1 → 0.90;
`0.85 x/tests/auth_test.go` with `/tests/` x0.5 → 0.43: same content,
source outranks test. Bonuses can push scores above 1.0 — normal.

## Project recipes

Common add-ons on TOP of the shipped defaults:

- Go: `_test.go` x0.5 (finer than `_test.`), `_mock.go` x0.5, `.pb.go` x0.4;
  bonuses `/internal/`, `/cmd/`, `/pkg/` x1.1.
- Python: `test_` already in defaults, add `/conftest` x0.5;
  bonuses `/core/` x1.2.
- Frontend: `.stories.` x0.6, `/storybook/` x0.6; bonuses `/components/`,
  `/hooks/` x1.1.
- Monorepo: penalty `/packages/deprecated/` x0.3, `/packages/legacy/` x0.4;
  bonus `/packages/core/` x1.2.

## Ignore vs penalty

| Layer | Effect | For |
|---|---|---|
| `ignore` / `.gitignore` | excluded from the index entirely | dependencies you do NOT curate, build output, caches |
| `.grepaiignore` `!` | re-included into the index | the few dependency sources worth trusting |
| penalty (x<1) | still searchable, ranked low | tests, docs, examples — rarely needed, never hidden |
| bonus (x>1) | ranked high | the packages that ARE the product |

## Tuning and verification

Verification runs exclusively through the MCP tools.

- Changes apply to the next `grepai_search` call — tune live, no reindex.
  The server re-reads the config when a call passes the project `root`, so
  edits to `search.boost` take effect immediately, with no server restart.
- Verify with a real query before/after: results from penalized paths sink
  but remain findable (a "test authentication" query still returns tests,
  ranked lower).
- Symptom: tests still on top → your naming convention is not covered (add
  its pattern). Cannot find penalized code AT ALL → that is ignore's doing,
  not boost; check the ignore layers.

## Pitfalls

1. Empty rule lists are a no-op, not defaults — the single most common
   misconfiguration.
2. A missing `search:` section disables boost AND dedup (search has no
   load-time defaults).
3. Penalizing a curated dependency root undoes your curation.
4. Cumulative double-hits are intended (`.md` + `/docs/`) — factor them in
   when choosing custom factors.

# filesystemPolicy.check — bench findings

Goal: measure `filesystemPolicy.check` (`src/policies/filesystem/policy.ts`)
end to end, attribute its cost per stage, A/B the just-landed optimization
pass (old implementations mirrored from the pre-optimization commit), and
decide whether a manual split-pair parser can replace `Bun.Cookie.parse` in
`splitPair` (resolve.ts). All numbers: mitata, avg µs per sweep of a
717-command corpus (the 233-command arsenal with EXEMPLARS substitution,
every table from all five `tests/fixtures/*.ts`, and the 36 adversarial
parse commands — identical to `bench/equiv.ts`), bun 1.4.4, Apple M3 Pro.
Everything lives in `bench/filesystem.bench.ts`; its startup self-check
asserts the stage mirror, the old-flow mirror, and the all-old composite are
JSON-identical to `filesystemPolicy.check`, and the exploratory mirrors
identical to their production counterparts, over the whole corpus — the run
aborts otherwise. Product code carries only additive `export` keywords on
constants the bench imports (11 keywords, no behavior change; suite stays
532/0).

Three full runs; the table is the final run. Cross-run spread on the big
arms is roughly ±5%; every A/B delta below reproduced in sign and magnitude
in all three runs.

## Arm table (avg µs/iter, whole corpus per sweep)

| arm | avg µs | min | p75 | p99 |
| --- | ---: | ---: | ---: | ---: |
| A2 full cycle parse+check | 1951.7 | 1720 | 2010 | 2870 |
| C0 everything old (composite pipeline) | 1197.2 | 1090 | 1220 | 1510 |
| C4a flow old: map+spread+severityUnion | 1005.7 | 908 | 1040 | 1140 |
| B6 + scoped decision tail (full mirror) | 939.5 | 847 | 968 | 1050 |
| B* production check (mirror sanity) | 933.3 | 843 | 962 | 1060 |
| C4b flow new: production early-deny loops | 928.7 | 838 | 959 | 1030 |
| A1 check only (pre-parsed) | 914.0 | 805 | 938 | 1180 |
| B5 + tierOf/tierGate | 754.0 | 669 | 781 | 855 |
| B4 + expandToken | 602.2 | 539 | 623 | 683 |
| B3 + candidate resolution | 414.9 | 349 | 434 | 487 |
| C1a guards old: 2-pass for..of+regex+includes | 378.7 | 327 | 396 | 447 |
| B2 + intentOf/unwrapScan | 337.7 | 292 | 350 | 399 |
| B1 + unit nameGate | 285.5 | 246 | 298 | 337 |
| B0 injectionHit (raw scan) | 258.1 | 216 | 271 | 313 |
| C1b guards new: fused charCode scan | 248.8 | 208 | 262 | 301 |
| E2 injectionHit: native regex control/ws | 220.5 | 186 | 230 | 265 |
| E3a memoryTargetOf: production relative() | 196.5 | 181 | 200 | 221 |
| C3a expandToken old: uncached home expand | 192.6 | 179 | 197 | 223 |
| C3b expandToken new: memoized | 181.3 | 167 | 186 | 207 |
| E1 injectionHit: PATH= pre-gate | 113.7 | 104 | 116 | 136 |
| C2a zone old: normalize+template-concat per call | 82.2 | 67 | 87 | 104 |
| C2c zone new: WeakMap cold ctx | 81.5 | 72 | 84 | 101 |
| C5a intentOf old: ungated parseEnv + double baseName | 28.2 | 28 | 28 | 28 |
| C5b intentOf new: gated + single baseName | 27.5 | 27 | 28 | 28 |
| C2b zone new: WeakMap warm ctx | 14.0 | 14 | 14 | 14 |
| E3b memoryTargetOf: PROJECTS_ROOT pre-gate | 10.7 | 11 | 11 | 11 |
| D3 pathCandidates product pair (20 "=" args) | 2.20 | 2.1 | 2.2 | 2.3 |
| D1 splitPair Bun.Cookie.parse (product) | 1.83 | 1.8 | 1.9 | 1.9 |
| D4 pathCandidates manual pair | 1.78 | 1.8 | 1.8 | 1.9 |
| D2 splitPair manual split (alt semantics) | 1.55 | 1.5 | 1.5 | 1.9 |

Per command: check ≈ 1.27 µs, full cycle ≈ 2.72 µs. The full cycle splits
roughly 53% parseCommand / 47% check — the parse side stays the larger half
of the hook's filesystem cost (and already has its own findings in
`bench/parse-findings.md`).

## Stage attribution (cumulative mirror, final run)

Each arm adds one stage to the production flow, truncated after that stage's
work with earlier deny short-circuits intact. Marginals sum exactly to the
full mirror (939.5); B* (production) at 933.3 confirms the mirror's cutoff
branching costs nothing measurable.

| stage | marginal µs | share of check |
| --- | ---: | ---: |
| injectionHit raw scan (B0) | 258.1 | 27.5% |
| + unit nameGate (B1) | 27.4 | 2.9% |
| + intentOf/unwrapScan (B2) | 52.2 | 5.6% |
| + candidate resolution (B3) | 77.3 | 8.2% |
| + expandToken (B4) | 187.3 | 19.9% |
| + tierOf/tierGate (B5) | 151.8 | 16.2% |
| + scoped decision tail (B6) | 185.5 | 19.7% |

The raw injection scan dominates: a full pass over every command string
(seven substring searches, a per-char code-unit scan, and a whitespace split
for the PATH check) before any structure is consulted. expandToken
(`normalize(join(...))` per relative candidate) and the tier ladder (two full
`toLowerCase` passes plus basename/set probes per absolute path) are the
next two. No stage is negligible; the flow has no single removable blob.

## Optimization A/B (same run, same corpus)

The landed pass (pre-optimization code mirrored from git history) in total:
**C0 all-old composite 1197.2 vs C4b production 928.7 µs = −22.4%** on the
check sweep.

| pair | old µs | new µs | delta | note |
| --- | ---: | ---: | ---: | --- |
| C1 guards scan | 378.7 | 248.8 | −34.3% | two for..of passes (codePointAt control, per-char regex+includes whitespace) → one charCodeAt pass |
| C2 inAllowedZone, warm ctx | 82.2 | 14.0 | −83% | WeakMap zone-root cache, repeated zone tests within one check |
| C2 inAllowedZone, cold ctx | 82.2 | 81.5 | −0.9% | fresh context per call — the cache buys nothing on the first call |
| C3 expandToken | 192.6 | 181.3 | −5.9% | memoized `~/` expansion; corpus is ~2/3 non-tilde paths, which the memo never touches |
| C4 policy flow | 1005.7 | 928.7 | −7.7% | units.map + redirects.map + spread + severityUnion → early-deny loops |
| C5 intentOf | 28.2 | 27.5 | −2.5% | includes("=") gate on parseEnv + single baseName; only wrapper commands (env/xargs/timeout/…) reach the scanned path |

Honesty notes on the caches: the hook builds one PolicyContext per payload,
so the first inAllowedZone call of every real invocation is cold — C2c
(81.5) is the production reality for single-candidate commands, and the
cache only pays within one check that tests ≥2 paths. The expandToken memo
is module-level and unbounded (a slow leak over a long-lived hook process,
bounded in practice by distinct tilde tokens; worth remembering, not worth
changing for speed alone).

## Cookie.parse vs manual split (part D)

Differential: `Bun.Cookie.parse` (production splitPair, verbatim copy) vs a
manual first-`=`-split parser implementing the probed Bun semantics —
HTTP-header-value shape gate (no leading/trailing SP/HTAB, no CR/LF), first
`;`-segment only, split at the segment's first `=`, `[ \t\f]` trimmed off
both parts, empty name rejects, name restricted to printable ASCII
(0x21–0x7e) — over (1) all 19 distinct corpus args containing `=` and (2) a
58-token adversarial set (quoted values, semicolons, spaces/tabs, empty
name, `=v`, `a==b`, `@file` values, unicode names/values, the
Unicode-whitespace family, control bytes, URL-ish pairs).

| input class | Bun.Cookie.parse | manual split | diverges? | candidates differ? |
| --- | --- | --- | --- | --- |
| plain `a=b`, `--flag=v`, `out=@f`, `PATH=$PATH`, quotes, `a==b`, `a=b;c=d` (all 19 corpus tokens) | identical split | identical split | no | no |
| `=v`, `-=x`, `ü=ö`, `a b=c`, leading/trailing SP/HTAB, `\n`/`\r`, ` x=y`, `x=y ` | rejects (throw → null → prose path) | rejects (gate → null) | no | no |
| `a= b`, `a =b`, `a=\tb`, `a=\fb` | trims OWS from name/value | trims the same set | no | no |
| `a;b=c`, `;a=b`, `a=b;` | first `;`-segment only (throw when it lacks `=`) | same | no | no |
| NBSP `a= b` / `x=y ` (U+00A0) | value keeps the NBSP | value keeps it | no | no |
| U+3000, U+2028, U+2029, U+1680, U+205F, U+FEFF anywhere in token (7 tokens) | rejects whole token ("not a valid HTTP header value") | accepts, splits | **yes** | **no** — both routes produce the identical single `[arg]` candidate list |

Verdict: the manual split is **not a strict drop-in** — it disagrees with
Bun on 7 of 58 adversarial tokens (the exotic Unicode-whitespace family,
where Bun's header validation rejects the whole token and the manual parser
splits it). It **is candidate-equivalent on every token tested** (0 of 77
with policy-visible `pathCandidates` divergence), because both the reject
route (proseCandidates) and the split route (midAtCandidates) collapse to
the same `[arg]` for these shapes. Benchmarked anyway, clearly labeled
alternative-semantics: splitPair 1.83 → 1.55 µs per 20 tokens (−15%),
pathCandidates 2.20 → 1.78 µs (−19%) — but the whole D stage is 0.24% of
the check, so the swap would save ~0.4 µs per sweep. **Keep
Bun.Cookie.parse** (owner decision stands): the gain is noise, and the
divergences, however benign on this corpus, are exactly the kind of
Unicode-validation behavior a security gate should not re-derive by hand.

## Next-round recommendation

Adopt **E1: gate `pathOverrideHit` on `raw.includes("PATH=")` before the
whitespace split** (guards.ts). Measured, same run: guards stage 248.8 →
113.7 µs = **−54% of the dominant stage, ≈ −135 µs on the check sweep
(−14.5%)**. The equivalence is provable (no word can start with `PATH=` if
the raw lacks the substring) and machine-checked over the 717-command corpus
by the bench's self-check. It is a two-line change in product.

Stackable seconds, same evidence: E2 (replace the scanRaw charCode loop with
native regex tests for the control and weird-whitespace classes) takes the
ungated scan 248.8 → 220.5 (−11%; composes with E1 for a further slice), and
E3 (gate `memoryTargetOf` on `PROJECTS_ROOT + "/"` prefix before calling
`node:path.relative`) takes that helper 196.5 → 10.7 µs per 1018 paths
(−95%) — in-flow worth a few percent since only write/delete candidates
reach it. E1+E2+E3 together project the check sweep from ~929 to roughly
~730-760 µs (−18-21%). The tier ladder's triple `toLowerCase` per path is
the remaining candidate after that, but fusing it changes semantics for
length-changing case mappings (e.g. U+0130) — rejected for this round.

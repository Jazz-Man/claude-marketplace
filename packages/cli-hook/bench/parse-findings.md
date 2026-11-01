# parseCommand walk — variant bench findings

Goal: the fastest AST walk for `parseCommand` (`src/core/ast.ts`) that is
JSON-identical to the current output. All numbers: mitata, avg µs per sweep of
the 233-command arsenal (`src/mutable-commands.txt`, two placeholder lines
substituted via `EXEMPLARS`), bun 1.4.4, Apple M3 Pro (~3.88 GHz). Five runs;
the table below is the final run, with cross-run averages noted in the
analysis. Everything lives in `bench/parse.bench.ts` (variants as bench arms)
and `bench/equiv.ts` (equivalence gate). Product code untouched.

## Full mitata table (final run, on the formatted checked-in code)

| arm | avg µs/iter | min | p75 | p99 |
| --- | --- | --- | --- | --- |
| unbash parse only | 41.61 | 36.96 | 42.25 | 80.33 |
| current parseCommand | 97.60 | 86.96 | 101.33 | 123.38 |
| walk: flatMap (current copy) | 99.68 | 88.46 | 103.67 | 122.50 |
| walk: out-accumulator | 97.79 | 85.46 | 102.88 | 115.33 |
| walk: generator yield (naive yield*) | 112.03 | 100.96 | 116.17 | 138.54 |
| walk: visit only (no args) | 79.65 | 66.79 | 83.25 | 97.04 |
| V1 gen-stack args | 99.53 | 82.50 | 103.83 | 130.29 |
| V2 fcc-out args | 86.80 | 72.79 | 90.75 | 106.21 |
| V3 fusion single-pass | 81.82 | 68.58 | 86.08 | 99.46 |
| V4 fusion + subst gate | 81.46 | 68.33 | 85.42 | 98.71 |
| V4b fused+gate+read1 | 81.47 | 67.58 | 85.42 | 98.08 |
| V5 fcc-out + gate | 88.14 | 72.29 | 91.92 | 108.79 |
| V6 fusion+gate+read1 (combo harness) | 87.85 | 80.46 | 90.08 | 106.17 |
| V7 +inline redirects (combo harness) | 87.61 | 73.67 | 90.50 | 106.71 |
| V8 +type wordLike (combo harness) | 88.66 | 73.63 | 91.96 | 102.58 |
| V9 fusion+gate+lazy-read1 (combo harness) | 85.90 | 70.75 | 88.71 | 102.58 |

This final run was the noisiest of the six (whole machine a touch slower; V1
caught a 329 µs outlier). Cross-run averages over six runs, dedicated arms:
current ~96.9, V1 ~94.9 (range 92.1-99.5), V2 ~84.5, V3 ~81.2, V4 ~79.7,
V4b 81.3-81.5 (two runs) — V4/V4b beat everything in every run. V6-V9 share a
flag-checking harness that costs ~2-4 µs over their dedicated equivalents;
their value is the isolation data, not their absolute numbers.

## Variant designs

### V1 — gen-stack (the correct generator shape)

One generator per Command suffix, explicit pending-node stack, `yield` only at
word leaves — zero `yield*` delegation, so zero per-node generator objects:

```ts
function* suffixArgsGen(suffix: readonly unknown[]): Generator<string> {
  const stack: unknown[] = [];
  for (let i = suffix.length - 1; i >= 0; i--) stack.push(suffix[i]);
  while (stack.length > 0) {
    const node: unknown = stack.pop();
    if (node === null || typeof node !== "object") continue;
    if (wordLike(node)) {
      if (!WHOLE_WORD_SUBST.test(node.value)) yield node.value;
      continue;                      // args terminate at wordLike nodes
    }
    if (isPruned((node as {type?: unknown}).type)) continue;
    const children: unknown[] = [];
    forEachChild(node as SyntaxNode, (c) => { children.push(c); });
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
  }
}
```

### V2 — fcc-out (forEachChild enumeration + out-accumulator)

Same visit walk as current; `wordValues` re-enumerated via `forEachChild`
instead of `Object.values(...).flatMap(...)`, pushing into a caller-owned
array. Isolates the enumeration change from the generator question.

### V3 — fusion (single-pass visit)

Args collected during the main `visit` walk with an explicit `argStack` of
collector frames (`string[]` = active collector, `null` = suspended). The
Command case expands `forEachChild`'s own order (prefix → name → suffix)
manually so each zone gets its frame:

```ts
if (type === "Command") {
  const { name } = node;
  if (name !== undefined) {
    const unit = { args: [], name: name.value };
    units.push(unit);
    collectRedirects(node, redirects);        // BEFORE descent: preserves
    argStack.push(null);                      // redirects[] order vs nested
    for (const child of node.prefix) visit(child);
    argStack.pop();
    visit(name);                              // name word: words, never args
    argStack.push(unit.args);
    for (const child of node.suffix) visit(child);
    argStack.pop();
  } else { collectRedirects(node, redirects); forEachChild(node, visit); }
  return;
}
```

At wordLike nodes with an active collector: push the value (subst-filtered)
into args, then push a `null` frame for the subtree — mirroring wordValues'
termination at wordLike nodes. Pruned types (below) get the same one-subtree
suspension, so `words` still descends everywhere it does today.

### V4 — fusion + charCode subst gate

V3 plus: `WHOLE_WORD_SUBST` can only match when the first character is `$`,
backtick, `<`, or `>`, so a charCode check skips the regex for ordinary words:

```ts
function isSubst(value: string): boolean {
  const c = value.charCodeAt(0);
  return (c === 36 || c === 96 || c === 60 || c === 62) && WHOLE_WORD_SUBST.test(value);
}
```

V4b = V4 with `node.value` read once per wordLike node inside the collector
zone (the value getter is cached after first read, so the second read it
replaces is cheap — hence no measurable difference).

### V6-V9 — combo harness (isolation data)

V6 fusion+gate+read-once, V7 +inline redirect collection (scan prefix/suffix
directly instead of the derived `command.redirects` getter), V8 +closed-set
type-based wordLike, V9 +read-once-only-inside-collector-zone. All share a
flag-branching harness; all beat current but lose to dedicated V4.

## Equivalence

Gate: `bench/equiv.ts` — JSON.stringify comparison against the production
`parseCommand` over a 717-command corpus: the 233 arsenal commands (with
EXEMPLARS substitution), every table from all five
`tests/fixtures/*.ts` files (filesystem ASK/ALLOW/DENY, git-readonly
ALLOW/DENY, MEMORY_ASK/MEMORY_ALLOW, no-deps ALLOW/DENY, no-inline-scripts
DENY/ALLOW/FUNCTIONS), and 36 adversarial commands (assignments in suffix,
indexed assignments, array values, heredocs in substitutions, here-strings,
process substitution, compound commands, functions, arithmetic, globs).

**Verdict: every variant (V1-V9) is JSON-identical to production output on all
717 commands.** A `reference current-copy` arm in the gate cross-checks the
harness itself.

### The semantic traps that made naive variants wrong

Reading unbash 6.0.0 source (`node_modules/.bun/unbash@6.0.0/.../dist/`)
changed the design of every variant:

1. **Lazy getter-hidden children.** `AssignmentImpl`, `ArrayValueImpl`,
   `HereDocBodyImpl`, `WordImpl`, `CommandImpl` are classes whose child
   references (`value`, `index`, `elements`, `parts`, and the derived
   `args`/`redirects`) are prototype getters over private fields. `Object.values`
   on them returns only own data props (`type`, `pos`, `end`, `text`).
   Consequence: the current `wordValues` collects **nothing** from Assignment,
   ArrayValue, or HereDocBody subtrees — and a plain `forEachChild` walk
   (which visits those children) would over-collect. All FCC variants prune
   exactly `Redirect | Assignment | ArrayValue | HereDocBody`.
2. **wordLike is structural, not `type === "Word"`.** Census over the corpus:
   {Word, Literal, Glob, SingleQuoted, AnsiCQuoted, HereDocDelimiter} all pass
   (all have string `text` + string `value`). Literal parts of every word land
   in `words` (so `words` contains each plain word twice — Word + its Literal
   part). Args, by contrast, terminate AT the wordLike node — parts never
   contribute to args. Fusion mirrors this by suspending the collector beneath
   every wordLike node while `forEachChild` keeps descending for words.
3. **Suffix elements are not all Words**: {Word, Assignment, Redirect,
   HereString, HereDoc}. HereString/HereDoc in a suffix are NOT pruned by
   current `wordValues` (the check is `type === "Redirect"` only), so their
   delimiter/target/body-word values ARE args today; the fused walk reproduces
   that (they are not in the prune list; their collectable wordLike children
   are reached with the collector active).
4. **Redirects order vs nested commands.** `collectRedirects` must run before
   descending a Command's children, exactly as today: `echo $(cat < x) > f`
   must emit `> f` before `< x` in `redirects`. The fused walk calls it before
   the manual prefix/name/suffix traversal.
5. **Command name word**: visited for `words` only, never args (the `null`
   frame around `visit(name)`), and prefix words are excluded from that
   command's args (`null` frame around the prefix loop) — matching
   `wordValues(node.suffix)` exactly.
6. **WHOLE_WORD_SUBST words**: filtered from args, kept in words — the fused
   walk tests the filter only on the args path.

Residual equivalence note (not a corpus issue): the variants pin TODAY's
observable semantics of `Object.values`-based descent. If a future unbash
release turned the lazy getters into plain data properties, production
behavior would change (start collecting assignment values etc.) while these
variants would not. Corpus-equivalence would need re-running per unbash bump —
the gate script makes that a one-command check.

## Why each variant wins or loses

- **V1 gen-stack (~94.9 avg, −2%)**: confirms the delegation hypothesis —
  `yield*` was the killer, not `yield`. One generator + explicit stack removes
  the per-node generator object and suspended frame of the naive version
  (112.0 → 92-96 across runs, a ~15% recovery over the naive shape). But each
  `next()` still pays iterator-protocol resumption and the consumer (`[...gen]`)
  pays the same array growth as a push loop, so it stays well behind the
  direct-push designs. **A yield-based walk CAN beat the current one — but
  only barely, and never the callback walks.**
- **V2 fcc-out (83.9 avg, −13%)**: the single biggest lever was never the
  flatMap vs push choice (out-accumulator alone: neutral, ~96) — it is
  **enumeration**. `Object.values(node)` allocates a values array per node
  and double-walks the prototype chain; `forEachChild` is a monomorphic
  switch that allocates nothing. ~13 µs/sweep from this alone.
- **V3 fusion (80.9 avg, −16%)**: collecting args during the main visit
  deletes the second descent over every suffix subtree. The remaining
  per-node cost is one `argStack` top read plus occasional push/pop pairs —
  the args work is close to free (V3 is ~4 µs above the visit-only floor).
- **V4 (79.4 avg, −18%)**: the charCode gate skips the anchored regex for
  every word not starting with `` $ ` < > `` — most words. Worth 1-3 µs.
- **V4b**: read-value-once is free but buys nothing measurable — the lazy
  getter memoizes, the second read is a cached-field return.
- **V7 inline redirects**: no gain. The derived `redirects` getter filters
  prefix+suffix once per Command and caches; re-implementing it inline just
  moves the same two loops. Not worth the divergence from upstream's
  definition.
- **V8 type wordLike**: WORSE (88.8 avg in-harness) — `Set.has` plus the
  extra branch loses to the structural probe, and it would trade away the
  structural contract (any node with text+value strings is a word) for a
  list that must track unbash's node menagerie. Reject on both grounds.
- **V6/V9 read-once variants**: neutral-to-negative once done correctly
  (filter evaluated only inside collector zones). The first attempt (V6)
  accidentally evaluated the keep-predicate on EVERY wordLike node — a
  per-node closure call — and lost 3 µs to V4; placing the filter inside
  the `args !== null` zone recovered it. Ordering of cheap checks beats
  removing cheap reads.

### Where the remaining time goes

unbash parse 41.5 + walk floor ~35: the floor is `forEachChild` dispatch plus
unbash's LAZY materialization — the visit accesses `Word.parts` and
`Word.value` getters, which run unbash's part-resolution lexer machinery on
first touch. That cost is intrinsic to collecting `words` (we must read every
wordLike value); no walk shape avoids it. Args above that floor: ~3-5 µs (V4).

## Recommendation

Adopt **V4** — the fused single-pass walk with the charCode-gated subst filter
(`parseCommandFused(command, true)` shape, or V4b for the tidier read-once
form; identical within noise). Expected gain vs current `parseCommand`:
**~96.9 → ~79.7 µs/sweep avg, −18%** (best observed single run 78.0), with
p99 down ~20% (123-126 → 97-99 µs). It keeps the structural `wordLike` check and
`collectRedirects` untouched; the only new mechanism is the `argStack` of
collector frames, documented above with its four equivalence traps.

If a minimal-diff change is preferred, V2 (fcc-out wordValues) alone delivers
−13% with zero structural change to the walk — but it leaves the second
suffix descent in place.

Generators: yield CAN be made to beat the current code (V1), but only by ~3%,
and it loses to both non-generator alternatives — retire the generator line
of inquiry.

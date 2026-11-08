# Rule ordering and precedence

When several rules in a profile match the same operation on the same object, which one decides?

This is the most consequential question in SBPL and the one where published sources disagree most
confidently:

| Source | Claim |
|---|---|
| fG!, *Apple's Sandbox Guide* v1.0 (2011) | *"Searching for operations will stop when the first explicit match is hit. This means that a deny action followed by an allow action to the same operation and target will never trigger the allow action."* → **first match wins** |
| Blochberger, *A Whirlwind Tour of the Apple Sandbox* (2020, from a Master's thesis) | *"Confirmed by extensive testing, the last applicable rule in a profile guides the final sandbox decision."* → **last match wins** |
| `kainkalju/analysis`, macOS Seatbelt reference (2026) | *"Rules are evaluated first match wins. Later rules do not override earlier ones."* → **first match wins** |

None of the three is right. Measured on macOS 27.2 (build 26B123), precedence has **three
dimensions**, and only the last of them is about order.

---

## The model

> ### 1. Operation specificity — strongest dimension
> A rule naming a **specific** operation outranks a rule naming a **wildcard** that covers it,
> regardless of position.
>
> ### 2. Filter presence — second dimension
> A rule **with** a filter outranks a rule on the same operation **without** one, regardless of
> position. The *kind* of matcher does not matter: `literal` is not more specific than `subpath`.
>
> ### 3. Position — tie-breaker only
> Among rules equal on both dimensions above, the **last** one in the file wins.
>
> ### `default` is weaker than everything
> Any rule naming a real operation outranks `(allow default)` / `(deny default)` in either order,
> so the position of the `default` statement is irrelevant.

Specificity ladder, strongest to weakest:

```
file-write-mode + filter  >  file-write-mode bare  >  file-write*  >  file*  >  default
```

---

## Evidence

### Why naive tests produce wrong answers

Two confounds invalidated the first round of experiments behind this document, and both will
invalidate yours:

1. **Symlinked paths.** `$TMPDIR` is `/var/folders/...`, but `/var` is a symlink to `/private/var`,
   and filters match the *physical* path. A filter written with `$TMPDIR` never matches, every rule
   silently no-ops, and an ordering test appears to show "nothing is denied". Canonicalise with
   `pwd -P`.
2. **`dyld` aborts.** If a test profile denies something `dyld` needs, the child dies with `SIGABRT`
   (exit 134) *before* the operation under test is reached — indistinguishable from a denial if you
   only check "did it print the secret".

The experiment below avoids both: it grants every read/exec the child needs, and varies only
`file-write-mode` on a single file, exercised via `chmod 644`. Allowed → exit 0. Denied → exit 1
with `Operation not permitted`.

| Control | Rules | Result |
|---|---|---|
| positive | `(allow file-write-mode (literal T))` | ALLOWED |
| negative | *(none — implicit deny)* | DENIED |
| wildcard coverage | `(allow file-write*)` alone | ALLOWED |
| wildcard coverage | `(allow file*)` alone | ALLOWED |

### Dimension 1 — same operation, both filtered: last wins

| # | Rules, in file order | Result | first-match predicts | last-match predicts |
|---|---|---|---|---|
| A1 | `deny …(literal T)` then `allow …(literal T)` | **ALLOWED** | DENIED | ALLOWED |
| A2 | `allow …(literal T)` then `deny …(literal T)` | **DENIED** | ALLOWED | DENIED |
| C1 | `deny …(subpath WORK)` then `allow …(literal T)` | **ALLOWED** | DENIED | ALLOWED |
| C2 | `allow …(literal T)` then `deny …(subpath WORK)` | **DENIED** | ALLOWED | DENIED |
| D1 | `deny`, `allow`, `deny` (all filtered) | **DENIED** | DENIED | DENIED |
| D2 | `allow`, `deny`, `allow` (all filtered) | **ALLOWED** | ALLOWED | ALLOWED |
| SY | `(allow sysctl-read)` then `(deny sysctl-read)`, then run `sysctl` | **denied** | allowed | denied |

A1 vs A2 flip with order and nothing else changes: **the last rule wins**. C1/C2 additionally show
that `subpath` vs `literal` is not a specificity difference — only position decides.

### Dimension 2 — filtered beats unfiltered, in either order

| # | Rules, in file order | Result | last-match predicts | filter-presence predicts |
|---|---|---|---|---|
| B1 | `allow file-write-mode` (bare) then `deny file-write-mode (literal T)` | **DENIED** | DENIED | DENIED |
| B2 | `deny file-write-mode (literal T)` then `allow file-write-mode` (bare) | **DENIED** | ALLOWED | DENIED |
| E1 | `allow file-write-mode (subpath WORK)` then `deny file-write-mode` (bare) | **ALLOWED** | DENIED | ALLOWED |
| E2 | `deny file-write-mode` (bare) then `allow file-write-mode (subpath WORK)` | **ALLOWED** | ALLOWED | ALLOWED |
| E3 | `deny file-write-mode (literal T)` then `deny file-write-mode` (bare) | **DENIED** | DENIED | DENIED |
| E4 | `deny file-write-mode` (bare), nothing else | **DENIED** | DENIED | DENIED |

B2 and E1 are the discriminating pair: the outcome follows the **filtered** rule in both, no matter
where it sits. A bare `(allow file-write-mode)` therefore cannot punch a hole through a filtered
deny, and a bare `(deny file-write-mode)` cannot retract a filtered allow.

### Dimension 3 — named operation beats wildcard, in either order

| # | Rules, in file order | Result | last-match predicts | specificity predicts |
|---|---|---|---|---|
| P1 | `allow file-write-mode (literal T)` then `deny file-write*` | **ALLOWED** | DENIED | ALLOWED |
| P3 | `allow file-write-mode (literal T)` then `deny file*` | **ALLOWED** | DENIED | ALLOWED |
| P6 | `deny file-write-mode (literal T)` then `allow file-write*` | **DENIED** | ALLOWED | DENIED |
| P5 | `allow file-write*` then `deny file-write-mode (literal T)` | **DENIED** | DENIED | DENIED |
| P2 | `deny file-write*` then `allow file-write-mode (literal T)` | **ALLOWED** | ALLOWED | ALLOWED |
| P4 | `deny file*` then `allow file-write-mode (literal T)` | **ALLOWED** | ALLOWED | ALLOWED |

P1/P6 and P3 give the **same** result in opposite orders and always follow the specifically named
operation. Order is irrelevant across a specificity boundary.

### Dimension 4 — `default` is weakest

| # | Rules, in file order | Result |
|---|---|---|
| B3 | `(allow default)` then `deny file-write-mode (literal T)` | **DENIED** |
| B4 | `deny file-write-mode (literal T)` then `(allow default)` | **DENIED** |

Identical outcome in both orders. This is why the standard whitelist idiom works even though
`(deny default)` is written *first*:

```scheme
(version 1)
(deny default)          ; weakest — every allow below outranks it
(allow process-exec)
(allow file-read* (subpath "/usr/lib"))
```

---

## Corollaries you can rely on

**1. Write denials last.** Among equal-specificity rules position decides, so put every `(deny ...)`
after the allows it must override. Chromium, Firefox and Apple all do this.

**2. A wildcard deny cannot retract a specific allow.** If an earlier rule says
`(allow file-write-mode (literal …))`, adding `(deny file-write*)` later will *not* block it. Deny
the same named operation instead.

**3. A bare allow cannot undo a filtered deny** — and a bare deny cannot undo a filtered allow.
Filters raise specificity above any unfiltered rule on the same operation.

**4. The useful direction of #2/#3.** You can lay down a blanket `(deny file-write*)` and then punch
precise holes with `(allow file-write-data (literal …))` in *any* order — the holes always win.

**5. `(deny default)` may go anywhere.** Convention puts it first for readability; semantics do not
care.

**6. Do not rely on matcher specificity.** `literal` does not outrank `subpath`, `prefix`, or
`regex`. Two filtered rules on one operation resolve purely by position.

**7. To guarantee a block, deny the same named operation, filtered, and put it last.** That wins on
all three dimensions at once.

---

## Practical patterns

### Whitelist (deny-all baseline)

```scheme
(version 1)
(deny default)
(allow process-exec)
(allow file-read*)
(allow file-write* (subpath (param "PROJECT_DIR")))
(deny file-read* (subpath (string-append (param "HOME") "/.ssh")))   ; last, so it wins
```

### Blacklist (allow-all with carve-outs)

```scheme
(version 1)
(allow default)
(deny file-read*  (subpath "/private/etc"))
(deny file-write* (subpath (param "PROJECT_DIR")))
(deny network-outbound (remote tcp "*:25"))
```

Works because every `deny` names a real operation and therefore outranks `(allow default)`.

### Retracting something you cannot see

When a base profile you `import` may already allow an operation and you must guarantee it is
blocked, name the operation explicitly, add a filter, and place the rule last:

```scheme
(import "system.sb")
…
(deny file-write-data (subpath "/private/etc"))     ; filtered + named + last → wins on all three
```

### Reproducing every test in this document

```bash
cd tmp/apple-sandbox
./probe-ordering.sh    mined/ordering.txt      # dimensions 1, 3, 4 + dyld/file-map-executable checks
./probe-precedence.sh  mined/precedence.txt    # wildcard vs specific, wildcard coverage, symlink matrix
./probe-paths.sh       mined/paths.txt         # path resolution 2x2
```

---

## Why the model looks like this

Blazakis's reverse-engineering recovered the SBPL stub that `libsandbox` loads before evaluating
your profile, and it documents the shape of the compiled rule table (**sourced**:
[legacy/BlackHat_DC_2011_Blazakis_Apple_Sandbox-wp.md](legacy/BlackHat_DC_2011_Blazakis_Apple_Sandbox-wp.md#4-implementation-userspace),
§4):

```scheme
;;; These modules build a *rules* table that maps operation codes to lists of rules of the form
;;; RULE -> TEST | JUMP
;;; TEST -> (filter action . modifiers)
;;; JUMP -> (#f . operation)
;;; The result of an operation is decided by the first test with a filter that
;;; matches. Filter can be #t, in which case the test always matches. A jump
;;; causes evaluation to continue with the rules for another operation.
;;; The last rule in the list must either be a test that always matches or a jump.
```

Read that against the measurements and the three dimensions fall out:

* **The kernel does first-match — over the compiled per-operation list, not over your source text.**
  Each operation code indexes its own list of `TEST`/`JUMP` entries, and *"the first test with a
  filter that matches"* decides. So "first match wins" is literally true at the kernel level, and
  simultaneously useless for authoring: what matters is the order the **compiler** emitted, which is
  not the order you wrote.
* **`JUMP` is why specificity beats position.** A `JUMP` entry redirects evaluation to another
  operation's list. Blazakis's worked example is `file-read-data` (operation code 5 on 10.6.4) whose
  sixth entry is `(#f . 0)` — a jump to operation code 0, `default`. Wildcard operations are the same
  mechanism: `file-write-mode`'s list falls through to `file-write*`'s list, which falls through to
  `file*`'s, which falls through to `default`. Those jump targets are wired up by the compiler from
  the *naming hierarchy*, not from where you placed the rules. That is exactly what P1/P6 measured:
  a named operation always resolves before the wildcard it belongs to, in either source order.
* **A filter is part of the `TEST`, so having one changes what the test matches** — which is what the
  filtered-vs-unfiltered dimension (B1/B2/E1) is observing. An unfiltered rule compiles to a test
  whose filter is `#t` ("always matches"), and the stub's last line requires such an always-matching
  test — or a jump — to terminate every list.
* **`(#t deny)` as the first entry** is what a bare `(deny default)` compiles to. Blazakis's dumped
  `*rules*` for a real profile opens with exactly that.

Two caveats on using this to reason further. The operation codes, the count of entries (59 on
10.6.4) and the exact list layout are all from Snow Leopard; on macOS 27.2 the vocabulary is 217
operations (**verified**, see [04](04-operations-reference.md)). And the compiled table is not
inspectable — there is no supported way to dump it, which is why everything above the mechanism is
measured behaviour rather than read structure.

---

## What is still unknown

* Whether operation specificity is a full hierarchy (`file-write-mode` > `file-write*` > `file*`) or
  a two-level "named vs wildcard" distinction. Only the `file` family was probed to three levels,
  and `file*` behaved exactly like `file-write*`.
* Whether the same three dimensions apply to Mach, network and IOKit operations, or only to the file
  family that was measured.
* How rules inside a `(with-filter ...)` block rank against rules outside it.
* Whether `require-all`-wrapped filters gain specificity over bare filters. Evidence says no
  (C1/C2 resolve by position), but the case was not isolated.

---

## Corrections to publish

If documentation you maintain repeats any of these, it is wrong on macOS 27.2:

| Claim | Reality |
|---|---|
| "First matching rule wins; later rules never override earlier ones." | Later rules **do** override earlier ones at equal specificity (A1/A2/C1/C2). |
| "A `deny` followed by an `allow` on the same target will always deny." | It allows (A1). |
| "More specific filters take precedence." | Matcher type is not specificity (C1/C2). Filter *presence* is (B2/E1). |
| "`(deny file-write*)` blocks writes even if a narrower allow appeared earlier." | It does not (P1). |
| "Order of rules is the only thing that matters." | Operation specificity and filter presence both outrank order (P1/P6/B2/E1). |

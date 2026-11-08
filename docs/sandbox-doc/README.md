# Apple's Sandbox (Seatbelt) — complete reference for `sandbox-exec`

Everything needed to write, debug and maintain macOS Seatbelt profiles (SBPL), assembled from
Apple's own on-disk profiles, the `libsandbox` binary, the man pages, the published research, and
direct probing of the compiler on a live machine.

There is **no official Apple documentation for SBPL**. `sandbox-exec(1)` is seven lines of options
and explicitly deprecated; the App Sandbox Design Guide describes entitlements, not profiles. So
this directory is built from primary evidence instead, and every non-obvious claim is marked with
how it was established.

**Verification target:** macOS 27.2, build 26B123, arm64e — verified 2026-11-08.

---

## Evidence legend

Used throughout these documents:

| Mark | Meaning |
|---|---|
| **verified** | Observed directly on the target machine (compiler output, program behaviour, file on disk) |
| **mined** | Extracted mechanically from a binary or from Apple's own profile files |
| **sourced** | Taken from a third-party document; URL and retrieval date in [13-sources-and-provenance.md](13-sources-and-provenance.md) |
| **contradicted** | A claim found in a public source that testing on macOS 27.2 disproves |
| **unverified** | Plausible, repeated across sources, but not confirmed here |

---

## Reading order

### Start here

| Document | What it gives you |
|---|---|
| [01-overview-and-architecture.md](01-overview-and-architecture.md) | What Seatbelt is, how a profile becomes an enforcement decision, where each piece lives, and how `sandbox-exec` relates to the App Sandbox |
| [02-sandbox-exec-cli.md](02-sandbox-exec-cli.md) | The command itself: every flag, every exit code, profile search paths, what is broken on current macOS |
| [03-sbpl-language.md](03-sbpl-language.md) | The language: rule anatomy, the Scheme layer, directives, how to structure a profile |

### Reference

| Document | What it gives you |
|---|---|
| [04-operations-reference.md](04-operations-reference.md) | All **217** operations the compiler accepts, by category, with Apple-profile usage counts and the diff against the 2011 list |
| [05-filters-reference.md](05-filters-reference.md) | All filters and matchers, built-in vs Apple-macro vs Scheme, path-matcher semantics, modifiers |
| [06-rule-ordering-and-precedence.md](06-rule-ordering-and-precedence.md) | Which rule wins when several match — settled by experiment, and three published sources get it wrong |
| [07-modifiers-and-predicates.md](07-modifiers-and-predicates.md) | Attribute predicates (`is-platform-binary`, `app-container`, …), keyword atoms, the TinyScheme layer |

### Practice

| Document | What it gives you |
|---|---|
| [08-debugging-and-troubleshooting.md](08-debugging-and-troubleshooting.md) | Reading denials, the complete compiler-error catalogue, why a process aborts instead of failing, the workflow for building a profile from nothing |
| [09-recipes.md](09-recipes.md) | Ready-to-adapt profiles: read-only filesystem, no network, allowlisted network via proxy, CLI/agent sandbox, per-command wrappers |
| [10-real-world-profiles.md](10-real-world-profiles.md) | How Chromium, Firefox, Anthropic's sandbox-runtime and Apple's own daemons actually write SBPL, with the techniques worth stealing |
| [11-app-sandbox-and-entitlements.md](11-app-sandbox-and-entitlements.md) | The entitlement-based App Sandbox: containers, extensions, how entitlements become SBPL rules, and when to use which |
| [12-changes-since-2011.md](12-changes-since-2011.md) | Everything that moved or broke since the classic guides: removed operations, moved paths, dead flags, dead tools |
| [13-sources-and-provenance.md](13-sources-and-provenance.md) | Every source with its retrieval date, plus the exact commands that reproduce each machine-generated table |

### Historical primary source

| Document | Note |
|---|---|
| [legacy/BlackHat_DC_2011_Blazakis_Apple_Sandbox-wp.md](legacy/BlackHat_DC_2011_Blazakis_Apple_Sandbox-wp.md) | Dionysus Blazakis, *The Apple Sandbox*, Black Hat DC 2011 — the reverse-engineering of `libsandbox`, the embedded TinyScheme, the compiled `*rules*` bytecode format (§4), `Sandbox.kext` and its syscalls (§5.1) and the `AppleMatch.kext` regex engine (§5.2). Appendix B preserves the 2011 `sandbox-exec(1)` and `sandbox_init(3)` man pages, which is useful for seeing how far the official documentation has *not* moved. Kept because the architecture it describes is still how the sandbox works; it is the basis of chapter 01 |

Two other historical sources were consulted and then **deliberately not kept**, because most of
their content had gone stale. What was still true in them was folded into the current chapters:

| Removed source | Where its still-valid content now lives |
|---|---|
| fG! (Pedro Vilaça), *Apple's Sandbox Guide* v1.0, 2011 — 48 pp. | Per-operation semantics and kernel entry points → the *Operation semantics* section of [04-operations-reference.md](04-operations-reference.md#operation-semantics). Everything that had gone stale (operation list, profile paths, `-n` profiles, `trace`, `system.log`, and above all the "first match wins" precedence claim) is catalogued in [12-changes-since-2011.md](12-changes-since-2011.md) |
| `sandbox-exec(1)`, `sandbox_init(3)`, `sandbox.h` as shipped | Quoted verbatim inline in [02-sandbox-exec-cli.md](02-sandbox-exec-cli.md) |

---

## The sixty-second version

```scheme
(version 1)
(deny default)

(allow process-exec)
(allow process-fork)
(allow sysctl-read)
(allow mach-lookup)
(allow file-read*)
(allow file-write*
  (subpath (param "PROJECT_DIR"))
  (subpath "/private/tmp"))
(allow network-outbound
  (remote tcp "localhost:8080"))
```

```bash
sandbox-exec -D PROJECT_DIR="$PWD" -f profile.sb ./build.sh
```

Six things that will bite you, each documented in detail:

1. **Write physical paths in filters.** `(subpath "/tmp/x")` never matches; `/tmp` is a symlink and
   the filter string is not canonicalised. Use `/private/tmp/x`. → [05](05-filters-reference.md)
2. **The last matching rule wins**, among rules naming the same operation with the same
   specificity. Most published guides say first-match. → [06](06-rule-ordering-and-precedence.md)
3. **Specificity outranks order**: `(deny file-write*)` cannot override an earlier
   `(allow file-write-mode …)`, and a filtered rule outranks an unfiltered one on the same
   operation. → [06](06-rule-ordering-and-precedence.md)
4. **`(deny default)` does not deny everything.** Firefox explicitly denies `process-info*`,
   `nvram*`, `iokit-get-properties` and `file-map-executable` on top of it. → [03](03-sbpl-language.md)
5. **A bare wildcard aborts the compiler.** `(allow process-exec*)` with no filter kills
   `sandbox-exec` with `Abort trap: 6`. → [08](08-debugging-and-troubleshooting.md)
6. **The `-n` predefined profiles are dead.** `no-internet`, `pure-computation` and friends now
   `Killed: 9`. → [12](12-changes-since-2011.md)

And one thing nobody writes down: **the latest SBPL version is 3, not 1.** `libsandbox` logs
`sandbox compile: using compatibility definitions for version 1 (latest version is 3)` on every
compile. Versions 2 and 3 add raw-syscall allowlists and drop several familiar names — including
`debug`, so `(debug deny)` cannot be used there. Write `(version 1)` unless you are building a
hardened parser. → [03](03-sbpl-language.md#version-1-vs-2-vs-3)

---

## Reproducing the machine-generated parts

The tables in [04](04-operations-reference.md), [05](05-filters-reference.md) and
[07](07-modifiers-and-predicates.md) are generated, not typed. The scripts live in
`tmp/apple-sandbox/` (gitignored) and need only a Mac with the Command Line Tools — `python3`,
`swift`, `clang` — and no `brew` or `sudo`:

```bash
cd tmp/apple-sandbox
python3 mine-libsandbox.py > mined/libsandbox-strings.tsv    # op/filter names from the dyld shared cache
./probe-ops.sh mined/candidates-union.txt mined/op-probe.tsv # compile every candidate, record the error
SBPL_VERSION=3 ./probe-ops.sh mined/candidates-union.txt mined/op-probe-v3.tsv
python3 parse-profiles.py mined/profile-ast.json             # s-expression parse of all Apple .sb files
python3 gen-reference.py ../../docs/sandbox-doc               # emit the reference tables

./probe-ordering.sh mined/ordering.txt                       # rule precedence, dimensions 1/3/4
./probe-precedence.sh mined/precedence.txt                   # wildcard vs specific, filter presence
./probe-paths.sh mined/paths.txt                             # symlink resolution matrix
./probe-semantics.sh mined/semantics.txt                     # version stmt, modifiers, directives, errors
./probe-default-allowed.sh mined/default-allowed.txt         # what survives (deny default)
./probe-versions.sh mined/versions.txt                       # SBPL version 1 vs 2 vs 3
./probe-versions-ordering.sh mined/versions-ordering.txt     # ordering across versions
./probe-recipes.sh mined/recipes.txt                         # every profile in 09-recipes.md
```

Re-running them on a different macOS version is the fastest way to find out what Apple changed.
Full provenance, retrieval dates and the list of contradicted claims:
[13-sources-and-provenance.md](13-sources-and-provenance.md).

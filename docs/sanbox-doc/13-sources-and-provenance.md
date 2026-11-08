# Sources and provenance

Everything in this directory comes from one of three kinds of source. Each claim in the other
documents is tagged **verified**, **mined**, **sourced**, **contradicted** or **unverified**; this
page says where each of those came from and how to reproduce it.

Retrieval date for all network sources: **2026-11-08**.
Measurement host: **macOS 27.2, build 26B123, arm64e, SIP enabled**, Command Line Tools SDK
`MacOSX27.sdk`.

---

## 1. Local primary sources on this machine

These are the most trustworthy inputs available, because they are what the running kernel and
compiler actually use.

| Source | Path | Used for |
|---|---|---|
| `sandbox-exec` binary | `/usr/bin/sandbox-exec` | every compile probe; link list via `otool -L` |
| `libsandbox.1.dylib` | inside the dyld shared cache, `/System/Volumes/Preboot/Cryptexes/OS/System/Library/dyld/dyld_shared_cache_arm64e.01` | the operation/filter vocabulary |
| `sandbox-exec(1)` man page | `/usr/share/man/man1/sandbox-exec.1` | [legacy/man-sandbox-exec.md](legacy/man-sandbox-exec.md) |
| `sandbox_init(3)` man page | `…/MacOSX.sdk/usr/share/man/man3/sandbox_init.3` | [legacy/man-sandbox_init.md](legacy/man-sandbox_init.md); the SDK ≥ 27 kill notice |
| `sandbox.h` | `…/MacOSX.sdk/usr/include/sandbox.h` | [legacy/sandbox.h](legacy/sandbox.h); deprecation annotations |
| Apple's SBPL profiles | `/System/Library/Sandbox/Profiles/*.sb` (555) and `/usr/share/sandbox/*.sb` (56) | frequency tables, op→filter matrix, idioms |
| Unified log | `log stream` / `log show` | denial format, log sender, `libsandbox` compile messages |

Absent, and their absence is itself documented in
[12-changes-since-2011.md](12-changes-since-2011.md): `/usr/lib/libsandbox*` as a file,
`/var/log/system.log`, `man sandbox.7`, `man sandboxd.8`, `/usr/bin/sandbox-simplify`,
`/usr/share/sandbox/bsd.sb`.

---

## 2. Documents retrieved

### Converted in full and kept verbatim

| Document | Origin | Status |
|---|---|---|
| **Apple's Sandbox Guide v1.0** — Pedro Vilaça (fG!), 2011-09-13, 48 pp. | <https://reverse.put.as/wp-content/uploads/2011/09/Apple-Sandbox-Guide-v1.0.pdf> | [legacy/apple-sandbox-guide-v1.0.md](legacy/apple-sandbox-guide-v1.0.md) |
| **The Apple Sandbox** — Dionysus Blazakis, Black Hat DC 2011, 2011-01-11 | mirror: <https://dl.packetstormsecurity.net/papers/general/apple-sandbox.pdf> | [legacy/blazakis-the-apple-sandbox-2011.md](legacy/blazakis-the-apple-sandbox-2011.md) |

The Blazakis original at
`https://media.blackhat.com/bh-dc-11/Blazakis/BlackHat_DC_2011_Blazakis_Apple_Sandbox-wp.pdf`
returns **HTTP 403** behind a Cloudflare challenge; the packetstorm mirror (linked from
ubrigens.com) served the same paper.

The fG! PDF text layer was extracted with Apple's own PDFKit via a 20-line Swift script
(`tmp/apple-sandbox/pdf2md.swift`), because `pdftotext`/poppler is not installed on this machine and
installing it would have required `brew`/`sudo`. The Markdown conversion of that text was produced
separately and is the version kept here.

### Used as secondary sources

| Document | Date | URL | What it contributed |
|---|---|---|---|
| *macOS Sandbox Profiles (SBPL) Explained* — macinternals.app | 2026-05-28 | <https://www.macinternals.app/en/blog/sandbox-profiles> | MACF hook names, bytecode pipeline, helper-process pattern, entitlement→rule mapping |
| *A Whirlwind Tour of the Apple Sandbox* — U. Briggen (ubrigens.com), from a 2018 Master's thesis | 2020-02-17 | <https://ubrigens.com/posts/sandbox_tour.html> | TinyScheme detail, `libsandbox`/`AppSandbox` inputs, `libsystem_secinit`, launch-time threat model, "last applicable rule" |
| *macOS Seatbelt (Sandbox) — Technical Reference* — `kainkalju/analysis` | 2026-04 | <https://raw.githubusercontent.com/kainkalju/analysis/main/macos-seatbelt.md> | Claude Code/`sandbox-runtime` integration detail; two claims **contradicted** by measurement (see below) |
| Chromium `common.sb` | current | <https://raw.githubusercontent.com/chromium/chromium/main/sandbox/policy/mac/common.sb> | real-world SBPL: parameters, Metal cache, data-volume bug workaround, sysctl allowlist |
| Chromium sandbox design doc | current | <https://raw.githubusercontent.com/chromium/chromium/main/docs/design/sandbox.md> | general design principles (mostly Windows; macOS section is a link out) |
| Firefox `SandboxPolicyContent.h` | current | <https://raw.githubusercontent.com/mozilla-firefox/firefox/main/security/sandbox/mac/SandboxPolicyContent.h> | `moz-deny`, sandbox levels, `defined?` feature detection, the `(deny default)` gap comment |
| Anthropic `sandbox-runtime` README | current | <https://raw.githubusercontent.com/anthropics/sandbox-runtime/main/README.md> | config→SBPL generation, proxy-based domain allowlist, `allowPty`, `allowAppleEvents`, weaker-isolation flags |
| Apple App Sandbox documentation | current | <https://developer.apple.com/documentation/security/app-sandbox> | the supported alternative; the archived Design Guide URL redirects here |

Cited but not retrieved (referenced by the sources above):

* XNU MAC framework sources —
  [`security/mac_framework.h`](https://github.com/apple-oss-distributions/xnu/blob/main/security/mac_framework.h),
  [`security/mac_policy.h`](https://github.com/apple-oss-distributions/xnu/blob/main/security/mac_policy.h),
  [`security/mac_vfs.c`](https://github.com/apple-oss-distributions/xnu/blob/main/security/mac_vfs.c),
  [`security/mac_mach.c`](https://github.com/apple-oss-distributions/xnu/blob/main/security/mac_mach.c)
* `libsystem_secinit` reimplementation — <https://github.com/0xbf00/libsecinit>
* Levin's entitlement database — <http://newosxbook.com/ent.jl>
* WWDC 2011 session 204, and the App Sandbox Design Guide quote *"designed to contain damage to the
  system and the user's data if an app becomes compromised"*
* Apple patents US9280644B2, US8635663, US20130283344, US8943550 (threat-model reconstruction)

Failed retrievals, recorded so nobody repeats them:

| URL | Result |
|---|---|
| `https://chromium.googlesource.com/chromium/src/+/HEAD/sandbox/policy/mac/seatbelt_sandbox_design.md?format=TEXT` | 404 |
| `https://firefox-source-docs.mozilla.org/security/sandbox/macos.html` | 404 |
| `https://media.blackhat.com/bh-dc-11/Blazakis/…-wp.pdf` and `…-Slides.pdf` | 403, Cloudflare challenge |

---

## 3. Claims contradicted by measurement

Each of these appears in a currently published source and is wrong on macOS 27.2. Evidence and
reproduction are in the linked documents.

| Claim | Source | Measured reality |
|---|---|---|
| "Rules are evaluated first match wins. Later rules do not override earlier ones." | `kainkalju/analysis` (2026); fG! (2011) | Later rules **do** override at equal specificity → [06](06-rule-ordering-and-precedence.md) |
| "A `deny` followed by an `allow` on the same target will never trigger the allow." | fG! (2011) | It allows → [06](06-rule-ordering-and-precedence.md) |
| "`sandbox-exec` for testing requires SIP-relaxed on modern macOS." | macinternals.app (2026) | Every test here ran with `csrutil status` = **enabled** → [02](02-sandbox-exec-cli.md) |
| "Watch violations with `log stream --predicate 'process == \"sandboxd\"'`" and `'subsystem == \"com.apple.sandbox\"'` | `kainkalju/analysis` (2026) | Both capture nothing; the sender is `Sandbox` and the process is `kernel` → [08](08-debugging-and-troubleshooting.md) |
| "Without `(allow file-map-executable)`, `dyld` cannot map shared libraries… Always include it." | `kainkalju/analysis` (2026) | `/bin/echo` ran fine without it, and with an explicit `deny` → [03](03-sbpl-language.md), [08](08-debugging-and-troubleshooting.md) |
| "For now there's only version 1." | fG! (2011) | Versions 1, 2 and 3 are valid; 1 is a compatibility mode → [03](03-sbpl-language.md) |
| `-n no-internet` blocks TCP/IP | fG! (2011) | SIGKILL, exit 137 → [02](02-sandbox-exec-cli.md) |
| `-f` accepts a bare profile name found in the three system directories | fG! (2011) | `No such file or directory` → [02](02-sandbox-exec-cli.md) |
| `(trace "file.sb")` records denied operations | fG! (2011) | compiles, writes nothing → [03](03-sbpl-language.md), [12](12-changes-since-2011.md) |

---

## 4. Reproducing the machine-generated content

Scripts live in `tmp/apple-sandbox/` (gitignored). They need only a Mac plus `python3`, `swift` and
`clang` from the Command Line Tools — no `brew`, no `sudo`, no third-party packages.

```bash
cd tmp/apple-sandbox
```

### Extract the vocabulary from libsandbox

```bash
swift pdf2md.swift <file.pdf> > out.txt        # PDF text via PDFKit (used for both legacy papers)
python3 mine-libsandbox.py > mined/libsandbox-strings.tsv
```

`mine-libsandbox.py` scans the 82 dyld shared-cache subcaches for anchor strings known to live in
`libsandbox`, then dumps every printable token in a ±300 KB window around them.

### Validate every candidate against the real compiler

```bash
./probe-ops.sh mined/candidates-union.txt mined/op-probe.tsv           # (version 1)
SBPL_VERSION=3 ./probe-ops.sh mined/candidates-union.txt mined/op-probe-v3.tsv
```

Each token is compiled as `(version N)(allow TOKEN)` and classified by exit code and error text —
the classification table is in
[04-operations-reference.md](04-operations-reference.md#how-this-table-was-produced).

### Parse Apple's 611 profiles

```bash
python3 parse-profiles.py mined/profile-ast.json
```

A hand-written SBPL tokenizer + s-expression parser (handles `;` comments, `#"…"` regex literals,
nested strings). Emits operation frequency, filter frequency, the operation→filter matrix, modifier
counts and every `(define …)` macro name.

### Emit the reference tables

```bash
python3 gen-reference.py ../../docs/sanbox-doc
```

Writes `04-operations-reference.md`, `05-filters-reference.md` and
`07-modifiers-and-predicates.md`. Set `SB_DOC_OS`, `SB_DOC_BUILD` and `SB_DOC_DATE` to change the
provenance stamp in the generated headers.

### Behavioural experiments

| Script | Produces | Backs which document |
|---|---|---|
| `probe-semantics.sh` | `mined/semantics.txt` | version statement, modifiers, directives, error surface |
| `probe-ordering.sh` | `mined/ordering.txt` | [06](06-rule-ordering-and-precedence.md) dimensions 1, 3, 4 |
| `probe-precedence.sh` | `mined/precedence.txt` | [06](06-rule-ordering-and-precedence.md) dimensions 2, 3; symlink matrix |
| `probe-paths.sh` | `mined/paths.txt` | [05](05-filters-reference.md) path resolution |
| `probe-default-allowed.sh` | `mined/default-allowed.txt` | what survives `(deny default)` |
| `probe-versions.sh` | `mined/versions.txt` | [03](03-sbpl-language.md) v1 vs v2/v3 vocabulary |
| `probe-versions-ordering.sh` | `mined/versions-ordering.txt` | ordering across versions |
| `probe-recipes.sh` | `mined/recipes.txt` | [09](09-recipes.md) — 13 pass/block assertions |
| `sandbox-init-probe.c` | — | `sandbox_init()` flags behaviour in [02](02-sandbox-exec-cli.md) |

Re-running these on another macOS version is the fastest way to find out what Apple changed:

```bash
./probe-ops.sh mined/candidates-union.txt mined/op-probe-$(sw_vers -productVersion).tsv
diff <(cut -f1,3 mined/op-probe.tsv) <(cut -f1,3 mined/op-probe-$(sw_vers -productVersion).tsv)
```

### Converting the legacy PDFs

```bash
swift pdf2md.swift Apple-Sandbox-Guide-v1.0.pdf   > guide-raw.txt
swift pdf2md.swift blazakis-apple-sandbox.pdf     > blazakis-raw.txt
./convert-pdf-text.sh converted                  # text cleanup + headings
./convert-blazakis.sh ../../docs/sanbox-doc/legacy/blazakis-the-apple-sandbox-2011.md
```

The man pages and header were dumped with `mandoc`, which ships with macOS:

```bash
mandoc -T markdown /usr/share/man/man1/sandbox-exec.1 > man-sandbox-exec.md
mandoc -T markdown "$SDKROOT/usr/share/man/man3/sandbox_init.3" > man-sandbox_init.md
```

---

## 5. Worth reading next (found, not retrieved)

Surfaced during searching and not used above, in rough order of expected value:

* <https://sigreturn.com/blog/ios-sandbox/> — iOS sandbox internals, overlaps heavily with macOS
* <https://saagarjha.com/blog/2020-05-20/mac-app-store-sandbox-escape/> — a real escape, useful for
  calibrating what the boundary does and does not stop
* <https://lucaswiman.github.io/blog/2023-06-04--macos-sandbox/> — practical `sandbox-exec` notes
* <https://www.karltarvas.com/macos-app-sandboxing-via-sandbox-exec/> — wrapping apps
* <https://snehankekre.com/posts/seatbelt-loopback/> — loopback filtering specifics
* <https://github.com/s7ephen/OSX-Sandbox--Seatbelt--Profiles> — the profile collection fG! cites
* <http://www.sedarwin.org/> — the TrustedBSD project; MAC framework primary documentation
* <https://www.trustedbsd.org/mac.html> — TrustedBSD MAC design
* <https://hacktricks.wiki/en/macos-hardening/macos-security-and-privilege-escalation/macos-security-protections/macos-sandbox/index.html>
* Blochberger & Federrath, *The State of the Sandbox* (2019) —
  <https://svs.informatik.uni-hamburg.de/publications/2019/2019-11-Blochberger-State-of-the-Sandbox.pdf>,
  the survey behind ubrigens.com
* Books cited by fG!: *Enterprise Mac Security: Mac OS X Snow Leopard* (Edge et al.) and *The Mac
  Hacker's Handbook* (Miller, Dai Zovi) — both have sandbox chapters, both predate everything above
* Jonathan Levin's *OS Internals* series — the deepest current treatment of the sandbox, behind a
  paywall

---

## 6. Gaps in this documentation

Stated plainly, so nobody trusts it past its evidence:

* **Kernel-side enforcement is inferred, not observed.** `Sandbox.kext` is closed; the evaluation
  model in [01](01-overview-and-architecture.md) comes from Blazakis (2011) and macinternals.app
  (2026), not from this machine.
* **Precedence was measured on one operation family** (`file-write-mode` via `chmod`). The
  three-dimension model is consistent across every case tried, but Mach, network and IOKit
  precedence were not isolated.
* **The op→filter matrix is descriptive.** It records which filters Apple *uses* with which
  operations, not which combinations the kernel would accept. A filter listed as unused may still be
  valid for that operation.
* **No timing measurements.** The "nanoseconds to microseconds per check" figure is quoted from
  macinternals.app and is marked **unverified**.
* **Single-machine, single-version.** Everything is macOS 27.2 arm64e. Intel behaviour, and
  behaviour on 15.x/26.x, is not covered — though the probe scripts make that easy to check.
* **`sbutil` was not found** on this machine, so compiled-profile disassembly is documented as a
  claim from macinternals.app rather than demonstrated.

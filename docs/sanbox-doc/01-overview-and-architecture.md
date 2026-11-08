# Overview and architecture

## What Seatbelt is

Seatbelt is Apple's kernel-level **mandatory access control** (MAC) system. It first shipped in Mac
OS X 10.5 Leopard under the name Seatbelt and was later folded into what Apple now simply calls
*the sandbox*. It is built on the **TrustedBSD MAC framework**, a port of which lives in XNU
(**sourced**: Blazakis 2011, [legacy](legacy/blazakis-the-apple-sandbox-2011.md); ubrigens 2020).

Where traditional UNIX permissions ask *who is this process running as* (discretionary access
control), Seatbelt asks *what is this process allowed to do*, per process, regardless of uid. A
sandboxed process running as root is still confined (**sourced**).

Four properties matter when you write profiles:

| Property | Consequence |
|---|---|
| **Irreversible** | Once applied, no code inside the process can loosen or remove the profile — not even after a privilege-escalation bug. Restrictions can only ever be narrowed. |
| **Inherited** | Children of a sandboxed process inherit the profile. `fork`/`exec` cannot escape it. |
| **Deny returns POSIX errors** | A blocked operation surfaces as `EPERM`/`EACCES`. Programs see "Operation not permitted", not a sandbox-specific error, which is why logging matters so much when debugging. |
| **Applied at exec** | The profile is attached before the program's entry point runs; it is read once and never reloaded. |

**verified**: inheritance and irreversibility are visible in the CLI behaviour —
`sandbox-exec -p '(version 1)(deny default)' /bin/echo hi` fails at `execvp()` and there is no way
for the child to opt out.

---

## The components

```
                      your text profile (.sb / -p string)
                                  │
                                  ▼
   ┌──────────────────────────────────────────────────────────┐
   │ libsandbox.1.dylib          (user space, closed source)  │
   │  · embeds a modified TinyScheme interpreter              │
   │  · EVALUATES the profile as Scheme source                │
   │  · serialises the resulting rules into opaque bytecode   │
   └──────────────────────────────────────────────────────────┘
                                  │  mac_syscall("Sandbox", 381, …)
                                  ▼
   ┌──────────────────────────────────────────────────────────┐
   │ Sandbox.kext                (kernel, closed source)      │
   │  · registers as a MACF policy module                     │
   │  · attaches compiled bytecode to the process credentials │
   │  · evaluates every hooked operation against it           │
   └──────────────────────────────────────────────────────────┘
              │                                    │
              ▼ deny                               ▼ violations
      EPERM / EACCES back to the caller        sandboxd  →  unified log
```

### `libsandbox` — the compiler

**verified**: `/usr/bin/sandbox-exec` links exactly two libraries:

```
/usr/bin/sandbox-exec:
        /usr/lib/libsandbox.1.dylib
        /usr/lib/libSystem.B.dylib
```

On macOS 11+ the dylib itself lives inside the dyld shared cache rather than on disk
(**verified**: `/usr/lib/libsandbox*` does not exist as a file; the strings were recovered from
`/System/Volumes/Preboot/Cryptexes/OS/System/Library/dyld/dyld_shared_cache_arm64e.01`).

`libsandbox` does two jobs (**sourced**: Blazakis 2011 §4; ubrigens 2020):

1. It contains a **modified TinyScheme** interpreter extended with the SBPL vocabulary. Your
   profile is *executed*, not merely parsed — which is why an unknown operation produces a Scheme
   `unbound variable` error with a backtrace (**verified**), and why Apple's profiles can contain
   `(define ...)`, `(if ...)`, `(let ...)` and `(string-append ...)`.
2. It compiles the rules that evaluation produced into an opaque binary form the kernel can
   evaluate cheaply. Path filters become prefix structures, regexes become compiled matchers
   (**sourced**: macinternals.app 2026; Blazakis 2011).

The compiled bytecode is handed to the kernel through `__mac_syscall` with policy string
`"Sandbox"` — syscall number 381 (**sourced**: Blazakis 2011 §5, which reproduces the
`AUE_MAC_SYSCALL` entry from XNU's syscall table).

### `Sandbox.kext` — the enforcer

The kernel extension registers as a **MACF policy module**. XNU's MAC framework exposes hundreds of
hooks (`mpo_vnode_check_open`, `mpo_proc_check_signal`, `mpo_socket_check_bind`,
`mpo_iokit_check_open`, …); every hooked operation on a sandboxed process calls out to each
registered policy, and **any** policy may veto it (**sourced**: macinternals.app 2026; ubrigens
2020; Blazakis 2011 §5.1).

A file open therefore goes:

1. process calls `open("/Library/Foo/bar.txt", O_RDONLY)`
2. BSD layer resolves the path to a vnode
3. `mac_vnode_check_open(cred, vnode, …)` runs
4. MACF iterates policies; Sandbox's callback fires
5. the callback walks the process's compiled rules for a match
6. no match → the profile's default applies; deny → `open` returns `EPERM`

Cost per check is nanoseconds for cached/simple matches, microseconds for complex ones; decisions
are cached per process (**sourced**: macinternals.app 2026, **unverified**).

The open-source side of this is readable:
[`security/mac_framework.h`](https://github.com/apple-oss-distributions/xnu/blob/main/security/mac_framework.h),
[`security/mac_policy.h`](https://github.com/apple-oss-distributions/xnu/blob/main/security/mac_policy.h),
[`security/mac_vfs.c`](https://github.com/apple-oss-distributions/xnu/blob/main/security/mac_vfs.c)
and
[`security/mac_mach.c`](https://github.com/apple-oss-distributions/xnu/blob/main/security/mac_mach.c)
in XNU. `Sandbox.kext` itself is closed.

### `sandboxd` — the reporter

Denials are logged through `sandboxd` into the unified log. In 2011 they went to
`/var/log/system.log`; that file no longer exists and `log stream` is the way to watch them
(**verified** on macOS 27.2; see [08-debugging-and-troubleshooting.md](08-debugging-and-troubleshooting.md)).
Note that `sandboxd(8)` and `sandbox(7)` — both referenced by the `sandbox-exec(1)` man page's
"SEE ALSO" — **no longer ship man pages on macOS 27.2** (**verified**: `man -w sandboxd` returns
nothing).

### `libsystem_secinit` — the App Sandbox bootstrap

For entitlement-based sandboxing, `dyld` initialises the sandbox before the program's entry point
runs, driven by `libsystem_secinit.dylib` (**sourced**: ubrigens 2020, who also published a
[reimplementation of parts of it](https://github.com/0xbf00/libsecinit)). This is the involuntary
path; `sandbox_init()`/`sandbox-exec` is the voluntary one.

---

## Two ways a process ends up sandboxed

| | Legacy interface | App Sandbox |
|---|---|---|
| Trigger | program calls `sandbox_init()`, or a parent runs `sandbox-exec` | `com.apple.security.app-sandbox` entitlement in the code signature |
| Policy source | SBPL text you supply | entitlements + `application.sb` + per-framework `.sb` snippets |
| Who uses it | Apple's own daemons, Chromium, Firefox, Anthropic's `sandbox-runtime`, you | App Store apps (mandatory) and most sandboxed third-party apps |
| Status | **deprecated**, unsupported, still fully functional | the supported path |
| Timing | any point in the process's life; voluntary | before `main()`; involuntary |

**verified**: the deprecation is stated in three places on this machine — the `sandbox-exec(1)` man
page ("The **sandbox-exec** command is **DEPRECATED**"), `sandbox.h` ("This header is deprecated and
may be removed in a future release"), and the availability annotation on the API itself:

```c
API_DEPRECATED("No longer supported", macos(10.5, 10.8), ios(2.0, 6.0), tvos(4.0, 4.0), watchos(1.0, 1.0))
API_UNAVAILABLE(macCatalyst)
int sandbox_init(const char *profile, uint64_t flags, char **errorbuf);
```

Yet the binary works, 611 Apple `.sb` profiles ship with the OS (**verified**: 555 in
`/System/Library/Sandbox/Profiles`, 56 in `/usr/share/sandbox`), and Apple's own header still points
you at the App Sandbox Design Guide rather than removing the mechanism. Deprecation here means
"unsupported and undocumented", not "removed".

---

## What is *not* the enforced policy

A subtle point that matters when auditing (**sourced**: ubrigens 2020):

> Neither the SBPL text you write nor the entitlements an app carries is the actual policy enforced
> at runtime. `libsandbox` compiles a profile out of entitlements + parameters + Apple's base
> profiles, and there is **no supported way to dump the resulting rules in human-readable form**.

For App Store apps the effective profile is generated from `application.sb` (45 KB on this machine,
**verified**) plus per-entitlement fragments plus framework snippets. You can read the inputs; the
output is opaque bytecode. Practical consequences:

* To know what a rule really does, test it — `sandbox-exec` plus `log stream` is the only oracle.
* `(defined? 'some-operation)` lets a single profile work across macOS versions, which is exactly
  what Firefox does (**verified** in
  [`SandboxPolicyContent.h`](https://github.com/mozilla-firefox/firefox/blob/main/security/sandbox/mac/SandboxPolicyContent.h)).
* Tools like `sbutil` can extract and disassemble a compiled profile (**sourced**: macinternals.app
  2026, **unverified** — not present on this machine).

---

## Sandbox extensions: how confined apps still open files

A tight profile would make "File → Open" impossible, so the sandbox supports **dynamic extensions**:
capabilities added to a running process's sandbox at runtime (**sourced**: ubrigens 2020;
macinternals.app 2026).

* The user picks a file in `NSOpenPanel`; the powerbox broker issues an extension for that path.
* The profile then allows reads through the extension rather than through a path rule:
  `(allow file-read* (extension "com.apple.app-sandbox.read"))`.
* Granting *write* uses the class `com.apple.app-sandbox.read-write`.
* A process can also **issue** extensions to others, which is what `file-issue-extension` controls —
  used 607 times across Apple's profiles (**mined**), almost always paired with
  `(extension-class "...")` inside `(require-all ...)`.

Chromium uses this for its Metal shader cache (**verified** in
[`common.sb`](https://github.com/chromium/chromium/blob/main/sandbox/policy/mac/common.sb)):

```scheme
(allow file-issue-extension
  (require-all
    (extension-class "com.apple.app-sandbox.read-write")
    (require-any
      (subpath (string-append dir "/com.apple.metalfe"))
      (subpath (string-append dir "/com.apple.gpuarchiver")))))
```

---

## The helper-process pattern

When a sandboxed app needs something its profile forbids, the usual answer is not to widen the
profile but to move the work to a **separate, differently-sandboxed helper** reached over XPC. The
kernel verifies the helper is signed by the same team (**sourced**: macinternals.app 2026).

Safari is the canonical example: the web-content renderer runs under a brutal profile, while
bookmarks live in a process with a normal one. Chromium and Firefox both build their multi-process
sandboxes the same way, with a different profile per process type
(**verified**: Chromium ships `common.sb` plus per-role profiles; Firefox has
`SandboxPolicyContent.h`, `SandboxPolicyCommon.h` and friends).

---

## Threat model — and its limits

Apple has never published a threat model for the sandbox. The one that can be reconstructed from
their documentation, WWDC sessions and patents (**sourced**: ubrigens 2020) is:

* **Goal**: contain the damage if an app is compromised — "[designed to contain damage to the system
  and the user's data if an app becomes compromised](https://developer.apple.com/library/archive/documentation/Security/Conceptual/AppSandboxDesignGuide/AboutAppSandbox/AboutAppSandbox.html)".
* **Explicitly not** an anti-malware system: it "does not target intentionally malicious software"
  ([WWDC 2011 session 204](https://developer.apple.com/videos/play/wwdc2011/204/)). A malicious app
  can still abuse every permission it legitimately holds.
* **Known weak point**: processes start out *non-sandboxed* and become sandboxed during launch,
  because they "[may not have had an opportunity to compile and prepare a profile to express
  permitted actions](https://patents.google.com/patent/US8635663)". Nothing verifies that an app
  whose metadata says "sandboxed" actually got sandboxed.

For your own use — confining a build script, a CLI agent, an untrusted binary — the relevant model
is simpler and stronger: **you** apply the profile from the outside with `sandbox-exec`, before the
target's code runs, and the target cannot remove it. That is the case where Seatbelt behaves like a
real boundary rather than a speed bump.

---

## Where profiles live

**verified** on macOS 27.2:

| Path | Contents | Count |
|---|---|---|
| `/System/Library/Sandbox/Profiles/` | profiles for Apple's daemons, plus the App Sandbox bases `application.sb`, `appsandbox-common.sb`, `system.sb`, `bsd.sb`, `dyld-support.sb` | 555 `.sb` |
| `/usr/share/sandbox/` | older base profiles, still used by some daemons | 56 `.sb` |
| `/Library/Sandbox/Profiles/` | admin-installed custom profiles | not present by default |
| framework bundles | per-framework `.sb` snippets pulled in when an app links the framework | varies |

Every file in the first two carries Apple's warning:

```
;; WARNING: The sandbox rules in this file currently constitute
;; Apple System Private Interface and are subject to change at any time and
;; without notice. The contents of this file are also auto-generated and not
;; user editable; it may be overwritten at any time.
```

They are readable without disabling SIP (**verified**) and they are the single best reference for
how SBPL is used in anger — which is why the tables in
[04](04-operations-reference.md)/[05](05-filters-reference.md) are derived from parsing all 611 of
them.

Notable sizes (**verified**): `application.sb` 45 KB, `appsandbox-common.sb` 33 KB,
`blastdoor.sb` 19 KB (iMessage attachment parsing), `airlock.sb` 19 KB, `com.apple.WebKit.*`
profiles for Safari's renderer processes.

---

## Further reading inside this directory

* Language and rule semantics → [03-sbpl-language.md](03-sbpl-language.md)
* Which rule wins → [06-rule-ordering-and-precedence.md](06-rule-ordering-and-precedence.md)
* Kernel-level detail from the original reverse-engineering → [legacy/blazakis-the-apple-sandbox-2011.md](legacy/blazakis-the-apple-sandbox-2011.md)
* Per-operation prose descriptions → [legacy/apple-sandbox-guide-v1.0.md](legacy/apple-sandbox-guide-v1.0.md)

# The SBPL language

SBPL — Sandbox Profile Language — is a **Scheme embedded domain-specific language**. `libsandbox`
embeds a modified TinyScheme interpreter, *evaluates* your profile as a program, and compiles
whatever rules the evaluation emitted into kernel bytecode (**sourced**: Blazakis 2011 §4;
ubrigens 2020). Every construct in this document was compiled on macOS 27.2 unless marked.

That has one big practical consequence: **your profile is executable code.** You can define
functions, branch on parameters, and build filter arguments as strings. Apple's own profiles rely on
this — 181 distinct `(define ...)` macros were found across the 611 profiles on this machine
(**mined**).

---

## Profile skeleton

```scheme
(version 1)                 ; mandatory, must be an integer >= 1

(debug deny)                ; optional: log denials

(import "system.sb")        ; optional: pull in a shared base

(define (home-subpath p)    ; optional: helper macros
  (subpath (string-append (param "HOME") p)))

(deny default)              ; the baseline

(allow process-exec)        ; what the process needs to start at all
(allow process-fork)
(allow sysctl-read)
(allow mach-lookup)
(allow file-read*)

(allow file-write*          ; the actual policy
  (subpath (param "PROJECT_DIR"))
  (subpath "/private/tmp"))

(deny file-read*            ; explicit carve-outs, last
  (home-subpath "/.ssh"))
```

---

## Lexical rules

| Syntax | Meaning |
|---|---|
| `; comment` | comment to end of line. Apple's profiles also use `;;` |
| `"text"` | string literal; `\` escapes |
| `#"regex"` | **regex literal** — the `#` prefix is what makes it a pattern rather than a string |
| `#o0644` | octal literal, used by `(file-mode ...)` |
| `#t` / `#f` | booleans. An undefined `(param "X")` evaluates to `#f` |
| `name` | symbol; operation, filter and keyword names are symbols, not strings |
| `name*` | wildcard: the operation and everything below it in the naming hierarchy |

The distinction between `"..."` and `#"..."` is the single most common authoring mistake:

```scheme
(allow file-read* (regex "^/usr/lib/.*"))   ; wrong: a string, not a pattern
(allow file-read* (regex #"^/usr/lib/.*"))  ; right
```

When the pattern has to be computed, build it with `string-append` and escape the interpolated part
with `regex-quote`:

```scheme
(allow file-read* (regex (string-append "^" (regex-quote (param "ROOT")) "/dist/.*$")))
```

Both `regex-quote` and `string-append` are **verified** working.

---

## Directives

### `(version N)` — 1, 2 or 3, and it changes the language

Mandatory and first. Integer only — see the measured table in
[02-sandbox-exec-cli.md](02-sandbox-exec-cli.md#the-version-n-statement). Valid values are **1, 2
and 3**; `(version 4)` fails with `invalid version number 4`.

The version is not cosmetic. Every time `sandbox-exec` compiles a profile, `libsandbox` logs why
(**verified** in the unified log):

```
sandbox-exec[94239] (libsandbox.1.dylib) sandbox compile: using compatibility definitions
                    for version 1 (latest version is 3)
```

So `(version 1)` — what Chromium, Firefox, Anthropic's `sandbox-runtime` and 570 of Apple's own 606
profiles use — is a **compatibility mode**. Apple's distribution (**mined**):

| Version | Profiles | Who uses it |
|---|---|---|
| `(version 1)` | 570 | almost everything, including `application.sb`, `appsandbox-common.sb`, `bsd.sb` |
| `(version 2)` | 22 | `com.apple.CoreGraphics.CGPDFService.sb`, `com.apple.audio.AudioConverterService.Hardened.sb` |
| `(version 3)` | 14 | `blastdoor.sb`, `airlock.sb`, `system.sb`, `dyld-support.sb`, `WindowManager.sb`, `lockdownmoded.sb`, `quicklook-thumbnail-secure.sb`, the `darwin-container-*` and `cryptex-session-*` bases |

The pattern is clear: **v2/v3 are reserved for hardened parsers of untrusted input** — BlastDoor
parses iMessage attachments, Airlock and CGPDFService parse PDFs, QuickLook parses thumbnails.

#### What v2/v3 add: raw syscall gating

At version 1, `process-exec` is enough to let a child `execve()`. At v2/v3 the **BSD syscall layer
itself** is filtered, so the same profile fails (**verified**):

```
$ sandbox-exec -p '(version 3)(allow process-exec)(allow process-exec*)(allow process-fork)
                   (allow file-read*)(allow sysctl-read)(allow mach-lookup)(allow file-map-executable)' \
               /bin/chmod 644 /etc/hosts
exit 71    # execvp() failed: Operation not permitted

# and the log says exactly why:
kernel (Sandbox) Sandbox: sandbox-exec(7951) deny(1) syscall-unix 59      # 59 = execve
kernel (Sandbox) Sandbox: sandbox-exec(7951) deny(1) syscall-unix 338
kernel (Sandbox) Sandbox: sandbox-exec(7951) deny(1) syscall-unix 397
```

To run anything at v3 you must whitelist syscalls by number, which is what `blastdoor.sb` does:

```scheme
(deny syscall-unix (with telemetry) (with message "blastdoor syscall-unix"))
(allow syscall-unix
  (syscall-number
    SYS___disable_threadsignal
    SYS___semwait_signal_nocancel
    SYS_access
    SYS_bsdthread_create
    SYS_connect
    SYS_dup
    SYS_fstat64
    SYS_getattrlist
    SYS_getentropy
    …))

(deny syscall-mach (with telemetry) (with message "blastdoor syscall-mach"))
(allow syscall-mach
  (machtrap-number
    MSC__kernelrpc_mach_port_allocate_trap
    MSC__kernelrpc_mach_port_deallocate_trap
    MSC__kernelrpc_mach_vm_allocate_trap
    …))

(deny syscall-mig (with telemetry) (with message "blastdoor syscall-mig"))
(allow syscall-mig (kernel-mig-routine …))
```

The three syscall operations and their filters (**mined** + **verified**):

| Operation | Filter | Constant namespace |
|---|---|---|
| `syscall-unix` | `(syscall-number N)` | `SYS_*` — BSD syscalls; **466** symbols bound in `libsandbox` |
| `syscall-mach` | `(machtrap-number N)` | `MSC_*` — Mach traps |
| `syscall-mig` | `(kernel-mig-routine N)` | MIG routine numbers |
| `system-mac-syscall` | `(mac-syscall-number N)`, `(mac-policy-name …)` | MAC policy syscall numbers |

`SYS_execve`, `SYS_csrctl` and `SYS_read` all resolve; `SYS_nosuch` gives `unbound variable`
(**verified**). Apple's profiles reference 184 distinct `SYS_*` symbols (**mined**).

BlastDoor goes further and turns some denials into hard kills:

```scheme
(deny syscall-unix (with send-signal SIGKILL)
  (syscall-number …))
```

#### What v2/v3 remove

Measured by compiling the same token set at each version:

| Name | v1 | v2/v3 |
|---|---|---|
| `debug` | macro, works | **`unbound variable`** — `(debug deny)` cannot be used |
| `trace` | accepted | **`unbound variable`** |
| `iokit-open` | operation | **`unbound variable`** — use `iokit-open-service` / `iokit-open-user-client` / `iokit-open*` |
| `file-fsctl` | operation | **`unbound variable`** — use `system-fsctl` |
| `ipc-posix-sem` | operation | **`unbound variable`** — use `ipc-posix-sem-open`, `-create`, `-post`, `-wait`, `-unlink` |
| `ipc-posix-shm` | operation | **`unbound variable`** — use `ipc-posix-shm-read-data`, `-write-create`, `-write-data`, `-write-unlink` |
| `ipc-posix-shm-read-metadata` | operation | **`unbound variable`** |
| `mach-per-user-lookup` | operation | **`unbound variable`** |
| `process-exec`, `process-exec*`, `process*` bare | **`Abort trap: 6`** | compiles normally |
| `from`, `unix` (network-filter aliases) | filter / keyword | **`unbound variable`** |

Filters were probed at all three versions and behaved identically: `subpath`, `literal`, `prefix`,
`path`, `regex`, `vnode-type`, `extension`, `extension-class`, `sysctl-name`,
`sysctl-name-prefix`, `global-name`, `target`, `file-mode`, `xattr`, `control-name`, `remote`,
`local`, `mount-relative-literal`, `home-subpath`, `entitlement`, `require-entitlement` all bind at
v1, v2 and v3. `glob` is unbound at every version.

#### Which version should you write?

**`(version 1)`.**

* It is what 570/606 Apple profiles, Chromium, Firefox and Anthropic's `sandbox-runtime` use.
* It is the only version where `(debug deny)` works, and logging is the single most important thing
  when you are developing a profile.
* At v2/v3 you inherit a syscall allowlist obligation: forget `SYS_execve` and nothing runs. That is
  the right trade for BlastDoor and the wrong one for confining a build script.
* The v1-only compiler crashes (`process-exec*`, bare `require-not`) are avoidable by writing the
  filtered forms — see [08-debugging-and-troubleshooting.md](08-debugging-and-troubleshooting.md).

Choose v2/v3 only when you are writing a hardened parser for untrusted input and you intend to
maintain an explicit syscall allowlist — and copy `blastdoor.sb` when you do.

Rule-ordering semantics were compared across versions and are **identical** where the test could
actually run (v2/v3 could not exec the test child without a syscall allowlist, so only the
`(allow default)`-based case was comparable — it behaved the same). See
[06-rule-ordering-and-precedence.md](06-rule-ordering-and-precedence.md).

### `(allow ...)` / `(deny ...)`

The only two actions. Full anatomy in the next section.

### `(import "file")`

Evaluates another profile in place, so you can build on a shared base.

```scheme
(import "system.sb")                                   ; resolves against Apple's profile dirs
(import "/System/Library/Sandbox/Profiles/system.sb")  ; absolute path also works
```

Both forms **verified**. Unlike `-f`, `import` *does* honour bare-name lookup — Apple's own
`bsd.sb` consists almost entirely of `(import "system.sb")` plus a handful of rules.

`import` is used 1 053 times across Apple's profiles (**mined**). The bases you will see imported:
`system.sb`, `bsd.sb`, `appsandbox-common.sb`, `application.sb`, `dyld-support.sb`.

> Treat anything you import from `/System/Library/Sandbox/Profiles/` as unstable. Every one of those
> files carries: *"Apple System Private Interface and are subject to change at any time and without
> notice … auto-generated and not user editable."* Importing `bsd.sb` is a reasonable way to get a
> sane daemon baseline; depending on its exact contents is not.

### `(debug deny)` / `(debug all)`

Turns on violation logging. Both compile (**verified**). Chromium and Firefox both use
`(debug deny)` gated on a parameter:

```scheme
(if (param-true? enable-logging) (debug deny))
```

`deny` logs denials only. The 2011 guide reports `all` (log every operation) "doesn't seem to work"
— that is still the case; it compiles and produces nothing extra observable (**sourced** + spot
check).

In 2011 denials landed in `/var/log/system.log`. That file is gone; use `log stream` — see
[08-debugging-and-troubleshooting.md](08-debugging-and-troubleshooting.md).

### `(trace "file.sb")` — dead

Accepted by the compiler, and historically it appended auto-generated `allow` rules for every denial
so you could bootstrap a profile. On macOS 27.2 it **writes nothing**: a profile containing
`(trace "/path/tr.sb")` was run, a denial was provoked, and the directory afterwards contained only
the pre-existing file (**verified**). The companion `sandbox-simplify` tool is also gone from
`/usr/bin` (**verified**).

Do not build a workflow on `trace`. The replacement is `log stream` plus iteration — see
[08](08-debugging-and-troubleshooting.md).

### `(with-filter FILTER body ...)`

Scopes an implicit filter over the rules inside, so you do not have to repeat it. Firefox uses it to
restrict which IOKit registry entries a property read may touch:

```scheme
(with-filter (iokit-registry-entry-class "IOService")
  (allow iokit-get-properties
    (iokit-property "housing-color")
    (iokit-property "syscfg-v2-data")))
```

Compiles standalone (**verified**); used 471 times in Apple's profiles (**mined**).

---

## Anatomy of a rule

```
( action  operation...  filter...  modifier? )
```

### One action, many operations

A rule may name several operations at once; the filters apply to all of them. Apple and Chromium
both lean on this:

```scheme
(allow file-read-data file-write-data (literal "/dev/null"))
(allow file-read* file-write-create
  (require-all (vnode-type DIRECTORY) (subpath dir)))
```

**verified** — `(deny file-read-data file-write-data (literal T))` blocked the read.

### Wildcard operations

`*` at the end of a name means "this operation and everything under it":

| Wildcard | Covers |
|---|---|
| `file*` | every `file-…` operation (**verified**: allows `file-write-mode`) |
| `file-read*` | `file-read-data`, `file-read-metadata`, `file-read-xattr`, … |
| `file-write*` | `file-write-create`, `-data`, `-mode`, `-owner`, `-unlink`, … (**verified**) |
| `process-exec*` | `process-exec`, `process-exec-interpreter`, … |
| `iokit-open*` | `iokit-open-service`, `iokit-open-user-client` |
| `ipc-posix-shm-read*` / `ipc-posix-shm-write*` | the read/write shm sub-operations |
| `sysctl*`, `system*`, `mach*`, `network*`, `ipc*`, `nvram*`, `socket-option*`, `syscall*` | their families |

> **Compiler crash.** A bare wildcard **process** operation with no filter aborts `sandbox-exec`
> with `Abort trap: 6` (exit 134), silently:
>
> ```
> $ sandbox-exec -p '(version 1)(allow process-exec*)' /usr/bin/true
> Abort trap: 6
> $ sandbox-exec -p '(version 1)(allow process*)'     /usr/bin/true
> Abort trap: 6
> $ sandbox-exec -p '(version 1)(allow process-exec)' /usr/bin/true
> Abort trap: 6
> ```
>
> `process-exec` needs a filter — `(allow process-exec (path "/bin/ls"))` or the blanket
> `(allow process-exec-interpreter)`. Other families (`file*`, `file-write*`, `mach*`) tolerate a
> bare wildcard. Always give process operations a filter.

### Filters

Zero or more. Multiple filters on one rule are **OR**-ed; use combinators for anything else:

```scheme
(allow file-read*
  (subpath "/usr/lib")            ; OR
  (subpath "/System/Library")     ; OR
  (literal "/private/etc/hosts"))
```

| Combinator | Meaning | Status |
|---|---|---|
| `(require-all a b c)` | AND — every child must match | **verified** |
| `(require-any a b c)` | OR — at least one must match | **verified** |
| `(require-not a)` | NOT — invert | **verified, but only nested** |

> **`require-not` crashes when it is the only filter.** Reproducible:
>
> ```
> (deny file-read-data (require-not (literal "/x/other")))            → Abort trap: 6
> (deny file-read-data (require-all (require-not (literal "/x/other"))
>                                   (subpath "/x")))                  → works correctly
> ```
>
> Always pair it with a positive filter inside `require-all`. That is exactly how Firefox writes it:
> `(allow file-read* (require-all (require-not (home-subpath "/Library")) (require-not (subpath profileDir))))`.
> Verified semantics: with the nested form, reading a path *other* than the excluded one is denied,
> and reading the excluded one is allowed.

There are also entitlement-scoped combinators used by Apple's profiles (**mined**):
`require-entitlement`, `require-target-with-entitlement`, `require-ancestor-with-entitlement`,
`require-responsible-binary-with-entitlement`.

Full filter list and per-operation compatibility: [05-filters-reference.md](05-filters-reference.md).

### Modifiers

Modifiers live inside `(with ...)` and change what happens when the rule fires, not whether it
matches.

```scheme
(allow file-read-data (subpath dir) (with report))
(deny  file-read-data (literal secret) (with no-log))
(deny  file-read-data (literal secret) (with message "blocked by policy"))
(deny  file-read-data (literal secret) (with errno EACCES))
(deny  network-outbound (remote tcp "*:25") (with send-signal SIGKILL))
(allow process-exec (literal helper) (with no-sandbox))
```

All of the above compile (**verified**). Measured details:

| Modifier | Verified behaviour |
|---|---|
| `report` | allowed on `allow`; on `deny` → `exit 65`, `report modifier does not apply to deny action` |
| `no-log` | suppresses the denial log |
| `message "text"` | attaches text to the denial |
| `errno EACCES` | changes the user-visible error: `cat` prints **"Permission denied"** instead of "Operation not permitted" |
| `send-signal SIGKILL` / `SIGFPE` | kills/crashes the process instead of returning an error. Useful for getting a stack trace during development (**sourced**: Apple's own profile comments, quoted in the 2011 guide) |
| `no-sandbox` | `process-exec` only: the child runs **without** inheriting the sandbox. This is an escape hatch — Chromium and Anthropic's `allowAppleEvents` both rely on it, and both warn that it ends code-execution isolation |
| `telemetry`, `telemetry-backtrace`, `no-report`, `no-callout`, `partial-symbolication` | used by Apple's profiles (**mined**: `report` 116, `telemetry` 81, `message` 56, `no-log` 45, `no-report` 37, `no-sandbox` 20, `send-signal` 9) |

`(deny default (with no-log))` is a real idiom — Chromium uses it to keep a deny-all baseline from
flooding the log:

```scheme
(if (param-true? disable-sandbox-denial-logging)
  (deny default (with no-log))
  (deny default))
```

---

## `default` and what `(deny default)` does *not* cover

`default` is a pseudo-operation matching anything no explicit rule matched. Its position in the file
is irrelevant; what matters is that it is the **weakest** rule (see
[06-rule-ordering-and-precedence.md](06-rule-ordering-and-precedence.md)).

If you write no `default` rule at all, the effective default is **deny**:

```
$ sandbox-exec -p '(version 1)' /usr/bin/true
sandbox-exec: execvp() of '/usr/bin/true' failed: Operation not permitted     (exit 71)
```

**verified**.

> **`(deny default)` is not "deny everything".** Firefox's content profile says so in a comment and
> then denies four more families explicitly (**sourced**,
> [`SandboxPolicyContent.h`](https://github.com/mozilla-firefox/firefox/blob/main/security/sandbox/mac/SandboxPolicyContent.h)):
>
> ```scheme
> (moz-deny default)
> ; These are not included in (deny default)
> (moz-deny process-info*)
> (moz-deny nvram*)
> (moz-deny iokit-get-properties)
> (moz-deny file-map-executable)
> ```
>
> `libsandbox` contains the symbols `operations-allowed-by-default` and `restrictive-default`
> (**mined** from the dyld shared cache), which is consistent with a set of operations that stay
> permitted under a plain `deny default`. If you are writing a security-boundary profile, copy
> Firefox and deny those four families explicitly.

Conversely, the widely repeated advice that you **must** `(allow file-map-executable)` or `dyld`
cannot map libraries is not true on macOS 27.2:

> **contradicted.** `/bin/echo hello` ran successfully under
> `(version 1)(deny default)(allow process-exec*)(allow file-read*)(allow sysctl-read)(allow mach-lookup)`
> — no `file-map-executable` rule — and also with an explicit `(deny file-map-executable)` added
> (**verified**). Firefox does grant it alongside `file-read*` for `/System` and `/usr/lib`, and
> grants `(allow file-map-executable (subpath "/private/var/db/oah"))` for Rosetta-translated
> processes, which is the case worth copying.

---

## Parameters

`-D KEY=VALUE` on the command line becomes `(param "KEY")` in the profile. `param` returns a
**string**, or `#f` when the key was not supplied (**verified** — see the error it produces in
[02](02-sandbox-exec-cli.md#-d-keyvalue)).

```bash
sandbox-exec -f agent.sb -D PROJECT_DIR="$(pwd -P)" -D HOME="$HOME" -D LOG=TRUE ./tool
```

```scheme
(define project-dir (param "PROJECT_DIR"))
(define (param-true? key) (string=? (param key) "TRUE"))

(if (param-true? "LOG") (debug deny))

(when (string? (param "EXTRA_CACHE"))
  (allow file-read* (subpath (param "EXTRA_CACHE"))))
```

`when (string? ...)` and `param-true?` are the two idioms Chromium and Firefox use to make a
parameter optional. Always canonicalise paths *before* passing them as parameters
(`pwd -P`, `realpath`); see the path-resolution rules in
[05-filters-reference.md](05-filters-reference.md).

---

## The Scheme layer

All of these were compiled and exercised on macOS 27.2 (**verified**):

| Construct | Example |
|---|---|
| `define` value | `(define cache-dir (param "CACHE"))` |
| `define` function | `(define (home-subpath p) (subpath (string-append (param "HOME") p)))` |
| `lambda` | `((lambda (d) (deny file-read-data (subpath d))) "/private/tmp")` |
| `let` | `(let ((d cache-dir)) (allow file-write* (subpath d)))` |
| `if` | `(if (param-true? "LOG") (debug deny))` |
| `when` / `unless` | `(when (string? (param "X")) (allow …))` / `(unless (param-true? "NO_CACHE") (allow …))` |
| `begin` | `(begin (allow sysctl-read) (allow mach-lookup))` |
| `string-append` | `(string-append (param "HOME") "/.cache")` |
| `string=?`, `string?`, `string->number` | `(string=? should-log "TRUE")`, `(string->number (param "OS_VERSION"))` |
| `string-length`, `substring` | Chromium's `strip-leading-chars` helper |
| `equal?`, `<`, `-` | Chromium's `string-prefix?` helper |
| `regex-quote` | escaping an interpolated path inside a regex |
| `defined?` | `(if (defined? 'iokit-get-properties) (allow …))` |
| `#f` / `#t` | Scheme booleans |

### Feature-detecting across macOS versions

`defined?` is the portable way to use a newer operation without breaking older systems — the
operation name simply is not bound on an older OS, and the rule is skipped:

```scheme
(if (defined? 'iokit-get-properties)
  (allow iokit-get-properties
    (iokit-property "board-id")
    (iokit-property "vendor-id")))
```

Firefox uses exactly this. Chromium instead passes the OS version in as a parameter and compares
numbers:

```scheme
(define os-version (string->number (param "OS_VERSION")))
(if (>= macosVersion 1100)
  (allow mach-lookup (global-name "com.apple.trustd.agent")))
```

### Reusable macro patterns worth stealing

Firefox's conditional deny — one place to turn logging on and off:

```scheme
(define should-log (param "SHOULD_LOG"))
(define (moz-deny feature)
  (if (string=? should-log "TRUE")
    (deny feature)
    (deny feature (with no-log))))

(moz-deny default)
```

Chromium's parameter predicates:

```scheme
(define (param-true? str) (string=? (param str) "TRUE"))
(define (param-defined? str) (string? (param str)))
(define (user-homedir-path subpath) (string-append (param homedir-as-literal) subpath))
```

Apple's own profiles define the same family of path helpers — `home-subpath`, `home-literal`,
`home-regex`, `home-prefix`, `cache-subpath`, `appsupport-subpath` (**mined**; they are macros, not
built-ins, so they only exist in profiles that import Apple's bases).

---

## Structuring a profile

Order matters less than most guides claim, but a consistent layout keeps large profiles auditable.
The convention used by Chromium, Firefox and Apple:

1. `(version 1)`
2. parameters and macros (`define ...`)
3. logging (`(debug deny)`, `(deny default (with no-log))`)
4. **baseline** — `(deny default)` plus the extra families it does not cover
5. **startup minimum** — `process-exec`, `process-fork`, `sysctl-read`, `mach-lookup`, `file-read*`
   for system libraries, `signal (target self)`
6. **policy** — what this program is actually allowed to do
7. **explicit denials last** — sensitive paths, with a comment saying why

Chromium states the reason for step 7 directly in `common.sb`:

```scheme
; Explicit denials. These are already covered by the blanket `(deny default)`,
; but benefit from explanation as to why they're denied.
(deny mach-lookup (global-name "com.apple.cfprefsd.daemon"))
```

Keeping denials last also makes them win under the precedence rules, which is what you want.

---

## Language gotchas, in one place

| Gotcha | Detail |
|---|---|
| `"..."` vs `#"..."` | a regex needs the `#` prefix |
| paths in filters must be physical | `/tmp/x` never matches; use `/private/tmp/x` |
| `(version N)` is mandatory | omitting it fails with `no version specified` |
| bare wildcard process op | `Abort trap: 6` |
| bare `require-not` | `Abort trap: 6` |
| undefined `(param ...)` | becomes `#f`, error surfaces at the consuming filter |
| `glob` is not a matcher | `unbound variable: glob` — use `regex` or `prefix` |
| `(deny default)` is not total | add `process-info*`, `nvram*`, `iokit-get-properties`, `file-map-executable` |
| `trace` is dead | compiles, writes nothing |
| `-n` profiles are dead | `SIGKILL` |
| `-f` needs a path | bare-name lookup only survives inside `(import ...)` |

---

## See also

* Every operation → [04-operations-reference.md](04-operations-reference.md)
* Every filter, and path semantics → [05-filters-reference.md](05-filters-reference.md)
* Which rule wins → [06-rule-ordering-and-precedence.md](06-rule-ordering-and-precedence.md)
* Predicates and the Scheme environment → [07-modifiers-and-predicates.md](07-modifiers-and-predicates.md)
* Complete worked profiles → [09-recipes.md](09-recipes.md)

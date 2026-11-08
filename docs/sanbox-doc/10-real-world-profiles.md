# Real-world profiles

Four production SBPL codebases, what each does differently, and the techniques worth copying. All
excerpts are verbatim from the sources named; anything measured here is marked **verified**.

---

## Apple's own profiles

611 files on this machine (**mined**): 555 in `/System/Library/Sandbox/Profiles/`, 56 in
`/usr/share/sandbox/`. All readable with SIP enabled. All carry the same warning:

```
;; WARNING: The sandbox rules in this file currently constitute
;; Apple System Private Interface and are subject to change at any time and
;; without notice. The contents of this file are also auto-generated and not
;; user editable; it may be overwritten at any time.
```

The dependency chain most daemons follow:

```
your-daemon.sb  →  bsd.sb  →  system.sb  →  dyld-support.sb
App Store app   →  application.sb  →  appsandbox-common.sb  →  system.sb
```

### `bsd.sb` — the daemon baseline, in full

It is only this (**verified**, `/System/Library/Sandbox/Profiles/bsd.sb`):

```scheme
;; OriginatingProject: files
;;
;; common rules for various BSD daemons
;; Copyright (c) 2007-2011 Apple Inc. All Rights reserved.
;;
(version 1)

(debug deny)

(import "system.sb")

;; allow processes to traverse symlinks
(allow file-read-metadata)

(allow file-read-data file-write-data
  (regex
    ; Allow files accessed by system dylibs and frameworks
    #"/\.CFUserTextEncoding$"
    #"^/usr/share/nls/"
    #"^/usr/share/zoneinfo /var/db/timezone/zoneinfo/"
  ))

(allow ipc-posix-shm (ipc-posix-name "apple.shm.notification_center")) ; Libnotify

(allow signal (target self))
```

Three things to take from it:

* `(allow file-read-metadata)` **unfiltered**, with the comment *"allow processes to traverse
  symlinks"*. Path resolution needs `stat` on every component, so a narrow metadata allowance
  breaks symlink traversal in surprising ways.
* `(allow signal (target self))` — a process that cannot signal itself cannot use common libc
  cancellation paths.
* The 2011 guide describes `bsd.sb` as living in `/usr/share/sandbox`. It has moved; the copy there
  is gone (**verified**).

### `system.sb` — the base of everything, and the most instructive file

It is `(version 3)` (**verified**), which is why it can rely on syscall gating. Key idioms:

```scheme
(version 3)

(import "dyld-support.sb")

(unless *import-path*
  (allow mach-bootstrap)
  (allow syscall*))

;;; Allow registration of per-pid services.
(allow mach-register (local-name-prefix ""))

(when (sbpl-version-compatible? 1)
  ;;; Allow lookup of XPC services for backward-compatibility.
  (allow mach-lookup (xpc-service-name-prefix "")))

;;; Allow system processes to trigger auto-mounting of filesystems.
(allow system-automount
       (require-all
         (process-attribute is-platform-binary)
         (process-attribute is-restricted)))

;;; Read access to standard system paths
(allow file-read* file-test-existence
       (subpath "/Library/Apple")
       (subpath "/System")
       (subpath "/usr/lib")
       (subpath "/usr/share"))

;;; AppleInternal
(with-filter (system-attribute apple-internal)
  (allow file-read* file-test-existence file-map-executable
         (subpath "/AppleInternal/Library/Frameworks"))
  (allow sysctl-write
         (sysctl-name "vm.task_no_footprint_for_debug")))        ; MallocStackLogging
```

All four highlighted constructs were probed on this machine (**verified**):

| Construct | What it does | Probe result |
|---|---|---|
| `*import-path*` | bound to the importing file's path; falsy at top level | works — `unless` took the branch |
| `(sbpl-version-compatible? N)` | true when compiling in a mode compatible with version *N* | works — the guarded rule applied |
| `(process-attribute is-platform-binary)` | filter on the *requesting* process's attributes | works inside `require-all` |
| `(with-filter … body)` | scope a filter over several rules | works at rule level; **fails** if placed inside a filter position |

`(sbpl-version-compatible? 1)` is the clean way to write one profile that behaves correctly under
both old and new SBPL versions — better than `(defined? …)` when the difference is semantic rather
than a missing name.

`(allow file-read* file-test-existence …)` also reveals an operation most guides omit:
`file-test-existence` gates `access(2)`-style existence checks separately from reading data.

### `blastdoor.sb` — the reference for hardened parsing

BlastDoor parses iMessage attachments, i.e. attacker-controlled input, in a `(version 3)` profile
that allowlists raw syscalls (**verified**):

```scheme
(version 3)
…
(deny syscall-unix (with telemetry) (with message "blastdoor syscall-unix"))
(allow syscall-unix
    (syscall-number
        SYS___disable_threadsignal
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
        MSC__kernelrpc_mach_vm_allocate_trap
        …))

(deny syscall-unix (with send-signal SIGKILL)
    (syscall-number …))
```

Techniques worth stealing:

* **Default-deny at the syscall layer**, then an explicit allowlist by number.
* `(with message "...")` on every deny, so a violation in the field is self-identifying.
* `(with telemetry)` to route it into Apple's telemetry rather than only the local log.
* `(with send-signal SIGKILL)` for the syscalls that should never be attempted — turning a
  violation into a hard stop instead of a recoverable error.

### `application.sb` — entitlements become rules here

See [11-app-sandbox-and-entitlements.md](11-app-sandbox-and-entitlements.md); it is the file that
turns `com.apple.security.*` into SBPL.

---

## Chromium

`sandbox/policy/mac/common.sb` is the shared base for every Chromium helper process; per-role
profiles build on it. Verbatim excerpts (**sourced**,
[github.com/chromium/chromium](https://github.com/chromium/chromium/blob/main/sandbox/policy/mac/common.sb)):

### Parameters as a typed interface

```scheme
(define (param-true? str) (string=? (param str) "TRUE"))
(define (param-defined? str) (string? (param str)))

(define browser-pid "BROWSER_PID")
(define bundle-id "BUNDLE_ID")
(define homedir-as-literal "USER_HOMEDIR_AS_LITERAL")
(define darwin-user-cache-dir "DARWIN_USER_CACHE_DIR")
(define os-version (string->number (param "OS_VERSION")))
```

The host process passes every one of these with `-D`. Naming each parameter once as a `define` means
a typo becomes an unbound variable at compile time instead of a silently `#f` filter.

### Conditional logging

```scheme
(if (param-true? disable-sandbox-denial-logging)
  (deny default (with no-log))
  (deny default))

(if (param-true? enable-logging) (debug deny))
```

### The narrowest possible self-introspection

```scheme
; Allow sending signals to self - https://crbug.com/20370
(allow signal (target self))

; TODO(rsesek): Lock down `(deny process-info*)`.
(allow process-info-pidinfo (target self))
```

Note the `(target self)` on `process-info-pidinfo` — Chromium grants a process information about
*itself* only, and leaves a TODO acknowledging the broader family is still open.

### A documented OS bug worked around in the profile

```scheme
; A sandbox bug on macOS 11 and 12 causes the sandbox to see any paths within
; the data volume (/System/Volumes/Data) outside of system firm link locations
; (listed in /usr/share/firmlinks) as though they were not on the data volume,
; causing it to deny access to user paths containing the data volume mount point
; as a prefix. This is filed as https://openradar.appspot.com/FB9738355 and
; tracked at https://crbug.com/1266490. …
(define data-volume-root "/System/Volumes/Data/")
(when (string-prefix? (param bundle-path) data-volume-root)
  (define (strip-leading-chars str count)
    (substring str count (string-length str)))
  (allow file-read*
         (subpath (strip-leading-chars (param bundle-path)
                                       (- (string-length data-volume-root) 1)))))
```

This is the best example in the wild of a profile carrying a *reason*, a radar number and a bug
number next to a workaround. Copy the habit.

### Sysctls by name, not wholesale

```scheme
(allow sysctl-read
  (sysctl-name "hw.ncpu")
  (sysctl-name "hw.memsize")
  (sysctl-name "kern.osproductversion")
  (sysctl-name "kern.version")
  …
  (sysctl-name-prefix "hw.optional.")
  (sysctl-name-prefix "hw.perflevel"))
```

`sysctl-name-prefix` is what makes this maintainable; without it you would enumerate every
`hw.optional.*` leaf.

### Sandbox extensions for the Metal shader cache

```scheme
(allow file-issue-extension
  (require-all
    (extension-class "com.apple.app-sandbox.read-write")
    (require-any
      (subpath (string-append dir "/com.apple.metalfe"))
      (subpath (string-append dir "/com.apple.gpuarchiver")))))
```

### Explicit denials as documentation

```scheme
; Explicit denials. These are already covered by the blanket `(deny default)`,
; but benefit from explanation as to why they're denied.
(deny mach-lookup
  ; CFPreferences falls back to in-process access to preference plists, known as
  ; direct mode, when cfprefsd is inaccessible. …
  (global-name "com.apple.cfprefsd.daemon"))
```

---

## Firefox

`security/sandbox/mac/SandboxPolicyContent.h` embeds the profile as a C raw string and generates it
per process (**sourced**,
[github.com/mozilla-firefox/firefox](https://github.com/mozilla-firefox/firefox/blob/main/security/sandbox/mac/SandboxPolicyContent.h)).

### One macro to rule logging

```scheme
(define should-log (param "SHOULD_LOG"))
(define (moz-deny feature)
  (if (string=? should-log "TRUE")
    (deny feature)
    (deny feature (with no-log))))

(moz-deny default)
; These are not included in (deny default)
(moz-deny process-info*)
(moz-deny nvram*)
(moz-deny iokit-get-properties)
(moz-deny file-map-executable)
```

That comment is the origin of the "`(deny default)` is not total" rule in
[03](03-sbpl-language.md#default-and-what-deny-default-does-not-cover).

### Graduated sandbox levels

```scheme
; level 1: global read access permitted, no global write access
(if (string=? sandbox-level-1 "TRUE") (allow file-read*))

; level 2: … no read/write access to ~/Library, no read/write access to $PROFILE …
(if (string=? sandbox-level-2 "TRUE")
  (begin
    (allow file-read* (home-subpath "/Library/Caches/TemporaryItems"))
    (if (string=? hasProfileDir "TRUE")
      (allow file-read* (require-all
        (require-not (home-subpath "/Library"))
        (require-not (subpath profileDir))))
      (allow file-read* (require-not (home-subpath "/Library"))))))
```

Note `require-not` always paired inside `require-all` — the form that does not crash the compiler
(**verified**; a bare `require-not` aborts it).

### Version-portability by feature detection

```scheme
(if (defined? 'iokit-get-properties)
  (allow iokit-get-properties
    (iokit-property "board-id")
    (iokit-property "vendor-id")))
```

and by version number:

```scheme
(define macosVersion (string->number (param "MAC_OS_VERSION")))
(if (>= macosVersion 1100)
  (allow mach-lookup (global-name "com.apple.trustd.agent")))   ; bug 1655655
```

### Home-relative helpers

```scheme
(define (home-regex home-relative-regex)
  (regex (string-append "^" (regex-quote home-path) home-relative-regex)))
(define (home-subpath home-relative-subpath)
  (subpath (string-append home-path home-relative-subpath)))
(define (home-literal home-relative-literal)
  (literal (string-append home-path home-relative-literal)))
```

Apple's profiles define the same three names, plus `home-prefix`, `cache-subpath` and
`appsupport-subpath` (**mined**: 1 763 uses of `home-subpath` across Apple's profiles). Defining
your own is the portable option, since Apple's are macros inside files you do not control.

### Rosetta

```scheme
(if (string=? isRosettaTranslated "TRUE")
  (allow file-map-executable (subpath "/private/var/db/oah")))
```

Translated binaries map from `/private/var/db/oah`; without this they fail to start under a narrow
profile.

---

## Anthropic `sandbox-runtime` (`srt`)

The package Claude Code uses for its Bash sandbox (**sourced**,
[github.com/anthropics/sandbox-runtime](https://github.com/anthropics/sandbox-runtime)). It is the
most complete example of *generating* SBPL from a declarative config.

Architecture: `src/sandbox/macos-sandbox-utils.ts` builds a Seatbelt profile string from the
settings object and invokes `sandbox-exec`. Configuration lives in `~/.srt-settings.json` (or
`--settings`), and can be updated live through `--control-fd`.

| Config | Effect on the profile |
|---|---|
| `filesystem.allowWrite` / `denyWrite` | `(allow file-write* (subpath …))` / `(deny …)`; denyWrite always wins |
| `filesystem.denyRead` / `allowRead` | deny-then-allow, allowRead takes precedence |
| `network.allowedDomains` / `deniedDomains` | enforced by an HTTP/SOCKS proxy, not by SBPL — the profile only permits the loopback proxy port |
| `network.allowUnixSockets` / `allowAllUnixSockets` | `(remote unix-socket (path-literal …))` allowances |
| `allowPty` (default false) | `(allow pseudo-tty)` plus read/write/ioctl on `/dev/ptmx` and `/dev/ttys*` |
| `allowAppleEvents` (default false) | `appleevent-send` + Launch Services open. Documented as ending code-execution isolation, because the launched app runs outside the sandbox |
| `enableWeakerNetworkIsolation` (default false) | allows `com.apple.trustd.agent`, needed by Go CLIs (`gh`, `gcloud`, `terraform`) to validate TLS through a MITM proxy. Documented as a potential exfiltration vector |
| `enableWeakerNestedSandbox` (default false) | relaxes constraints so the sandbox can run inside another sandbox |

Two design decisions worth copying:

* **Settings files are always write-denied**, whatever the user configures, so a sandboxed command
  cannot rewrite the rules confining it.
* **Filesystem paths accept gitignore-style globs** (`*`, `**`, `?`, `[abc]`) which the generator
  translates into SBPL `regex`/`subpath` — because SBPL itself has **no `glob` matcher**
  (**verified**: `unbound variable: glob`).

---

## Techniques, ranked by how much they are worth stealing

| Technique | From | Why |
|---|---|---|
| Comment every denial with the bug/radar number that caused it | Chromium | profiles outlive the memory of why they look like that |
| `moz-deny`-style macro wrapping `with no-log` | Firefox | one switch for "debugging" vs "production" logging |
| `(define key "PARAM_NAME")` for every parameter | Chromium | typos become compile errors |
| Explicit denials that `deny default` already covers | Chromium, Firefox | documentation, and defence if the baseline ever changes |
| `(defined? 'op)` / `(sbpl-version-compatible? N)` guards | Firefox, Apple | one profile, many macOS versions |
| Deny `process-info*`, `nvram*`, `iokit-get-properties`, `file-map-executable` explicitly | Firefox | `(deny default)` does not cover them |
| `(with message "…")` on denials | Apple (blastdoor) | a violation identifies itself in the log |
| Unfiltered `(allow file-read-metadata)` | Apple (bsd.sb) | symlink traversal needs `stat` on every component |
| `sysctl-name-prefix` instead of enumerating leaves | Chromium | maintainable sysctl allowlists |
| Domain allowlist in a proxy, not in SBPL | Anthropic, Chromium | SBPL cannot filter by IP or hostname |
| Always-write-deny on your own config files | Anthropic | stops the confined process editing its own cage |

---

## See also

* The language features these profiles use → [03-sbpl-language.md](03-sbpl-language.md)
* Entitlement-driven profiles → [11-app-sandbox-and-entitlements.md](11-app-sandbox-and-entitlements.md)
* Adapted, tested versions of these patterns → [09-recipes.md](09-recipes.md)

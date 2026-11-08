# What changed since 2011

The two classic references — fG!'s *Apple's Sandbox Guide* v1.0 and Blazakis's *The Apple Sandbox* —
were written against Mac OS X 10.6 Snow Leopard and 10.7 Lion. Everything below is the delta to
macOS 27.2 (build 26B123), measured on 2026-11-08.

If you are reading a pre-2015 tutorial, assume every *path*, *tool* and *logging* instruction in it
is wrong, and most *operation semantics* are still right.

---

## Broke outright

### The `-n` predefined profiles kill your process

2011: `sandbox-exec -n no-internet ping www.google.com` was the documented way to block TCP/IP.

Now: **SIGKILL**, exit 137.

```
$ sandbox-exec -n no-internet /usr/bin/true
bash: sandbox-exec: Killed: 9
```

All five (`no-internet`, `no-network`, `no-write`, `no-write-except-temporary`,
`pure-computation`) behave this way (**verified**). The SDK man page for `sandbox_init(3)` states
why:

> **These profiles must not be used when building against macOS SDK >= 27.0.**
> **Processes opting into them will be killed on attempt to do so.**

`kSBXProfile*` constants in `sandbox_init()` are killed the same way (**verified** by compiling and
running: the child died on signal 9). Write an explicit profile instead — the replacements are in
[02-sandbox-exec-cli.md](02-sandbox-exec-cli.md#-n-profile-name-is-dead).

### `-f` no longer searches the profile directories

2011: *"Either you can use the absolute path to the profile or just the name of the profile, as long
it is located at one of these folders: `/Library/Sandbox/Profiles`,
`/System/Library/Sandbox/Profiles`, `/usr/share/sandbox`."*

Now: all three fail, even though the files exist (**verified**).

```
$ sandbox-exec -f bsd      /usr/bin/true   → sandbox-exec: bsd: No such file or directory
$ sandbox-exec -f system.sb /usr/bin/true  → sandbox-exec: system.sb: No such file or directory
$ sandbox-exec -f airportd /usr/bin/true   → sandbox-exec: airportd: No such file or directory
```

`$ sandbox-exec -f /System/Library/Sandbox/Profiles/bsd.sb …` works. `(import "system.sb")` inside a
profile *still* resolves bare names (**verified**), so the search path exists in `libsandbox` — only
the `-f` flag stopped using it.

### `trace` and `sandbox-simplify` are dead

2011: `(trace "trace.sb")` appended auto-generated allow rules for every denial, and
`sandbox-simplify` reduced them. This was the recommended way to bootstrap a profile.

Now: `(trace …)` compiles and **writes nothing**, even when denials occur (**verified** — a trace
file was declared, a denial provoked, and the directory afterwards contained only the pre-existing
file). `/usr/bin/sandbox-simplify` does not exist (**verified**). At `(version 2)`/`(version 3)` the
`trace` symbol is unbound outright.

Replacement: `log stream --predicate 'sender == "Sandbox"'` plus iteration — see
[08-debugging-and-troubleshooting.md](08-debugging-and-troubleshooting.md).

### Logging moved out of `system.log`, and out of `sandboxd`

2011: *"Logging, by default, is written to `/var/log/system.log`. It is very useful (well,
essential!) to do a `tail -f` to that file."* The log lines were attributed to `sandboxd[PID]`:

```
Sep 2 00:13:12 macbox sandboxd[24486]: cat(24485) deny file-read-data /mach_kernel
```

Now: `/var/log/system.log` does not exist; the **kernel** logs directly to the unified log under
sender `Sandbox`:

```
2026-11-08 18:29:36.321 E  kernel[0:8196c] (Sandbox) Sandbox: cat(94240) deny(1) file-read-data /private/etc/hosts
```

Both predicates that blog posts still recommend capture nothing (**verified**):

| Predicate | Caught a known denial? |
|---|---|
| `sender == "Sandbox"` | **yes** |
| `process == "sandboxd"` | no |
| `subsystem == "com.apple.sandbox"` | no |

The message format also gained a coalescing count — `deny(1)` — and the kernel emits
`N duplicate reports for …` lines when it suppresses repeats.

### Two man pages referenced by `sandbox-exec(1)` no longer exist

`SEE ALSO` still lists `sandbox(7)` and `sandboxd(8)`. Neither has a man page on macOS 27.2
(**verified**: `man -w sandbox.7` and `man -w sandboxd.8` both return nothing).

### `libsandbox` is no longer a file you can inspect

2011-era analyses ran `otool`/IDA over `/usr/lib/libsandbox.1.dylib`. That path no longer exists on
disk — the library lives in the dyld shared cache at
`/System/Volumes/Preboot/Cryptexes/OS/System/Library/dyld/dyld_shared_cache_arm64e.*`, split across
82 subcache files (**verified**). `sandbox-exec` still links it by name:

```
/usr/bin/sandbox-exec:
        /usr/lib/libsandbox.1.dylib
        /usr/lib/libSystem.B.dylib
```

The vocabulary in [04](04-operations-reference.md)/[05](05-filters-reference.md) was recovered by
scanning the subcaches for a known anchor string and dumping the surrounding `__cstring` region
(`tmp/apple-sandbox/mine-libsandbox.py`), then validating every candidate against the real compiler.

---

## Changed semantics

### Rule precedence is not first-match

The 2011 guide states it plainly:

> *"Searching for operations will stop when the first explicit match is hit. This means that a deny
> action followed by an allow action to the same operation and target will never trigger the allow
> action, it will always be denied."*

Measured on macOS 27.2, that is **wrong** — and it is wrong in the direction that causes security
bugs, because a later `allow` *does* override an earlier `deny`:

| Rules, in file order | 2011 guide predicts | Actual |
|---|---|---|
| `deny …(literal T)` then `allow …(literal T)` | DENIED | **ALLOWED** |
| `allow …(literal T)` then `deny …(literal T)` | ALLOWED | **DENIED** |
| `deny …(subpath W)` then `allow …(literal T)` | DENIED | **ALLOWED** |

The real model has three dimensions — operation specificity, filter presence, then position — and is
documented with the full experiment in
[06-rule-ordering-and-precedence.md](06-rule-ordering-and-precedence.md).

### `(deny default)` never meant "deny everything"

Not a change so much as something the old guide did not mention. Firefox's content profile carries
the comment `; These are not included in (deny default)` above explicit denials of `process-info*`,
`nvram*`, `iokit-get-properties` and `file-map-executable` (**sourced**), and `libsandbox` contains
the symbols `operations-allowed-by-default` and `restrictive-default` (**mined**).

### Operation renames and splits

| 2011 name | Status on macOS 27.2 |
|---|---|
| `file-write-mount` | **unbound** — replaced by `file-mount`, `file-mount-update` |
| `file-write-unmount` | **unbound** — replaced by `file-unmount` |
| `system-lcid` | **unbound** |
| `system-write-bootstrap` | **unbound** |
| `ipc-posix-sem` | still bound at v1, **removed at v2/v3** — split into `ipc-posix-sem-open`, `-create`, `-post`, `-wait`, `-unlink` |
| `ipc-posix-shm` | still bound at v1, **removed at v2/v3** — split into `ipc-posix-shm-read-data`, `-write-create`, `-write-data`, `-write-unlink` |
| `iokit-open` | still bound at v1, **removed at v2/v3** — split into `iokit-open-service`, `iokit-open-user-client` |
| `file-fsctl` | still bound at v1, **removed at v2/v3** — use `system-fsctl` |
| `mach-per-user-lookup` | still bound at v1, **removed at v2/v3** |

Everything else in the 2011 Appendix A list still compiles at `(version 1)` (**verified**).

### The 2011 "special hardcoded cases"

The guide lists three behaviours baked into the code:

* *Allow `mach-bootstrap` if `mach-lookup` is ever allowed.*
* *Allow access to `webdavfs_agent` if `file-read*` is always allowed.*
* *Never allow a sandboxed process to open a launchd socket.*

**unverified.** `mach-bootstrap` is still a real operation, and Apple's `system.sb` grants it
conditionally on `*import-path*`, which is consistent with the first claim. The other two were not
re-tested.

---

## Added since 2011

162 operations that did not exist in the 2011 list now compile (**verified**; full list in
[04-operations-reference.md](04-operations-reference.md#added-since-2011-162)). The new families:

| Family | Examples | Why it appeared |
|---|---|---|
| IOKit | `iokit-open-service`, `iokit-open-user-client`, `iokit-get-properties`, `iokit-set-properties`, `iokit-external-method`, `iokit-issue-extension` | GPU, camera, HID and driver access control |
| Process introspection | `process-info-pidinfo`, `-listpids`, `-pidfdinfo`, `-setcontrol`, `-dirtycontrol`, `-rusage`, `-ledger`, `-codesignature`, `-sandbox-container` | `libproc` surface |
| Code signing | `process-codesigning`, `process-legacy-codesigning-{blob,cdhash,identity,status,teamid,text-offset,entitlements-blob,entitlements-der-blob}-{get,set}` | the modern code-signing API |
| Sandbox extensions | `file-issue-extension`, `mach-issue-extension`, `iokit-issue-extension`, `generic-issue-extension`, `consume-extension`, `accept-profile-extension` | App Sandbox file access |
| Raw syscalls | `syscall-unix`, `syscall-mach`, `syscall-mig`, `system-mac-syscall` | v2/v3 syscall allowlists |
| Volumes and quotas | `fs-quota-{get,set*,stat,sync,on,off,set-limits,set-usage}`, `fs-snapshot-{create,delete,mount,revert}`, `fs-info`, `fs-rename` | APFS |
| Sockets | `socket-option-get`, `socket-option-set`, `socket-ioctl` | per-option network control |
| Preferences | `user-preference-read`, `user-preference-write`, `managed-preference-read` | `cfprefsd` mediation |
| Devices | `device-camera`, `device-microphone`, `device*`, `hid-control` | TCC-adjacent capability control |
| Memory / exec | `file-map-executable`, `dynamic-code-generation`, `memorystatus-control` | JIT and W^X policy |
| Notifications | `distributed-notification-post`, `darwin-notification-post` | `distnoted` |
| Misc | `file-test-existence`, `file-clone`, `file-graft`, `file-ungraft`, `file-link`, `file-lock`, `file-mknod`, `file-search`, `appleevent-send`, `lsopen`, `nvram-*`, `qtn-exec`, `pseudo-tty`, `authorization-right-obtain`, `opendirectory-user-modify`, `necp-client-open` | |

### New filters

The 2011 guide documents six filter kinds (`path`, `network`, `file-mode`, `xattr`, `mach`,
`signal`). 157 filter primitives are bound today (**verified**), and Apple's profiles use 195
distinct filter names (**mined**). The ones you will actually want that did not exist in 2011:

| Filter | Purpose |
|---|---|
| `prefix` | plain string prefix (looser than `subpath`) |
| `path` | modern spelling of `literal` |
| `vnode-type` | `REGULAR-FILE`, `DIRECTORY`, `CHARACTER-DEVICE`, … |
| `extension` / `extension-class` | match sandbox extensions |
| `sysctl-name`, `sysctl-name-prefix`, `sysctl-name-regex` | per-sysctl control |
| `global-name-prefix`, `global-name-regex`, `local-name-prefix` | Mach name patterns |
| `xpc-service-name` (+`-prefix`, `-regex`) | XPC service lookup |
| `preference-domain` (+`-prefix`) | `cfprefsd` domains |
| `iokit-user-client-class`, `iokit-registry-entry-class`, `iokit-property`, `iokit-connection` | IOKit matching |
| `ipc-posix-name`, `ipc-posix-name-prefix`, `ipc-posix-name-regex` | POSIX shm/sem names |
| `syscall-number`, `machtrap-number`, `kernel-mig-routine`, `mac-syscall-number` | raw syscall filtering (v2/v3) |
| `signing-identifier`, `ancestor-signing-identifier`, `target-signing-identifier` | code-signing identity |
| `process-attribute`, `system-attribute`, `target-attribute` | predicates such as `is-platform-binary` |
| `socket-domain`, `socket-type`, `socket-protocol`, `socket-option-level`, `socket-option-name` | socket-level matching |
| `nvram-variable` (+`-prefix`) | NVRAM keys |
| `mount-relative-literal`, `mount-relative-regex`, `mount-root-path`, `mount-flag` | mount-relative paths |
| `home-subpath`, `home-literal`, `home-regex`, `home-prefix` | **Apple profile macros**, not built-ins |
| `entitlement`, `require-entitlement` | App Sandbox compile path only — unbound in `sandbox-exec -p` |

Still missing: **`glob`**. `unbound variable: glob` at every version (**verified**). Use `regex` or
`prefix`.

### New modifiers

2011 documented three (`send-signal`, `no-log`, `no-sandbox`). Apple's profiles now use
(**mined**): `report` (116), `telemetry` (81), `message` (56), `no-log` (45), `no-report` (37),
`no-sandbox` (20), `send-signal` (9), `errno`, `telemetry-backtrace`, `partial-symbolication`,
`no-callout`.

`(with errno EACCES)` measurably changes the user-visible error from `Operation not permitted` to
`Permission denied` (**verified**) — useful when a program has a special case for one errno.

### New language-level facilities

| Facility | Source |
|---|---|
| `(with-filter F body …)` — scope a filter over several rules | Firefox, Apple's `system.sb` |
| `(sbpl-version-compatible? N)` — semantic version gate | Apple's `system.sb` |
| `*import-path*` — the importing file's path, falsy at top level | Apple's `system.sb` |
| `(defined? 'op)` — feature detection | Firefox |
| `SYS_*` (466 symbols) and `MSC_*` constants | Apple's v3 profiles |
| `(param "K")` / `-D K=V` | existed in 2011, now used pervasively (2 671 uses) |

### SBPL versions

2011: *"For now there's only version 1 so this should be common to all scripts."*

Now: **1, 2 and 3** are valid; `(version 4)` is rejected. `libsandbox` logs that version 1 is a
compatibility mode:

```
sandbox compile: using compatibility definitions for version 1 (latest version is 3)
```

Apple's own distribution: 570 profiles at v1, 22 at v2, 14 at v3 — and the v2/v3 ones are the
hardened parsers (`blastdoor.sb`, `airlock.sb`, `CGPDFService.sb`,
`quicklook-thumbnail-secure.sb`, `system.sb`). Full analysis in
[03-sbpl-language.md](03-sbpl-language.md#version-1-vs-2-vs-3).

---

## Unchanged

Worth knowing, because it means the old prose is still useful:

* **Architecture.** TinyScheme in `libsandbox`, bytecode to `Sandbox.kext`, TrustedBSD MAC hooks,
  `EPERM` back to the caller. Blazakis's 2011 description still reads correctly.
* **Operation meanings.** What `file-read-metadata` vs `file-read-data` controls, what
  `file-write-setugid` is for, why `file-ioctl` is dangerous — the 2011 guide's per-operation prose
  is still the best available.
* **Symlink resolution.** *"Symlinks are resolved so a path filter to `/tmp/testfile` will fail
  because `/tmp` is a symbolic link to `/private/tmp`"* — still exactly true, and re-measured as a
  2×2 matrix in [05-filters-reference.md](05-filters-reference.md#path-matchers).
* **Network filters cannot express an IP.** *"The only valid input for IP is localhost or `*`,
  meaning that you can only filter by port."* Still enforced, with a clearer error message:
  `host must be * or localhost in network address` (**verified**).
* **Unix sockets are `network-outbound`.** The 2011 guide's
  `(allow network-outbound (remote unix-socket (path-literal "/private/var/run/syslog")))` still
  works, and `(deny file-write* …)` on a socket path still does not block `connect()`.
* **Profiles are immutable once applied**, and children inherit them.

---

## Quick translation table

| 2011 instruction | 2026 equivalent |
|---|---|
| `tail -f /var/log/system.log` | `log stream --style compact --info --predicate 'sender == "Sandbox"'` |
| `sandbox-exec -n no-network cmd` | `sandbox-exec -p '(version 1)(deny default)(allow …)(deny network*)' cmd` |
| `sandbox-exec -f bsd cmd` | `sandbox-exec -f /System/Library/Sandbox/Profiles/bsd.sb cmd` |
| `(trace "trace.sb")` + `sandbox-simplify` | stream the log, add rules by hand |
| `man sandbox` / `man sandboxd` | gone; read `application.sb` and `system.sb` instead |
| IDA over `/usr/lib/libsandbox.1.dylib` | scan the dyld shared cache subcaches, or just probe the compiler |
| "first match wins" | last match wins, unless specificity differs |

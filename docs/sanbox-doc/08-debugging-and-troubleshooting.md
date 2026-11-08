# Debugging and troubleshooting

A denied operation reaches your program as a plain POSIX error — `EPERM` ("Operation not
permitted") or, with `(with errno EACCES)`, `EACCES` ("Permission denied"). Nothing tells it that a
sandbox was involved. All diagnosis therefore happens out-of-band, in the unified log.

---

## Watching denials live

> **contradicted.** The two predicates that circulate in blog posts capture **nothing** on macOS
> 27.2. Measured by triggering a known denial while each stream was running:
>
> | Predicate | Caught the denial? | Lines captured |
> |---|---|---|
> | `sender == "Sandbox"` | **yes** | 8 |
> | `eventMessage CONTAINS "deny"` | yes | 12 |
> | `process == "sandboxd"` | **no** | 1 |
> | `subsystem == "com.apple.sandbox"` | **no** | 1 |
>
> `sandboxd` is not the logging process any more — the kernel logs directly.

Use this:

```bash
log stream --style compact --info --predicate 'sender == "Sandbox"'
```

Narrow it to the process you care about:

```bash
log stream --style compact --info \
  --predicate 'sender == "Sandbox" AND eventMessage CONTAINS "cat"'
```

Or search history instead of streaming:

```bash
log show --last 10m --info --predicate 'sender == "Sandbox"' | grep deny
```

### Reading a denial line

```
2026-11-08 18:29:36.321 E  kernel[0:8196c] (Sandbox) Sandbox: cat(94240) deny(1) file-read-data /private/etc/hosts
└──────── timestamp ────────┘ │  └process┘ │└sender┘ └proc(pid)┘ │    │    └operation┘    └────object────┘
                          level                    action ────────┘    └ count
```

| Field | Meaning |
|---|---|
| `E` | log level. Denials are errors; `Db` lines such as `Sandbox apply: …` are debug-level |
| `kernel[0:…]` | the kernel emits it; the hex is the thread |
| `(Sandbox)` | the log sender — this is what the predicate matches |
| `cat(94240)` | process name and PID |
| `deny(1)` | the action and how many identical reports were coalesced into this line |
| `file-read-data` | the **operation** — this is the name you put in your rule |
| `/private/etc/hosts` | the object. **Note it is already the physical path** |

That last point is the single most useful thing in this document: the log shows the resolved path,
so you can copy it straight into a `(literal …)` or `(subpath …)` filter and it will match. Writing
the symlinked form instead is the most common reason a rule appears to do nothing — see
[05-filters-reference.md](05-filters-reference.md#path-matchers).

### Duplicate coalescing

The kernel suppresses repeats and tells you it did:

```
kernel (Sandbox) 3 duplicate reports for System Policy: com.crowdstrike.falcon.Agent(587) deny(1) system-privilege 1016
kernel (Sandbox) 15 duplicate reports for Sandbox: …
```

So a single line can stand for many events, and the absence of a flood is not evidence that
something was allowed once. The `deny(N)` count on the original line is the per-report tally.

### Logging from inside the profile

```scheme
(version 1)
(debug deny)                     ; log every denial made by this profile
(deny default)
```

`(debug deny)` is **version-1 only** — at `(version 2)`/`(version 3)` the `debug` symbol is unbound
and the profile fails to compile. See
[03-sbpl-language.md](03-sbpl-language.md#version-n--1-2-or-3-and-it-changes-the-language).

Silence the noise you expect, keep the rest:

```scheme
(deny default (with no-log))                                  ; quiet baseline
(deny file-read* (subpath "/private/etc") (with no-log))      ; quiet one rule
```

Tag your own denials so you can find them in a busy log:

```scheme
(deny network-outbound (remote tcp "*:25") (with message "smtp blocked by ci.sb"))
```

Apple's hardened profiles do exactly this, paired with telemetry:

```scheme
(deny syscall-unix (with telemetry) (with message "blastdoor syscall-unix"))
```

### Finding the call site

`send-signal` turns a denial into a crash, which gives you a stack trace instead of a log line —
the technique Apple's own profile comments describe and the 2011 guide quotes:

```scheme
(deny file-read-data (subpath "/private/etc") (with send-signal SIGFPE))
```

The process dies with a floating-point exception at the offending call. Then:

```bash
log show --last 2m --predicate 'eventMessage CONTAINS "sandbox"' --info
```

or inspect the crash report in `~/Library/Logs/DiagnosticReports/`. Use this in development only —
`SIGKILL` is what BlastDoor uses in production, and it makes the failure much harder for the program
to degrade gracefully.

---

## Compiler error catalogue

Every message below was produced on macOS 27.2. `sandbox-exec` exits **65** for all of them except
where noted.

| Message | Cause | Fix |
|---|---|---|
| `unbound variable: <name> at <input string>, line L, column C` + backtrace | the name is not an operation, filter or bound symbol at this `(version N)` | check spelling; check it against [04](04-operations-reference.md)/[05](05-filters-reference.md); remember v2/v3 drop some v1 names |
| `no version specified` | profile does not start with `(version N)` | add `(version 1)` |
| `invalid version number 0` / `-1` / `4` | only 1, 2, 3 exist | use `(version 1)` |
| `version number must be integer (1.5)` | non-integer | use an integer |
| `illegal argument: #<FOREIGN PROCEDURE 0x…>` | you used a **filter** where an operation belongs, e.g. `(allow subpath)` | filters go inside a rule: `(allow file-read* (subpath "/x"))` |
| `illegal argument: #<MACRO>` | you used a macro as an operation | same fix |
| `illegal argument: <name>` | a keyword or attribute predicate used as an operation (`self`, `tcp`, `app-container`, `is-platform-binary`, …) | these belong inside filters such as `(target self)` or `(remote tcp …)` |
| `invalid data type of path filter; expected pattern, got boolean` | a `(param "KEY")` that was never supplied evaluates to `#f` | pass `-D KEY=value`, or guard with `(when (string? (param "KEY")) …)` |
| `report modifier does not apply to deny action` | `(deny … (with report))` | `report` is for `allow`; use `(with message …)` or `(with telemetry)` on a deny |
| `… operation not applicable in this context` | `iokit-external-method`, `iokit-async-external-method`, `iokit-external-trap`, `mach-message-send`, `xpc-message-send` in a plain `-p` profile | these only apply inside a kernel/XPC context; drop them |
| `storage class definition not permitted in this context` | `storage-class-map` outside a storage-class definition | drop it |
| `<file>: No such file or directory` | bad `-f` path — **bare names are not searched** | pass an absolute path |
| `profile not found` | `sandbox_init()` with `SANDBOX_NAMED` and a name that is not a built-in | pass SBPL text with flags `0` |
| *(silent)* exit **134**, `Abort trap: 6` | **compiler crash** — see below | |
| *(silent)* exit **137**, `Killed: 9` | a `-n` predefined profile | these are dead; write an explicit profile |

### The two reproducible compiler crashes

Both are version-1 compatibility-mode artefacts; at `(version 2)`/`(version 3)` the same input
compiles normally.

**1. A bare wildcard process operation.**

```
$ sandbox-exec -p '(version 1)(allow process-exec*)' /usr/bin/true
Abort trap: 6                      # exit 134, nothing on stderr
$ sandbox-exec -p '(version 1)(allow process*)'      /usr/bin/true
Abort trap: 6
$ sandbox-exec -p '(version 1)(allow process-exec)'  /usr/bin/true
Abort trap: 6
```

Give process-exec operations a filter:

```scheme
(allow process-exec (path "/bin/ls"))
(allow process-exec (subpath "/usr/bin"))
```

Note that `(allow file-read*)`, `(allow file-write*)` and `(allow mach-lookup)` are all fine bare —
this is specific to the `process-exec` family.

**2. `require-not` as the only filter.**

```
$ sandbox-exec -p '(version 1)(allow default)(deny file-read-data (require-not (literal "/x/other")))' cat /x/f
Abort trap: 6
```

Pair it with a positive filter inside `require-all`, which is how Firefox writes it and which works
correctly (**verified** — a path other than the excluded one is denied, the excluded one is allowed):

```scheme
(deny file-read-data
  (require-all
    (require-not (literal "/private/etc/hosts"))
    (subpath "/private/etc")))
```

---

## Exit codes as a diagnostic

`sandbox-exec`'s own exit status tells you which stage failed before you read a single log line:

| Exit | Stage | First question to ask |
|---|---|---|
| `0` | everything worked | — |
| `64` | argument parsing | did you forget the command after the profile? |
| `65` | **profile compilation** | read stderr; it names the offending token, line and column |
| `71` | `execvp()` | was it the profile (`Operation not permitted`) or a typo in the path (`No such file or directory`)? |
| `134` | compiler crash | bare `process-exec*`, or a lone `require-not` |
| `137` | `SIGKILL` | you used `-n` |

Fastest possible profile check, without running anything expensive:

```bash
sandbox-exec -f profile.sb /usr/bin/true; echo $?
# 0 or 71 → the profile compiles. 65 or 134 → it does not.
```

---

## The `dyld` trap: `SIGABRT` is not a denial

If your profile starves the dynamic linker, the child dies with `SIGABRT` (exit 134) **before** it
runs a line of its own code. This looks exactly like "the sandbox denied my operation" and sends
you hunting in the wrong place.

Recognise it:

* the child produced no output at all, not even its first line;
* the exit status is 134, or the shell prints `Abort trap: 6`;
* the log shows denials for `/usr/lib/dyld`, `dyld_shared_cache` paths, `/System/Library/Frameworks`
  or `/private/var/db/dyld` rather than for the file you meant to test.

Fix it by granting the startup minimum before tightening anything else:

```scheme
(allow process-exec)
(allow process-fork)
(allow file-read*)                       ; or at minimum the dyld/framework paths below
(allow sysctl-read)
(allow mach-lookup)
(allow signal (target self))
```

Chromium's equivalent, if you would rather enumerate than allow all reads:

```scheme
(allow file-read*
  (subpath "/System/Library/CoreServices/CoreTypes.bundle")
  (subpath "/System/Library/CoreServices/SystemVersion.bundle")
  (subpath "/System/Library/Frameworks")
  (subpath "/System/Library/Preferences/Logging")
  (subpath "/System/Library/PrivateFrameworks")
  (subpath "/usr/lib"))

(allow file-read* file-map-executable
  (subpath "/System/Cryptexes/App")
  (subpath "/System/Cryptexes/OS")
  (subpath "/System/Volumes/Preboot/Cryptexes/App/System")
  (subpath "/System/Volumes/Preboot/Cryptexes/OS"))

(allow file-read-metadata (subpath "/"))     ; "Allow realpath() to work."
```

And for Rosetta-translated binaries, from Firefox:

```scheme
(if (string=? isRosettaTranslated "TRUE")
  (allow file-map-executable (subpath "/private/var/db/oah")))
```

> **contradicted — `file-map-executable` is not usually required.** The widely repeated advice that
> `dyld` cannot map libraries without `(allow file-map-executable)` did not reproduce on macOS 27.2:
> `/bin/echo hello` ran fine under `(version 1)(deny default)(allow process-exec*)(allow file-read*)
> (allow sysctl-read)(allow mach-lookup)`, and also with an explicit `(deny file-map-executable)`
> added. Include it if you are enumerating reads narrowly (Chromium and Firefox both do), but do not
> add it to fix a crash you have not diagnosed.

---

## Benign noise you can ignore

These appear in almost every sandboxed run and are not your bug:

```
Sandbox: cat(94239) deny(1) file-write-data /dev/dtracehelper
Sandbox: …(pid) deny(1) mach-lookup com.apple.cfprefsd.daemon
Sandbox: …(pid) deny(1) file-read-metadata /Library/Preferences/Logging
```

`/dev/dtracehelper` is probed by libSystem on startup; Chromium allows it explicitly as a
character device, Firefox allows read/write/ioctl on it, and most profiles simply let the denial
happen.

---

## Workflow: building a profile from nothing

1. **Start permissive, then narrow.** Begin with `(allow default)` and add `(deny …)` rules for what
   you actually want to block. It is far easier to see what a program touches than to guess what it
   needs.
2. **Stream the log while you exercise the program.**
   ```bash
   log stream --style compact --info --predicate 'sender == "Sandbox"' > denials.txt &
   ```
3. **Flip to deny-by-default.** Once the program has run through its real workload, switch to
   `(deny default)` plus the startup minimum, re-run, and convert each logged denial into an
   `(allow …)` — copying the **physical** path straight out of the log line.
4. **Iterate until quiet.** Repeat step 3 until the log is empty for a full run.
5. **Re-add the security rules last.** Your sensitive-path denials go at the bottom of the file so
   they win on precedence (see
   [06-rule-ordering-and-precedence.md](06-rule-ordering-and-precedence.md)).
6. **Write the test that matters.** For each deny, a one-liner that must fail:
   ```bash
   sandbox-exec -f profile.sb cat ~/.ssh/id_rsa && echo "FAIL: readable" || echo "ok: blocked"
   ```

The 2011 `(trace "file.sb")` directive that used to automate step 3 **is dead**: it compiles, and
writes nothing (**verified**). The companion `sandbox-simplify` tool is also gone from `/usr/bin`.
The log stream is the replacement.

---

## Checklist when a rule seems to do nothing

1. Is the path in the filter the **physical** path? `/tmp` → `/private/tmp`, `/var` →
   `/private/var`, `/etc` → `/private/etc`. Check with `pwd -P` / `realpath`.
2. Is the filter string free of a stray double slash? `$TMPDIR` already ends in `/`, so
   `"$TMPDIR/x"` yields `//x` — which will not match.
3. Did you write `(regex "…")` instead of `(regex #"…")`? A plain string is not a pattern.
4. Is an earlier rule on the **same operation** overriding you? Position decides among equals —
   and a wildcard rule never beats a specific one.
5. Is `(allow default)` present above your deny? It does not matter for precedence (`default` is
   weakest), but it does hide mistakes: test with `(deny default)` too.
6. Is the operation the one you think it is? Unix-socket `connect()` is `network-outbound`, not
   `file-write*`. `ls` on a directory needs `file-read-metadata`; `cat` needs `file-read-data`.
7. Did the process actually run? Exit 134 with no output means `dyld` was starved, not that your
   target operation was denied.
8. Is `(version 1)` present, and are you using a v1-only name (`debug`, `trace`, `iokit-open`) in a
   v2/v3 profile?

---

## See also

* Filter semantics and the path-resolution matrix → [05-filters-reference.md](05-filters-reference.md)
* Precedence → [06-rule-ordering-and-precedence.md](06-rule-ordering-and-precedence.md)
* Exit codes and CLI → [02-sandbox-exec-cli.md](02-sandbox-exec-cli.md)
* Reproduction scripts → `tmp/apple-sandbox/probe-semantics.sh`, `probe-versions.sh`,
  `probe-default-allowed.sh`

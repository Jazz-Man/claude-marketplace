# `sandbox-exec` — command-line reference

Everything below was measured on macOS 27.2 (build 26B123) with SIP **enabled**, on 2026-11-08,
unless marked otherwise.

```
/usr/bin/sandbox-exec          135136 bytes, links libsandbox.1.dylib + libSystem.B.dylib
```

---

## Synopsis

```
sandbox-exec [-f profile-file] [-n profile-name] [-p profile-string] [-D key=value ...]
             command [arguments ...]
```

`sandbox-exec` applies a profile to itself and then `execvp()`s *command*, so the target process
**starts** inside the sandbox and can never have run unsandboxed. This is the property that makes it
useful for confining third-party binaries you do not control.

The man page in full: [legacy/man-sandbox-exec.md](legacy/man-sandbox-exec.md). Its complete
description of the profile language is the sentence *"The **sandbox-exec** command is **DEPRECATED**."*

---

## Options

### `-p profile-string`

Inline profile. The most useful form for testing a single rule.

```bash
sandbox-exec -p '(version 1)(deny default)(allow process-exec)(allow file-read*)' /bin/ls /
```

Quoting: wrap the whole profile in **single** quotes. SBPL uses `"` for strings and `#"` for regex
literals, so double-quoting the profile forces shell escaping of every inner quote and is a common
source of pain.

```bash
sandbox-exec -p "(version 1)(deny file-read-data (regex #\"^/private/tmp/x\$\"))" /bin/cat /tmp/x   # works, ugly
sandbox-exec -p '(version 1)(deny file-read-data (regex #"^/private/tmp/x$"))'   /bin/cat /tmp/x   # prefer this
```

### `-f profile-file`

Profile from a file.

```bash
sandbox-exec -f ./build.sb ./scripts/build.sh
sandbox-exec -f /System/Library/Sandbox/Profiles/bsd.sb /bin/ls
```

> **contradicted — bare-name lookup no longer works.** The 2011 guide says you may pass just the
> profile name "as long as it is located at one of these folders: `/Library/Sandbox/Profiles`,
> `/System/Library/Sandbox/Profiles`, `/usr/share/sandbox`". On macOS 27.2 all three fail:
>
> ```
> $ sandbox-exec -f bsd      /usr/bin/true   → exit 65: sandbox-exec: bsd: No such file or directory
> $ sandbox-exec -f system   /usr/bin/true   → exit 65: sandbox-exec: system: No such file or directory
> $ sandbox-exec -f system.sb /usr/bin/true  → exit 65: sandbox-exec: system.sb: No such file or directory
> $ sandbox-exec -f airportd /usr/bin/true   → exit 65: sandbox-exec: airportd: No such file or directory
> ```
>
> `bsd.sb` and `system.sb` both exist in `/System/Library/Sandbox/Profiles/`. **Pass a path.**
>
> `(import "system.sb")` *inside* a profile still resolves bare names — Apple's own `bsd.sb` relies
> on it, and it works (**verified**). So the search path exists in `libsandbox` for `import`; only
> `-f` stopped using it.

### `-D key=value`

Sets a parameter readable in the profile as `(param "key")`. Repeatable.

```bash
sandbox-exec -f agent.sb -D PROJECT_DIR="$PWD" -D HOME="$HOME" -D TMP="$TMPDIR" ./run.sh
```

**verified** behaviours:

| Case | Result |
|---|---|
| multiple `-D` flags | fine |
| `-D` key never referenced by the profile | fine, silently ignored |
| `(param "KEY")` with no matching `-D` | `exit 65`, `invalid data type of path filter; expected pattern, got boolean` |

That last one is worth memorising: an **undefined parameter evaluates to `#f`**, not to an empty
string, and the failure surfaces at the filter that consumed it — nowhere near the `-D` you forgot.
Guard optional parameters the way Firefox and Chromium do:

```scheme
(when (string? (param "EXTRA_DIR"))
  (allow file-read* (subpath (param "EXTRA_DIR"))))

(define (param-true? key) (string=? (param key) "TRUE"))
(if (param-true? "ENABLE_LOGGING") (debug deny))
```

### `-n profile-name` is dead

Loads one of five built-in profiles. **All of them now kill the process.**

```
$ sandbox-exec -n no-internet /usr/bin/true
bash: sandbox-exec: Killed: 9
exit 137        (= 128 + SIGKILL)
```

Same for `no-network`, `no-write`, `no-write-except-temporary`, `pure-computation` (**verified**).

This is not a bug — it is documented in the SDK's `sandbox_init(3)` man page
([legacy/man-sandbox_init.md](legacy/man-sandbox_init.md)):

> **These profiles must not be used when building against macOS SDK >= 27.0.**
> **Processes opting into them will be killed on attempt to do so.**

Every one of the five constants is additionally marked **DEPRECATED** individually. Write an
explicit profile instead; the equivalents are one or two lines:

| Old `-n` name | Replace with |
|---|---|
| `no-internet` | `(deny network-outbound (remote ip "*:*"))` plus a localhost allowance |
| `no-network` | `(deny network*)` |
| `no-write` | `(deny file-write*)` |
| `no-write-except-temporary` | `(deny file-write*)` + `(allow file-write* (subpath "/private/tmp") (subpath "<_CS_DARWIN_USER_TEMP_DIR>"))` |
| `pure-computation` | `(deny default)` + the minimum for your binary to start |

---

## Exit codes

`0`, `64`, `65` and `71` are `sysexits.h` values; `134` and `137` are signal deaths. All measured:

| Exit | Meaning | Trigger and message |
|---|---|---|
| `0` | success | profile compiled and the command ran |
| `64` | `EX_USAGE` — bad invocation | `Usage: sandbox-exec [options] command [args]`; also `illegal option -- Z` |
| `65` | `EX_DATAERR` — **profile failed to compile** | `unbound variable: nope`, `no version specified`, `version number must be integer (1.5)`, `invalid version number 0`, `illegal argument: …`, `report modifier does not apply to deny action`, `<file>: No such file or directory` |
| `71` | `EX_OSERR` — `execvp()` failed | `execvp() of '/usr/bin/true' failed: Operation not permitted` (profile denied the exec) or `failed: No such file or directory` (bad path) |
| `134` | `SIGABRT` — **compiler crash** | bare wildcard operation with no filter, e.g. `(allow process-exec*)`, `(allow process*)`, `(allow process-exec)`; also `(require-not …)` in some positions. Silent, no stderr |
| `137` | `SIGKILL` | a `-n` predefined profile |

Two of these are traps:

* **`71` is not "the command failed"** — it is "the profile blocked the exec". Exit `71` with
  `(deny default)` is the *expected* result of a correct deny-all test.
* **`71` also covers a plain missing binary.** `execvp() of '/nope/nope' failed: No such file or
  directory` uses the same code. Read the message, not just the number.
* **`134` means your profile is malformed**, not that the sandbox denied something.

A child process that fails *inside* the sandbox returns its own exit status; `sandbox-exec` does not
normalise it. A `cat` blocked by a read denial exits `1` with
`cat: /path: Operation not permitted` (**verified**).

---

## The `(version N)` statement

Mandatory, and the first thing in every profile.

| Input | Result |
|---|---|
| `(version 1)` | accepted — **compatibility mode** |
| `(version 2)` | accepted |
| `(version 3)` | accepted — the current language version |
| `(version 4)` | `exit 65`: `invalid version number 4` |
| `(version 0)` | `exit 65`: `invalid version number 0 at <input string>, line 1, column 10` |
| `(version -1)` | `exit 65`: `invalid version number -1` |
| `(version 1.5)` | `exit 65`: `version number must be integer (1.5)` |
| omitted entirely | `exit 65`: `no version specified` |

The version changes the language, not just a label. Every compile logs this (**verified**):

```
sandbox-exec[94239] (libsandbox.1.dylib) sandbox compile: using compatibility definitions
                    for version 1 (latest version is 3)
```

Write `(version 1)` — it is what Apple's 570 mainstream profiles, Chromium, Firefox and
`sandbox-runtime` all use, and it is the only version where `(debug deny)` works. Versions 2 and 3
add raw-syscall allowlists and drop names such as `debug`, `trace`, `iokit-open` and
`ipc-posix-shm`. Full analysis, with the measured diffs:
[03-sbpl-language.md](03-sbpl-language.md#version-1-vs-2-vs-3).

---

## Invoking from a script or another program

### Wrap a shell pipeline

`sandbox-exec` execs one program, so shell syntax has to go through a shell:

```bash
sandbox-exec -f ci.sb /bin/bash -c 'npm ci && npm test'
```

Remember the shell itself is sandboxed, and so is every child.

### Pass the environment through

`env` is a program like any other and is itself subject to `process-exec`:

```bash
sandbox-exec -f dev.sb /usr/bin/env FOO=bar ./tool
```

### Generate the profile at runtime

This is what every real consumer does — Chromium, Firefox and Anthropic's `sandbox-runtime` all
build the profile string from configuration and hand it to `-p`.

```bash
profile=$(cat <<EOF
(version 1)
(deny default)
(allow process-exec)
(allow process-fork)
(allow sysctl-read)
(allow mach-lookup)
(allow file-read*)
(allow file-write* (subpath "$(pwd -P)"))
EOF
)
sandbox-exec -p "$profile" ./build.sh
```

`$(pwd -P)` matters: filters need **physical** paths, and `$PWD` is frequently a symlinked path.
See [05-filters-reference.md](05-filters-reference.md).

### Do it from C

The API is deprecated but **still functional** — verified by compiling and running against
`MacOSX27.sdk`:

```c
#include <sandbox.h>
#include <stdio.h>
#include <sys/wait.h>
#include <unistd.h>

int main(void) {
    const char *profile = "(version 1)(deny default)(allow process-exec)(allow file-read*)";
    pid_t pid = fork();
    if (pid == 0) {
        char *err = NULL;
        if (sandbox_init(profile, 0, &err) != 0) {
            fprintf(stderr, "sandbox_init: %s\n", err);
            sandbox_free_error(err);
            _exit(2);
        }
        execv("/bin/ls", (char *const[]){"/bin/ls", "/", NULL});
        _exit(1);
    }
    int status = 0;
    waitpid(pid, &status, 0);
    return WIFEXITED(status) ? WEXITSTATUS(status) : 1;
}
```

`sandbox_init()` sandboxes **the calling process**, hence fork-then-init-then-exec.

The `flags` argument, measured:

| Call | Result on macOS 27.2 |
|---|---|
| `sandbox_init(sbpl_text, 0, &err)` | **returns 0** — the string is treated as SBPL source |
| `sandbox_init(sbpl_text, SANDBOX_NAMED, &err)` | returns `-1`, `err` = `"<the whole text>": profile not found` |
| `sandbox_init("no-internet", SANDBOX_NAMED, &err)` | the process is **killed by SIGKILL** before it can report |

So `SANDBOX_NAMED` means "look up a built-in profile by name", and the built-ins are now lethal.
Pass `0` for raw SBPL.

Caveats, from the shipped header ([legacy/sandbox.h](legacy/sandbox.h)):

* The header documents only `SANDBOX_NAMED` and states *flags* "Must be `SANDBOX_NAMED`. All other
  values are reserved." The `0` above is the historical "profile is SBPL text" value; it works, but
  it is undocumented. The `SANDBOX_KEXT` and `SANDBOX_FILTER_*` constants that older code and blog
  posts use are **not** in the macOS 27 SDK header.
* `sandbox_init_with_parameters()` — the variant that would take `-D`-style parameters — has **no
  man page and no declaration** in this SDK (**verified**: `man -w sandbox_init_with_parameters`
  returns nothing; `sandbox.h` declares only `sandbox_init` and `sandbox_free_error`). Parameters are
  therefore reachable only through the `sandbox-exec -D` command line.
* Both functions carry
  `API_DEPRECATED("No longer supported", macos(10.5, 10.8), …)` and `API_UNAVAILABLE(macCatalyst)`.
  Compiling emits `-Wdeprecated-declarations`: *"first deprecated in macOS 10.8 - No longer
  supported"*.
* If the process is already sandboxed, `sandbox_init()` returns an error and the new profile is
  ignored.

Because of this, prefer spawning `sandbox-exec` as a child over linking `libsandbox`.

---

## What `sandbox-exec` does *not* give you

* **No way to inspect the effective profile.** There is no `--dump`, no `--print-profile`. Once
  compiled the rules are opaque bytecode. Your only oracle is running things and reading denials —
  see [08-debugging-and-troubleshooting.md](08-debugging-and-troubleshooting.md).
* **No nested-sandbox support by default.** Applying a second profile inside an existing sandbox
  fails; `sandbox_init()` refuses, and a `sandbox-exec` inside a `sandbox-exec` needs the outer
  profile to permit it. Consumers that need this expose an explicit escape hatch (Anthropic's
  `enableWeakerNestedSandbox`).
* **No IP-level filtering.** The `network-*` filters match protocol and **port** only; the IP field
  accepts `localhost` or `*`. Domain allowlists must be enforced by a proxy — which is exactly the
  design Chromium-adjacent tools and `sandbox-runtime` use (**sourced**: fG! 2011 §5.3.2,
  Anthropic `sandbox-runtime` README).
* **No per-syscall filtering by argument value** beyond what a filter exposes. `syscall-unix` takes
  `(syscall-number N)` and nothing more.

> **contradicted — SIP does not need to be relaxed.** macinternals.app (2026) states
> *"`sandbox-exec` for testing requires SIP-relaxed on modern macOS"*. Every test in this document
> ran with `csrutil status` reporting **System Integrity Protection status: enabled**. Custom
> profiles via `-p` and `-f` work fine; only the `-n` built-ins are killed, and that is an SDK-27
> policy, not SIP.

---

## Quick reference card

```bash
# test one rule
sandbox-exec -p '(version 1)(allow default)(deny file-read-data (literal "/private/tmp/x"))' cat /tmp/x

# deny-everything smoke test (expect exit 71)
sandbox-exec -p '(version 1)(deny default)' /usr/bin/true; echo $?

# run a build confined to the repo
sandbox-exec -D DIR="$(pwd -P)" -p '(version 1)(deny default)
  (allow process-exec)(allow process-fork)(allow sysctl-read)(allow mach-lookup)
  (allow file-read*)(allow file-write* (subpath (param "DIR")))' ./build.sh

# watch what it denies, in another terminal
log stream --predicate 'sender == "Sandbox"' --info --debug

# validate a profile without running anything expensive
sandbox-exec -f profile.sb /usr/bin/true; echo $?    # 0 or 71 = compiles; 65/134 = broken
```

---

## See also

* Profile language → [03-sbpl-language.md](03-sbpl-language.md)
* Operations → [04-operations-reference.md](04-operations-reference.md)
* Filters and path resolution → [05-filters-reference.md](05-filters-reference.md)
* Errors and debugging → [08-debugging-and-troubleshooting.md](08-debugging-and-troubleshooting.md)
* Man pages as shipped → [legacy/man-sandbox-exec.md](legacy/man-sandbox-exec.md),
  [legacy/man-sandbox_init.md](legacy/man-sandbox_init.md), [legacy/sandbox.h](legacy/sandbox.h)

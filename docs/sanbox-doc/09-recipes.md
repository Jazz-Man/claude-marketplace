# Recipes

Every profile here was compiled and exercised on macOS 27.2 (build 26B123) with SIP enabled, and
each one is covered by an automated pass/block assertion in `tmp/apple-sandbox/probe-recipes.sh`
(13/13 passing at the time of writing). Paths are passed as parameters and canonicalised with
`pwd -P` before use — see the warning in
[05-filters-reference.md](05-filters-reference.md#path-matchers).

---

## The startup minimum

Every deny-by-default profile needs this before anything else, or the child dies in `dyld` with
`SIGABRT` and you will spend an hour debugging the wrong thing.

```scheme
(define (startup-minimum)
  (begin
    (allow process-exec
      (subpath "/bin") (subpath "/sbin")
      (subpath "/usr/bin") (subpath "/usr/sbin"))
    (allow process-exec-interpreter)
    (allow process-fork)
    (allow signal (target self))
    (allow sysctl-read)
    (allow mach-lookup)
    (allow ipc-posix-shm*)
    (allow file-read-metadata)
    (allow file-read*
      (subpath "/usr/lib") (subpath "/usr/share")
      (subpath "/bin") (subpath "/sbin")
      (subpath "/System") (subpath "/Library/Apple")
      (subpath "/private/var/db/dyld")
      (subpath "/dev")
      (literal "/private/etc/localtime"))
    (allow file-ioctl (literal "/dev/dtracehelper"))
    (allow file-map-executable (subpath "/System") (subpath "/usr/lib"))))
```

Used below as `(startup-minimum)`. Widen `process-exec` only as far as you must — a profile that
allows executing anything in `/usr/bin` allows a lot.

---

## R1 — deny everything (smoke test)

The fastest way to confirm `sandbox-exec` is enforcing at all.

```scheme
(version 1)
(deny default)
```

```bash
$ sandbox-exec -p '(version 1)(deny default)' /bin/echo hello
sandbox-exec: execvp() of '/bin/echo' failed: Operation not permitted
$ echo $?
71
```

**verified.** Exit 71 here is success: the profile blocked the exec.

---

## R2 — read-only filesystem

Run untrusted code that may read anything but must not persist a single byte.

```scheme
(version 1)
(deny default)
(startup-minimum)
(allow file-read*)
(deny file-write*)
```

```bash
sandbox-exec -f readonly.sb /bin/cat /etc/hosts        # works
sandbox-exec -f readonly.sb /usr/bin/touch ./newfile    # Operation not permitted
```

**verified**: read succeeded, write blocked.

Many tools still work because they only need `/dev/null`, which `deny file-write*` also blocks. If
a tool insists, allow the two devices explicitly:

```scheme
(allow file-write-data (literal "/dev/null") (literal "/dev/zero"))
```

---

## R3 — confined build / CI

Read the whole machine, write only to the project and to temp, no network.

```scheme
(version 1)
(deny default)
(startup-minimum)

(allow file-read*)

(allow file-write*
  (subpath (param "PROJ"))
  (subpath "/private/tmp")
  (subpath "/private/var/folders"))

(deny network*)
```

```bash
sandbox-exec -D PROJ="$(pwd -P)" -f build.sb ./scripts/build.sh
```

**verified**: writing inside the project succeeded, writing outside was blocked, and `curl` failed
with `Could not resolve host` — the normal symptom of `(deny network*)`, because DNS itself has no
route.

> **Granting `/private/var/folders` grants the whole per-user temp area.** That includes every
> `mktemp -d` directory, browser caches, and other processes' scratch space. It is the pragmatic
> choice for build sandboxes (`$TMPDIR` lives there and tooling breaks without it), but do not
> assume a sibling temp directory is outside your boundary. When validating a profile like this,
> put the "must be blocked" path somewhere else entirely — `/private/var/tmp` is a good choice,
> since nothing above grants it.

---

## R4 — credential protection

Everything from R3, plus a hard wall around secrets. Denials go **last** so they win on precedence
([06](06-rule-ordering-and-precedence.md)).

```scheme
(version 1)
(deny default)
(startup-minimum)

(allow file-read*)
(allow file-write* (subpath (param "PROJ")))

(deny file-read*
  (subpath (string-append (param "HOME") "/.ssh"))
  (subpath (string-append (param "HOME") "/.aws"))
  (subpath (string-append (param "HOME") "/.gnupg"))
  (subpath (string-append (param "HOME") "/.config/gh"))
  (literal (string-append (param "HOME") "/.netrc"))
  (regex #"/\.env(\..+)?$")
  (regex #"secrets?\.(ya?ml|json|toml)$"))
```

```bash
sandbox-exec -D PROJ="$(pwd -P)" -D HOME="$HOME" -f guarded.sb ./tool
```

**verified**: project reads worked; reading a path under a denied subpath returned
`Operation not permitted`.

Two things this does *not* cover, because the sandbox cannot see them:

* **Environment variables.** Secrets already in `environ` are readable without touching the
  filesystem. Scrub them in the wrapper before `exec`.
* **Mach services that proxy secrets.** Keychain access goes through
  `com.apple.SecurityServer`; block it explicitly if that matters (see R6).

---

## R5 — network only through a local proxy

Seatbelt can filter by **protocol and port only**. The host field accepts exactly two values:

```
$ sandbox-exec -p '(version 1)(allow default)(allow network-outbound (remote tcp "127.0.0.1:8080"))' true
sandbox-exec: host must be * or localhost in network address
exit 65
```

**verified.** So there is no such thing as an IP allowlist in SBPL. The standard design — used by
Chromium-adjacent tools and by Anthropic's `sandbox-runtime` — is to permit only the loopback port
where your own proxy listens, and enforce the domain allowlist in that proxy:

```scheme
(version 1)
(deny default)
(startup-minimum)
(allow file-read*)
(allow file-write* (subpath (param "PROJ")))

(allow system-socket)
(deny network*)
(allow network-outbound (remote tcp "localhost:8080"))
(allow network-outbound (remote tcp "localhost:8081"))   ; SOCKS5, if you run one

(deny network-outbound (remote unix-socket (path-literal "/private/var/run/docker.sock")))
```

**verified** end to end: with a listener on 127.0.0.1:8080, a sandboxed `curl` to
`http://localhost:8080/` returned **HTTP 200** under exactly this rule.

Export the proxy to the child so ordinary tools use it:

```bash
sandbox-exec -D PROJ="$(pwd -P)" -f proxied.sb /usr/bin/env \
  HTTP_PROXY=http://localhost:8080 \
  HTTPS_PROXY=http://localhost:8080 \
  ALL_PROXY=socks5://localhost:8081 \
  ./fetch.sh
```

Note the last deny: a Unix-domain socket `connect()` is classified as **`network-outbound`**, not as
a file write, so `(deny file-write* (literal "/var/run/docker.sock"))` does not block the Docker
socket. You need `(remote unix-socket (path-literal …))` — and the matcher here must be
`path-literal`, not `literal`.

---

## R6 — untrusted binary containment

For running something you do not trust at all: no network, no view of other processes, no NVRAM, no
IOKit properties, no keychain.

```scheme
(version 1)
(deny default)
(startup-minimum)

(allow file-read*)
(allow file-write* (subpath (param "SCRATCH")))

(deny network*)

(deny file-read*
  (subpath (string-append (param "HOME") "/.ssh"))
  (subpath (string-append (param "HOME") "/Library/Keychains")))

(deny process-info*)          ; not covered by (deny default)
(deny nvram*)                 ; not covered by (deny default)
(deny iokit-get-properties)   ; not covered by (deny default)
(deny file-map-executable)    ; not covered by (deny default)

(deny mach-lookup
  (global-name "com.apple.SecurityServer")
  (global-name "com.apple.cfprefsd.daemon"))
```

**verified**: scratch writes worked; network egress, sensitive reads and outside reads were all
blocked.

The four `deny` lines marked *not covered by `(deny default)`* come straight from Firefox's content
profile, which carries the comment `; These are not included in (deny default)`. Treat them as
mandatory in any profile meant as a security boundary — see
[03-sbpl-language.md](03-sbpl-language.md#default-and-what-deny-default-does-not-cover).

---

## R7 — CLI agent sandbox

The shape used by tools that run an LLM-driven agent's shell commands: write inside the repo and
temp, read broadly, no direct network, no privilege escalation, and never let the agent edit its own
policy.

```scheme
(version 1)
(deny default)
(startup-minimum)

(allow file-read*)

(allow file-write*
  (subpath (param "PROJ"))
  (subpath "/private/tmp")
  (subpath "/private/var/folders"))

; The agent must not be able to rewrite the rules that confine it.
(deny file-write*
  (literal (string-append (param "HOME") "/.claude/settings.json"))
  (subpath (string-append (param "PROJ") "/.claude"))
  (subpath (string-append (param "PROJ") "/.qwen")))

(deny network*)
(allow network-outbound (remote tcp "localhost:8080"))
(allow system-socket)

; No privilege escalation, no kernel knobs, no code injection.
(deny process-info*)
(deny system-privilege)
(deny system-kext-load)
(deny system-kext-unload)
(deny system-mac-syscall)
(deny nvram*)
(deny dynamic-code-generation)
(deny file-write-setugid)
(deny file-write-mode (subpath (param "PROJ")))   ; nothing may become executable-setuid

(deny mach-lookup (global-name "com.apple.SecurityServer"))
```

Denying `file-write-mode` across the project stops a `chmod +s` from planting a setuid binary. If
your build legitimately needs to chmod, narrow that rule to the specific paths instead of removing
it.

> This is the same two-boundary model Anthropic's `sandbox-runtime` implements (filesystem rules plus
> a network proxy), and the reason its settings are always write-denied regardless of user config is
> exactly the escape it prevents: a sandboxed command rewriting the permission rules that confine it.

---

## R8 — a reusable wrapper

Rather than typing `sandbox-exec` everywhere, wrap it. Note `pwd -P` and the `exec`.

```bash
#!/bin/bash
set -euo pipefail

PROFILE="${SANDBOX_PROFILE:-$HOME/.config/sandbox/dev.sb}"

exec /usr/bin/sandbox-exec \
  -f "$PROFILE" \
  -D "PROJ=$(pwd -P)" \
  -D "HOME=$HOME" \
  -D "TMP=$(cd "${TMPDIR:-/tmp}" && pwd -P)" \
  -D "PROXY_PORT=${SANDBOX_PROXY_PORT:-8080}" \
  "$@"
```

```bash
./sbx ./scripts/build.sh
./sbx npm test
```

Validate a profile in CI without running the workload:

```bash
sandbox-exec -f "$PROFILE" /usr/bin/true; echo $?
# 0 or 71 → compiles.  65 → syntax/unknown name.  134 → compiler crash.
```

---

## R9 — per-denial assertions

A profile without tests rots. Each rule that matters gets a one-liner that must fail:

```bash
#!/bin/bash
fail=0
check_blocked() {
  local desc="$1"; shift
  if sandbox-exec -D PROJ="$(pwd -P)" -f dev.sb "$@" >/dev/null 2>&1; then
    echo "FAIL: $desc was allowed"; fail=1
  else
    echo "ok:   $desc blocked"
  fi
}
check_allowed() {
  local desc="$1"; shift
  if sandbox-exec -D PROJ="$(pwd -P)" -f dev.sb "$@" >/dev/null 2>&1; then
    echo "ok:   $desc allowed"
  else
    echo "FAIL: $desc was blocked"; fail=1
  fi
}

check_allowed  "write in project"    /usr/bin/touch ./sandbox-probe
check_blocked  "write in home"       /usr/bin/touch "$HOME/sandbox-probe"
check_blocked  "read ssh key"        /bin/cat "$HOME/.ssh/id_rsa"
check_blocked  "direct network"      /usr/bin/curl -s --max-time 3 https://example.com
rm -f ./sandbox-probe
exit $fail
```

`tmp/apple-sandbox/probe-recipes.sh` is this pattern applied to every recipe above.

---

## Anti-patterns

| Don't | Why | Do instead |
|---|---|---|
| `(subpath "/tmp")` | `/tmp` is a symlink; the filter never matches | `(subpath "/private/tmp")` |
| `(subpath "$TMPDIR/x")` when `$TMPDIR` ends in `/` | produces `//x`, which does not match | strip the trailing slash, canonicalise with `pwd -P` |
| `(regex "^/usr/lib/.*")` | a string is not a pattern | `(regex #"^/usr/lib/.*")` |
| `(allow process-exec*)` bare | compiler abort (`Abort trap: 6`) at version 1 | `(allow process-exec (subpath "/usr/bin"))` |
| `(deny file-read* (require-not …))` | compiler abort at version 1 | wrap in `require-all` with a positive filter |
| `(allow default)` in a security profile | every mistake becomes a hole | `(deny default)` + explicit allows |
| `(deny file-write*)` expecting it to block a Docker socket | socket `connect()` is `network-outbound` | `(deny network-outbound (remote unix-socket (path-literal …)))` |
| `(remote tcp "10.0.0.5:443")` | `host must be * or localhost` | proxy on loopback, filter domains there |
| trusting `(deny default)` to cover `process-info*`, `nvram*`, `iokit-get-properties` | it does not | deny them explicitly |
| `(debug deny)` in a `(version 3)` profile | `debug` is unbound there | use version 1 for profiles you debug |

---

## See also

* Filter catalogue and path rules → [05-filters-reference.md](05-filters-reference.md)
* Why the denials must come last → [06-rule-ordering-and-precedence.md](06-rule-ordering-and-precedence.md)
* Reading the log while you iterate → [08-debugging-and-troubleshooting.md](08-debugging-and-troubleshooting.md)
* How Chromium, Firefox and Anthropic structure theirs → [10-real-world-profiles.md](10-real-world-profiles.md)

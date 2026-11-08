# SBPL attribute predicates, keywords and Scheme layer

Names that the compiler knows but that are **not** operations: attribute predicates used inside filters, keyword atoms consumed by specific filters, and the TinyScheme primitives SBPL is built on. Feeding any of these to `(allow ...)` fails with `illegal argument: <name>`.

> Generated 2026-11-08 from machine probing of `sandbox-exec` on **macOS 27.2 (build 26B123)**
> and from an s-expression parse of the 611 Apple `.sb` profiles on that machine.
> Regenerate with `tmp/apple-sandbox/probe-ops.sh` + `tmp/apple-sandbox/parse-profiles.py`
> + `tmp/apple-sandbox/gen-reference.py`.


## What SBPL actually is

SBPL is not a bespoke parser. `libsandbox` embeds a modified **TinyScheme** interpreter, evaluates the profile as Scheme source, and serialises whatever rules the evaluation produced. Two consequences matter in practice:

1. **A profile is a program.** You can `(define ...)` helper functions, branch on `(param ...)` values and build rule text with `string-append`. Apple's own profiles do this heavily — 181 distinct macros are defined across the profiles on this machine.
2. **Typos are runtime errors, not parse errors.** An unknown operation surfaces as `unbound variable: <name>` with a Scheme backtrace, because the name simply is not bound in the interpreter's global environment.

```bash
$ sandbox-exec -p '(version 1)(deny no-such-operation)' /usr/bin/true
sandbox-exec: unbound variable: no-such-operation at <input string>, line 1, column 18

Backtrace: 
<input string>:1:18:
        no-such-operation
```


## Modifier and keyword atoms

```
absolute
absolute-nonroot
append
at-fd
authority
else
enable-backtraces
enable-state-flag
force
get
get-closure-code
grant
message
message-filter
no-approval-prompt
no-report
no-sandbox
no-storage-class
no-times
performed
put
report
send-signal
telemetry
telemetry-backtrace
```

## Filesystem and volume attributes

```
apfs-authenticated-volume
apfs-enterprise-volume
apfs-preboot-volume
apfs-recovery-volume
apfs-synthetic
disk-image
disk-image-backing-store
disk-image-device
local-filesystem
removable-device
removable-media
root-filesystem
smb-home-mount-dir
snapshot
time-machine-backup
time-machine-device
union-mounted-filesystem
virtual-device
```

## Container and app attributes

```
app-bundle
app-bundle-ancestor
app-bundle-containing-responsible-binary
app-container
app-container-ancestor
app-data-protection
app-data-protection-ancestor
datavault
fileprovider-ancestor
fileprovider-owned
fileprovider-syncroot
home-ancestor
unregistered-app-bundle
```

## Boot, build and system-state attributes

```
apple-internal
carrier-build
darwin-os
default-codesigning
default-sandbox
developer-mode
factory-build
internal-build
internal-strchr
internal-strcmp
platform-binary
private-cloud-os
recovery-os
restore-os
restricted-execution-mode
security-research-device
security-research-device-extended-research-mode
sip-override
sip-protected
sip-protected-device
sip-protected-filesystem
vendor-build
```

## Everything else bound but not an operation

```
application-group
apply
assign-storage-class
assoc
assq
autobox-telemetry
caar
cadar
cadr
call-with-current-continuation
car
cdr
char-downcase
char-upcase
close-input-port
close-output-port
cons
current-environment
current-input-port
current-output-port
display
entitlement-value
errno
error-port
eval
extension-token-is-process-bound
file-extension-token
filter
flatten
followed-symlinks
for-each
gc-verbose
generic-extension-token
gensym
has-multiple-names
import
interaction-environment
iokit-extension-token
ioservice-requires-approval
length
list
list*
load
load-rewind
mach-extension-token
make-closure
make-string
make-vector
map
member
memq
modulo
new-segment
newline
not
oblist
open-input-file
open-input-output-file
open-input-output-string
open-input-string
open-output-file
open-output-string
param
path-ancestors
peek-char
quit
quotient
read
read-char
remainder
require-entitlement
restrictive-default
reverse
rsr-cryptex
sandbox-debug-mode
set-input-port
set-output-port
split-string
string
string-append
string-length
string-ref
substring
trace
traversed-dotdots
user-approval
vector
vector-length
vector-ref
write
write-char
```

## Signal / process target keywords

```
children
initproc
others
pgrp
same-sandbox
self
```

## Network protocol keywords

```
ip4
ip6
network-approval-exempt
tcp
tcp4
tcp6
udp
udp4
udp6
unix
```

## Process / binary attributes (`is-*`)

```
is-address-sanitized
is-adhoc-signed-binary
is-apple-signed-executable
is-autoboxed
is-catalyst-binary
is-datavault-controller
is-initproc
is-installer
is-nvram-privileged
is-platform-binary
is-plugin
is-protoboxed
is-restricted
is-rsr-binary
is-sandboxed
is-sandcastle-constrained
is-system-session-persona
is-thread-sanitized
is-translated-binary
is-unsigned-binary
```

## Macros bound by libsandbox

```
debug
quasiquote
sbpl-message-filter
unless
when
with-filter
with-modifier
```

## Scheme facilities you can rely on in a profile

Observed in Apple's and Chromium's profiles:

```scheme
(version 1)
(define cache-dir (param "DARWIN_USER_CACHE_DIR"))   ; -D KEY=VALUE from sandbox-exec
(define (param-true? s) (string=? (param s) "TRUE"))
(define (home-subpath p) (subpath (string-append (param "HOME") p)))

(if (param-true? "LOG") (debug deny))                 ; conditional directive
(when (string? (param "EXTRA_DIR"))                     ; guard an optional param
  (allow file-read* (subpath (param "EXTRA_DIR"))))
(unless (param-true? "NO_CACHE") (allow file-read* (subpath cache-dir)))
(if (defined? 'iokit-get-properties)                     ; feature-detect an operation
  (allow iokit-get-properties (iokit-property "board-id")))
(let ((d (string-append cache-dir "/sub")))
  (allow file-write-create (subpath d)))
(begin (allow sysctl-read) (allow mach-lookup))
(import "system.sb")                                    ; pull in another profile
(allow file-read* (regex (string-append "^" (regex-quote (param "ROOT")) "/x")))
(with-filter (iokit-registry-entry-class "IOService")   ; scope filters to a block
  (allow iokit-get-properties (iokit-property "housing-color")))
```

`(defined? 'name)` is the portable way to write a profile that must run on several macOS versions: it lets you use newer operations without breaking older systems.


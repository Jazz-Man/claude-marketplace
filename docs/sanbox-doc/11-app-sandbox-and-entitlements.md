# App Sandbox and entitlements

Two different front ends drive the same kernel mechanism. This document covers the one Apple
actually supports, and where the boundary between it and `sandbox-exec` really is.

| | `sandbox-exec` / `sandbox_init` | App Sandbox |
|---|---|---|
| You write | SBPL rules | entitlements (a signed plist) |
| Profile comes from | your text | `application.sb` + `appsandbox-common.sb` + framework snippets, compiled by `libsandbox` |
| Applied by | you, explicitly | `dyld` via `libsystem_secinit`, before `main()` |
| Applies to | any process you launch | apps whose code signature carries `com.apple.security.app-sandbox` |
| Supported | deprecated, undocumented | yes — the App Sandbox Design Guide |
| Mandatory for | nothing | Mac App Store distribution |

**verified**: the two cannot be mixed casually. `(entitlement "…")` is **unbound** in a plain
`sandbox-exec -p` profile:

```
$ sandbox-exec -p '(version 1)(allow default)(entitlement "com.apple.security.device.camera")' true
sandbox-exec: unbound variable: entitlement at <input string>, line 1, column 19
```

Entitlements only exist as a value inside the App Sandbox compilation path, where the AppSandbox
framework injects them (plus the bundle identifier, home directory and other parameters) before
`libsandbox` evaluates `application.sb` (**sourced**: ubrigens 2020).

---

## How an app gets sandboxed

1. The binary's code signature carries entitlements, including `com.apple.security.app-sandbox = true`.
2. At launch, `dyld` hands off to `libsystem_secinit.dylib`, which asks the private `AppSandbox`
   framework to build a profile.
3. `AppSandbox` collects three inputs (**sourced**: ubrigens 2020):
   * **entitlements**, extracted from the code signature;
   * **parameters** — bundle identifier, home directory, container path, OS version;
   * **snippets** — `application.sb` plus a `.sb` file from every linked framework that ships one.
4. `libsandbox` evaluates all of it as Scheme and compiles the resulting rules to bytecode.
5. The bytecode is attached to the process credentials before the entry point runs.

Because entitlements are part of the code signature, adding one after signing invalidates the
signature — which is what makes the mechanism enforceable rather than advisory.

---

## Inspecting an app's entitlements

```bash
codesign -d --entitlements :- /System/Applications/Calculator.app
```

Real output from this machine (**verified**), reformatted:

```xml
<key>com.apple.security.app-sandbox</key>                        <true/>
<key>com.apple.security.files.user-selected.read-write</key>     <true/>
<key>com.apple.security.network.client</key>                     <true/>
<key>com.apple.security.print</key>                              <true/>
<key>com.apple.security.exception.shared-preference.read-only</key>
    <array><string>com.apple.calculator</string></array>
<key>com.apple.security.temporary-exception.files.absolute-path.read-only</key>
    <array><string>/Library/Managed Preferences/</string></array>
<key>com.apple.security.temporary-exception.mach-lookup.global-name</key>
    <array><string>com.apple.managedconfiguration.profiled</string>
           <string>com.apple.ManagedSettingsAgent</string></array>
<key>com.apple.private.coreservices.canmaplsdatabase</key>       <true/>
<key>com.apple.runningboard.terminateprocess</key>               <true/>
<key>file-read-data</key>                                        <true/>
<key>file-write-data</key>                                       <true/>
<key>user-preference-read</key>                                  <true/>
<key>user-preference-write</key>                                 <true/>
```

Three families are visible:

* **Public `com.apple.security.*`** — the documented capabilities you request in Xcode.
* **`…temporary-exception.*` and `…exception.*`** — escape hatches. They exist because the model is
  sometimes too strict; each one names the resource being excepted. Apple's App Store review treats
  them as something to justify.
* **Names that are literally SBPL operations** (`file-read-data`, `user-preference-read`, …). No
  mapping for these exists in the shipped `application.sb` or `appsandbox-common.sb` (**verified** by
  grep), so they are consumed by the AppSandbox framework or the kernel rather than by a profile
  rule. Treat them as private.

For a running process, `ps` and `sandbox_check`-style introspection are not exposed; there is no
supported way to dump the effective compiled profile of another app.

---

## Containers

A sandboxed app's data lives in a per-app container instead of the shared locations:

```
~/Library/Containers/<bundle-id>/Data/
    ├── Documents/
    ├── Library/
    │     ├── Caches/
    │     ├── Preferences/
    │     └── Application Support/
    └── tmp/
```

Inside the container, `~/Documents` and friends resolve to the container's copies, which is why
sandboxed apps appear to have a normal home directory. There are **948** container directories on
this machine (**verified**: `ls ~/Library/Containers | wc -l`).

Related directories:

| Path | Purpose |
|---|---|
| `~/Library/Containers/<id>/Data` | the app container |
| `~/Library/Group Containers/<group>` | shared between apps with the same app-group entitlement |
| `~/Library/Application Support/<id>` | unsandboxed apps; sandboxed apps use the container instead |

Profile code refers to these through parameters rather than hard-coded paths — Apple's
`appsandbox-container-macos` and `appsandbox-container-common` macros (**mined**), and Chromium's
`DARWIN_USER_CACHE_DIR` / `DARWIN_USER_DIR` / `DARWIN_USER_TEMP_DIR` parameters, which come from
`confstr(3)` (`_CS_DARWIN_USER_CACHE_DIR` etc.).

---

## Sandbox extensions

The mechanism that lets a confined app touch something outside its container, at runtime:

| Trigger | Entitlement / mechanism | Effect |
|---|---|---|
| User picks a file in `NSOpenPanel` / `NSSavePanel` | powerbox broker | an extension is issued for that path |
| Security-scoped bookmark | `com.apple.security.files.bookmarks.app-scope` | persistent access to a specific item |
| Collection-scoped bookmark | `com.apple.security.files.bookmarks.collection-scope` | access to a folder's contents |
| Document-scoped bookmark | `com.apple.security.files.bookmarks.document-scope` | access within a document package |
| App group | `com.apple.security.application-groups` | shared group container |
| Downloads folder | `com.apple.security.files.downloads.read-only` / `.read-write` | access to `~/Downloads` |
| User-selected | `com.apple.security.files.user-selected.read-only` / `.read-write` / `.executable` | whatever the user hands you |

In SBPL, an extension is matched by the `extension` / `extension-class` filters rather than by path.
Chromium relies on this for fonts that live in non-standard locations (**sourced**):

```scheme
; Allow read access to paths allowed via sandbox extensions.
; This is needed for fonts in non-standard locations normally
; due to third party font managers. The extensions are
; automatically issued by the font server in response to font API calls.
(allow file-read*
  (subpath "/Library/Fonts")
  (home-subpath "/Library/Fonts")
  (extension "com.apple.app-sandbox.read"))
```

The two extension classes you will see:

* `com.apple.app-sandbox.read` — read-only
* `com.apple.app-sandbox.read-write` — read and write

Issuing an extension to another process is itself a controlled operation:
`file-issue-extension`, `mach-issue-extension`, `iokit-issue-extension`, `generic-issue-extension`,
gated by `(extension-class "…")` inside `(require-all …)`. `file-issue-extension` appears 607 times
across Apple's profiles (**mined**) — it is how a broker process hands access to a helper.

---

## How entitlements become rules

`application.sb` (45 KB, **verified**) is a Scheme program that emits rules conditionally. Real
excerpts:

```scheme
(deny default file-link)

(define entitlement-legacy-names
  '(("com.apple.security.device.microphone" "com.apple.security.microphone")
    ("com.apple.security.device.camera" "com.apple.security.camera")
    ("com.apple.security.personal-information.addressbook"
     "com.apple.security.addressbook")
    ("com.apple.security.personal-information.calendars"
     "com.apple.security.calendars")
    ("com.apple.security.personal-information.location"
     "com.apple.security.location")))
```

That alias table is how Apple renamed entitlements without breaking signed apps — the profile checks
both names.

```scheme
(when (entitlement "com.apple.security.network.server") (network-server))
(when (entitlement "com.apple.security.network.client") (network-client))

(when (entitlement "com.apple.network.multipath-tcp")
      (allow system-socket (socket-domain 39)))

(when (entitlement "com.apple.security.device.camera") (camera))
(when (entitlement "com.apple.security.device.camera") (webkit-camera-support))

(when (or (entitlement "com.apple.security.device.hid")
          (entitlement "com.apple.security.device.usb"))
      (allow iokit-open-user-client
             (iokit-user-client-class "IOHIDLibUserClient")))

(appsandbox-extensions)
(webkit-support)
(webkit-xpc-services)
```

So an entitlement is not a permission in itself — it selects a **macro** that emits a bundle of
rules. `(camera)` pulls in IOKit user clients, Mach lookups for the camera service and the
`device-camera` operation; `(network-client)` emits `network-outbound` plus the DNS and proxy
plumbing.

Those two macros are defined in `appsandbox-common.sb` (**verified**, lines 414 and 428):

```scheme
(define (network-client) …)
(define (network-server) (system-network) (allow network-inbound (local ip)))
```

Note `(local ip)` with no address argument — the bare protocol form, which is the only thing the
network filters allow you to express besides a port. See
[05-filters-reference.md](05-filters-reference.md).

**47** distinct entitlement names are referenced across `application.sb` and
`appsandbox-common.sb` (**mined**), including:

```
com.apple.security.assets.music.read-only          com.apple.security.device.serial
com.apple.security.assets.music.read-write         com.apple.security.device.usb
com.apple.security.device.audio-input              com.apple.security.files.bookmarks.app-scope
com.apple.security.device.bluetooth                com.apple.security.files.downloads.read-only
com.apple.security.device.camera                   com.apple.security.files.user-selected.executable
com.apple.security.device.firewire                 com.apple.security.files.user-selected.read-only
com.apple.security.device.hid                      com.apple.security.network.client
com.apple.security.device.microphone               com.apple.security.network.server
com.apple.security.personal-information.addressbook   com.apple.security.print
com.apple.security.personal-information.calendars     com.apple.developer.networking.networkextension
com.apple.security.personal-information.location      com.apple.private.app-sandbox.unquarantine
```

Read the file directly — it is the closest thing to an entitlement reference that exists:

```bash
less /System/Library/Sandbox/Profiles/application.sb
grep -n 'entitlement "' /System/Library/Sandbox/Profiles/appsandbox-common.sb
```

For the full public list, Jonathan Levin maintains an entitlement database at
<http://newosxbook.com/ent.jl> (**sourced**: ubrigens 2020).

---

## Which one should you use?

| You want to… | Use |
|---|---|
| Ship an app on the Mac App Store | App Sandbox — mandatory, no choice |
| Ship a signed app outside the store and limit its blast radius | App Sandbox (entitlements) |
| Confine a **third-party binary** you do not control | `sandbox-exec` — you cannot add entitlements to someone else's signature |
| Confine your own CLI tool, build script or agent | `sandbox-exec` |
| Confine a process tree for the duration of one command | `sandbox-exec` |
| Write a hardened parser for untrusted input, shipped inside your app | App Sandbox + a helper XPC service, or a `(version 3)` profile if you are Apple |
| Enforce a domain allowlist | either way you need a **proxy** — SBPL cannot filter by host |

The honest summary: **App Sandbox is the supported API; `sandbox-exec` is the mechanism that still
works and is still what Apple itself uses internally.** 570 of Apple's own 606 profiles are
`(version 1)` SBPL files, and Chromium, Firefox and Anthropic's `sandbox-runtime` all generate SBPL
rather than ship entitlements — because they are confining processes they launch, not apps they
sign.

---

## See also

* The SBPL that entitlements expand into → [03-sbpl-language.md](03-sbpl-language.md)
* `application.sb` idioms → [10-real-world-profiles.md](10-real-world-profiles.md)
* Extensions as filters → [05-filters-reference.md](05-filters-reference.md)

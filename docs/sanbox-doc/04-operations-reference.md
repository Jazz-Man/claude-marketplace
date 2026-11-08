# SBPL operations reference

Every operation name that the macOS Seatbelt compiler accepts, verified by feeding each candidate to `sandbox-exec` and reading the error it produces. An operation that compiles with no filter at all is marked **yes**; the two marks below it mean the compiler accepted the name but refused to build a rule from it in a plain `-p` profile.

> Generated 2026-11-08 from machine probing of `sandbox-exec` on **macOS 27.2 (build 26B123)**
> and from an s-expression parse of the 611 Apple `.sb` profiles on that machine.
> Regenerate with `tmp/apple-sandbox/probe-ops.sh` + `tmp/apple-sandbox/parse-profiles.py`
> + `tmp/apple-sandbox/gen-reference.py`.


## How this table was produced

Candidate names were harvested from three places, then each was compiled:

1. the `__cstring` table of `libsandbox.1.dylib`, extracted from the dyld shared cache (`/System/Volumes/Preboot/Cryptexes/OS/System/Library/dyld/dyld_shared_cache_arm64e.01`);
2. every `(name ...)` head occurring in Apple's own `.sb` profiles;
3. the operation list published in the 2011 fG! guide and in current Chromium/Firefox profiles.

```bash
sandbox-exec -p "(version 1)(allow <TOKEN>)" /usr/bin/true
```

| exit | stderr | meaning |
|---|---|---|
| `0` | — | valid operation, profile compiled, command ran |
| `71` | `execvp() … Operation not permitted` | valid operation, profile compiled, implicit deny stopped the exec |
| `65` | `unbound variable: <TOKEN>` | not a known name at all |
| `65` | `illegal argument: #<FOREIGN PROCEDURE …>` | it is a **filter**, not an operation |
| `65` | `illegal argument: #<MACRO>` | it is a **macro**, not an operation |
| `65` | `illegal argument: <TOKEN>` / `<number>` | bound symbol, but an attribute predicate or keyword — not an operation |
| `65` | `… operation not applicable in this context` | valid operation, only meaningful in a kernel/XPC context |
| `134` | (silent, `Abort trap: 6`) | compiler **crash**: wildcard operation with no filter |


**Total verified operations: 217** (of which 207 compile with no filter).

The **v3** column re-compiles the same token under `(version 3)`. `removed` means the name is unbound at v2/v3 — it only exists in version-1 compatibility mode. See [03-sbpl-language.md](03-sbpl-language.md#version-1-vs-2-vs-3).

## Operations by category

### Apple Events

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `appleevent-send` | yes | yes | — | 28 | `appleevent-destination`, `car` |

### Other

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `asr-parser-enter` | yes | yes | — | 4 | — |
| `exception-entitlement` | yes | yes | — | 0 | — |

### Authorization

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `authorization-right-obtain` | yes | yes | — | 71 | `right-name`, `right-name-regex` |

### Boot args

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `boot-arg-set` | yes | yes | — | 0 | — |

### Coalitions

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `coalition-info` | yes | yes | — | 0 | — |

### Sandbox extensions

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `consume-extension` | yes | yes | — | 0 | — |
| `generic-issue-extension` | yes | yes | — | 19 | `extension-class`, `require-all`, `extension-class-prefix`, `extension-class-regex` |

### Notifications

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `darwin-notification-post` | yes | yes | — | 10 | `notification-name` |
| `distributed-notification-post` | yes | yes | — | 103 | — |

### Default action

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `default` | yes | yes | yes | 568 | — |
| `default-message-filter` | context-limited | — | — | 0 | — |

### Devices

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `device*` | yes | yes | — | 0 | — |
| `device-camera` | yes | yes | — | 14 | — |
| `device-microphone` | yes | yes | — | 18 | — |

### Code generation

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `dynamic-code-generation` | yes | yes | — | 385 | — |

### File system

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `file*` | yes | yes | yes | 43 | `subpath`, `regex`, `literal`, `param`, `home-subpath`, `darwin-user-root-subpath`, +7 |
| `file-chroot` | yes | yes | yes | 0 | — |
| `file-clone` | yes | yes | — | 9 | `home-subpath`, `mount-relative-regex`, `extension`, `require-any`, `subpath` |
| `file-fsctl` | yes | **removed** | — | 7 | — |
| `file-graft` | yes | yes | — | 0 | — |
| `file-ioctl` | yes | yes | yes | 56 | `literal`, `regex`, `prefix`, `application-group-regex`, `device-conforms-to`, `container-subpath`, +3 |
| `file-issue-extension` | yes | yes | — | 636 | `extension-class`, `require-all`, `subpath`, `param`, `require-any`, `home-subpath`, +29 |
| `file-link` | yes | yes | — | 25 | `subpath`, `param`, `home-subpath`, `mount-relative-regex`, `container-subpath` |
| `file-lock` | yes | yes | — | 0 | — |
| `file-map-executable` | yes | yes | — | 573 | `subpath`, `literal`, `regex`, `home-subpath`, `path`, `prefix`, +4 |
| `file-mknod` | yes | yes | — | 2 | `application-group-regex`, `container-subpath` |
| `file-mount` | yes | yes | — | 16 | `subpath`, `param`, `application-group-regex`, `container-subpath`, `apply`, `map` |
| `file-mount-update` | yes | yes | — | 0 | — |
| `file-read*` | yes | yes | yes | 2621 | `subpath`, `literal`, `home-subpath`, `param`, `regex`, `extension`, +70 |
| `file-read-data` | yes | yes | yes | 200 | `literal`, `subpath`, `regex`, `home-subpath`, `param`, `string-append`, +15 |
| `file-read-metadata` | yes | yes | yes | 597 | `literal`, `subpath`, `regex`, `home-subpath`, `param`, `home-literal`, +16 |
| `file-read-xattr` | yes | yes | yes | 46 | `xattr`, `xattr-prefix`, `home-subpath`, `subpath`, `xattr-regex`, `literal`, +6 |
| `file-revoke` | yes | yes | yes | 2 | `application-group-regex`, `container-subpath` |
| `file-search` | yes | yes | — | 9 | `subpath`, `application-group-regex`, `container-subpath`, `param` |
| `file-test-existence` | yes | yes | — | 57 | `literal`, `subpath`, `home-literal`, `param`, `apply`, `home-subpath`, +2 |
| `file-ungraft` | yes | yes | — | 0 | — |
| `file-unmount` | yes | yes | — | 16 | `subpath`, `param`, `application-group-regex`, `container-subpath`, `apply`, `map` |
| `file-write*` | yes | yes | yes | 1520 | `subpath`, `param`, `home-subpath`, `regex`, `literal`, `extension`, +57 |
| `file-write-acl` | yes | yes | — | 1 | `extension` |
| `file-write-create` | yes | yes | — | 54 | `literal`, `regex`, `vnode-type`, `require-all`, `string-append`, `param`, +12 |
| `file-write-data` | yes | yes | yes | 61 | `literal`, `home-subpath`, `param`, `string-append`, `regex`, `subpath`, +8 |
| `file-write-finderinfo` | yes | yes | — | 0 | — |
| `file-write-flags` | yes | yes | yes | 4 | `literal`, `string-append`, `param`, `home-subpath`, `regex`, `extension` |
| `file-write-mode` | yes | yes | yes | 10 | `regex`, `literal`, `subpath`, `path`, `home-subpath`, `home-literal`, +1 |
| `file-write-owner` | yes | yes | yes | 7 | `regex`, `subpath`, `literal`, `path`, `home-subpath`, `extension` |
| `file-write-setugid` | yes | yes | yes | 4 | — |
| `file-write-times` | yes | yes | yes | 0 | — |
| `file-write-unlink` | yes | yes | — | 22 | `literal`, `subpath`, `param`, `home-subpath`, `home-regex`, `extension`, +1 |
| `file-write-xattr` | yes | yes | yes | 32 | `xattr`, `xattr-prefix`, `xattr-regex`, `require-all`, `regex`, `require-any`, +3 |

### File system (volume / quota / snapshot)

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `fs-info` | yes | yes | — | 0 | — |
| `fs-quota*` | yes | yes | — | 0 | — |
| `fs-quota-get` | yes | yes | — | 0 | — |
| `fs-quota-off` | yes | yes | — | 0 | — |
| `fs-quota-on` | yes | yes | — | 0 | — |
| `fs-quota-set*` | yes | yes | — | 0 | — |
| `fs-quota-set-limits` | yes | yes | — | 0 | — |
| `fs-quota-set-usage` | yes | yes | — | 0 | — |
| `fs-quota-stat` | yes | yes | — | 0 | — |
| `fs-quota-sync` | yes | yes | — | 0 | — |
| `fs-rename` | yes | yes | — | 0 | — |
| `fs-snapshot*` | yes | yes | — | 0 | — |
| `fs-snapshot-create` | yes | yes | — | 0 | — |
| `fs-snapshot-delete` | yes | yes | — | 0 | — |
| `fs-snapshot-mount` | yes | yes | — | 0 | — |
| `fs-snapshot-revert` | yes | yes | — | 0 | — |

### HID

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `hid-control` | yes | yes | — | 3 | — |

### IOKit

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `iokit*` | yes | yes | — | 3 | — |
| `iokit-async-external-method` | context-limited | — | — | 0 | — |
| `iokit-external-method` | context-limited | — | — | 0 | — |
| `iokit-external-trap` | context-limited | — | — | 0 | — |
| `iokit-get-properties` | yes | yes | — | 409 | `iokit-property`, `iokit-registry-entry-class` |
| `iokit-issue-extension` | yes | yes | — | 6 | `extension-class` |
| `iokit-open` | yes | **removed** | — | 260 | `iokit-user-client-class`, `iokit-registry-entry-class`, `iokit-user-client-class-regex`, `iokit-registry-entry-class-prefix`, `extension`, `iokit-connection`, +1 |
| `iokit-open*` | yes | yes | — | 4 | `iokit-user-client-class` |
| `iokit-open-service` | yes | yes | — | 36 | `iokit-registry-entry-class`, `iokit-user-client-class`, `iokit-registry-entry-class-prefix`, `iokit-connection` |
| `iokit-open-user-client` | yes | yes | — | 129 | `iokit-user-client-class`, `deny`, `allow`, `iokit-method-number`, `apply-message-filter`, `iokit-connection`, +4 |
| `iokit-set-properties` | yes | yes | — | 67 | `iokit-property`, `iokit-user-client-class`, `extension`, `iokit-property-prefix`, `require-all`, `iokit-connection`, +1 |

### IPC (POSIX & SysV)

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `ipc*` | yes | yes | yes | 0 | — |
| `ipc-posix*` | yes | yes | yes | 9 | `ipc-posix-name-prefix`, `string-append`, `ipc-posix-name` |
| `ipc-posix-sem` | yes | **removed** | yes | 7 | `ipc-posix-name`, `ipc-posix-name-prefix`, `semaphore-owner` |
| `ipc-posix-sem*` | yes | yes | — | 1 | `ipc-posix-name` |
| `ipc-posix-sem-create` | yes | yes | — | 2 | `ipc-posix-name`, `ipc-posix-name-prefix` |
| `ipc-posix-sem-open` | yes | yes | — | 2 | `ipc-posix-name`, `ipc-posix-name-prefix` |
| `ipc-posix-sem-post` | yes | yes | — | 1 | `ipc-posix-name-prefix` |
| `ipc-posix-sem-unlink` | yes | yes | — | 1 | `ipc-posix-name-prefix` |
| `ipc-posix-sem-wait` | yes | yes | — | 1 | `ipc-posix-name-prefix` |
| `ipc-posix-shm` | yes | **removed** | yes | 69 | `ipc-posix-name`, `ipc-posix-name-regex`, `ipc-posix-name-prefix` |
| `ipc-posix-shm*` | yes | yes | — | 13 | `ipc-posix-name`, `ipc-posix-name-prefix`, `ipc-posix-name-regex`, `param` |
| `ipc-posix-shm-read*` | yes | yes | — | 78 | `ipc-posix-name`, `ipc-posix-name-regex`, `ipc-posix-name-prefix` |
| `ipc-posix-shm-read-data` | yes | yes | — | 125 | `ipc-posix-name`, `ipc-posix-name-regex`, `ipc-posix-name-prefix`, `global-name` |
| `ipc-posix-shm-read-metadata` | yes | **removed** | — | 8 | `ipc-posix-name-regex` |
| `ipc-posix-shm-write*` | yes | yes | — | 18 | `ipc-posix-name` |
| `ipc-posix-shm-write-create` | yes | yes | — | 68 | `ipc-posix-name`, `ipc-posix-name-regex`, `global-name` |
| `ipc-posix-shm-write-data` | yes | yes | — | 130 | `ipc-posix-name`, `ipc-posix-name-regex`, `ipc-posix-name-prefix`, `global-name` |
| `ipc-posix-shm-write-unlink` | yes | yes | — | 5 | `ipc-posix-name-regex` |
| `ipc-sysv*` | yes | yes | yes | 0 | — |
| `ipc-sysv-msg` | yes | yes | yes | 0 | — |
| `ipc-sysv-sem` | yes | yes | yes | 0 | — |
| `ipc-sysv-shm` | yes | yes | yes | 0 | — |

### In-system programming

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `isp-command-send` | yes | yes | — | 0 | — |

### Launchd jobs

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `job-creation` | yes | yes | yes | 11 | `regex` |

### Launch Services

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `lsopen` | yes | yes | — | 81 | — |

### Mach IPC

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `mach*` | yes | yes | yes | 0 | — |
| `mach-bootstrap` | yes | yes | yes | 8 | `with-filter`, `state-flag`, `deny`, `apply-message-filter`, `require-not`, `allow`, +1 |
| `mach-cross-domain-lookup` | yes | yes | — | 1 | — |
| `mach-derive-port` | yes | yes | — | 0 | — |
| `mach-host*` | yes | yes | — | 0 | — |
| `mach-host-exception-port-set` | yes | yes | — | 0 | — |
| `mach-host-special-port-set` | yes | yes | — | 0 | — |
| `mach-issue-extension` | yes | yes | — | 18 | `extension-class`, `global-name`, `require-all`, `require-any` |
| `mach-lookup` | yes | yes | yes | 1180 | `global-name`, `xpc-service-name`, `local-name`, `global-name-regex`, `global-name-prefix`, `xpc-service-name-prefix`, +6 |
| `mach-message-send` | context-limited | — | — | 0 | — |
| `mach-per-user-lookup` | yes | **removed** | yes | 20 | — |
| `mach-priv*` | yes | yes | yes | 0 | — |
| `mach-priv-host-port` | yes | yes | yes | 290 | `subpath` |
| `mach-priv-task-port` | yes | yes | yes | 0 | — |
| `mach-register` | yes | yes | — | 78 | `global-name`, `global-name-prefix`, `string-append`, `param`, `local-name-prefix`, `local-name`, +1 |
| `mach-task*` | yes | yes | — | 0 | — |
| `mach-task-exception-port-set` | yes | yes | — | 0 | — |
| `mach-task-inspect` | yes | yes | — | 0 | — |
| `mach-task-name` | yes | yes | yes | 31 | `target` |
| `mach-task-read` | yes | yes | — | 2 | `target` |
| `mach-task-special-port*` | yes | yes | — | 1 | — |
| `mach-task-special-port-get` | yes | yes | — | 0 | — |
| `mach-task-special-port-set` | yes | yes | — | 0 | — |

### Preferences

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `managed-preference-read` | yes | yes | — | 16 | `preference-domain`, `preference-domain-prefix` |
| `user-preference*` | yes | yes | — | 53 | `preference-domain`, `preference-domain-prefix`, `preference-domain-regex` |
| `user-preference-read` | yes | yes | — | 923 | `preference-domain`, `preference-domain-prefix`, `literal`, `require-all`, `process-attribute`, `regex`, +1 |
| `user-preference-write` | yes | yes | — | 467 | `preference-domain`, `preference-domain-prefix`, `literal`, `regex` |

### Network extension control

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `necp-client-open` | yes | yes | — | 3 | — |

### Network

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `network*` | yes | yes | yes | 21 | `local`, `remote`, `extension`, `param`, `home-subpath`, `literal` |
| `network-bind` | yes | yes | yes | 32 | `local`, `application-group-regex`, `resolving-subpath`, `param`, `remote`, `literal`, +1 |
| `network-inbound` | yes | yes | yes | 44 | `local`, `remote`, `literal`, `container-subpath`, `socket-domain`, `subpath`, +2 |
| `network-outbound` | yes | yes | yes | 275 | `remote`, `literal`, `control-name`, `subpath`, `path-literal`, `path`, +12 |

### NVRAM

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `nvram*` | yes | yes | — | 400 | `nvram-variable` |
| `nvram-delete` | yes | yes | — | 3 | `nvram-variable-prefix`, `nvram-variable` |
| `nvram-get` | yes | yes | — | 47 | `nvram-variable`, `nvram-variable-prefix` |
| `nvram-set` | yes | yes | — | 6 | `nvram-variable` |

### Directory services

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `opendirectory-user-modify` | yes | yes | — | 0 | — |

### Process

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `process*` | aborts without filter | yes | yes | 0 | — |
| `process-codesigning` | yes | yes | — | 1 | `codesigning-operation` |
| `process-exec` | aborts without filter | yes | yes | 73 | `literal`, `subpath`, `home-subpath`, `param`, `path`, `string-append` |
| `process-exec*` | aborts without filter | yes | — | 24 | `subpath`, `literal`, `path`, `home-subpath` |
| `process-exec-interpreter` | yes | yes | — | 1 | `subpath` |
| `process-exec-update-label` | yes | yes | — | 0 | — |
| `process-fork` | yes | yes | yes | 48 | — |
| `process-info*` | yes | yes | — | 785 | `target` |
| `process-info-codesignature` | yes | yes | — | 363 | `target`, `target-signing-identifier` |
| `process-info-dirtycontrol` | yes | yes | — | 43 | `target` |
| `process-info-ledger` | yes | yes | — | 2 | `target` |
| `process-info-listpids` | yes | yes | — | 8 | — |
| `process-info-pidfdinfo` | yes | yes | — | 7 | `target` |
| `process-info-pidfileportinfo` | yes | yes | — | 4 | `target` |
| `process-info-pidinfo` | yes | yes | — | 155 | `target` |
| `process-info-rusage` | yes | yes | — | 8 | `target` |
| `process-info-sandbox-container` | yes | yes | — | 0 | — |
| `process-info-setcontrol` | yes | yes | — | 13 | `target` |
| `process-iopolicy*` | yes | yes | — | 0 | — |
| `process-iopolicy-get` | yes | yes | — | 0 | — |
| `process-iopolicy-set` | yes | yes | — | 0 | — |
| `process-legacy-codesigning*` | yes | yes | — | 0 | — |
| `process-legacy-codesigning-blob-get` | yes | yes | — | 0 | — |
| `process-legacy-codesigning-cdhash-get` | yes | yes | — | 0 | — |
| `process-legacy-codesigning-entitlements-blob-get` | yes | yes | — | 0 | — |
| `process-legacy-codesigning-identity-get` | yes | yes | — | 1 | `target` |
| `process-legacy-codesigning-status*` | yes | yes | — | 0 | — |
| `process-legacy-codesigning-status-get` | yes | yes | — | 0 | — |
| `process-legacy-codesigning-status-set` | yes | yes | — | 0 | — |
| `process-legacy-codesigning-teamid-get` | yes | yes | — | 0 | — |
| `process-legacy-codesigning-text-offset-get` | yes | yes | — | 0 | — |

### TTY

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `pseudo-tty` | yes | yes | — | 4 | — |

### Quarantine

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `qtn-exec` | yes | yes | — | 3 | `extension` |
| `qtn-exec-no-quarantine` | yes | yes | — | 1 | `extension` |
| `qtn-user` | yes | yes | — | 1 | — |

### Sandbox introspection

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `sandbox-check` | yes | yes | — | 0 | — |

### Signals

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `signal` | yes | yes | yes | 46 | `target`, `signal-number` |

### Socket options

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `socket-ioctl` | yes | yes | — | 11 | `ioctl-command` |
| `socket-option*` | yes | yes | — | 4 | — |
| `socket-option-get` | yes | yes | — | 2 | `socket-option-name` |
| `socket-option-set` | yes | yes | — | 2 | `socket-option-name` |

### Storage class

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `storage-class-map` | context-limited | — | — | 0 | — |

### Raw syscalls

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `syscall*` | yes | yes | — | 5 | — |
| `syscall-mach` | yes | yes | — | 35 | `machtrap-number`, `require-all`, `system-attribute`, `syscall-number` |
| `syscall-mig` | yes | yes | — | 31 | `kernel-mig-routine` |
| `syscall-unix` | yes | yes | — | 68 | `syscall-number`, `syscall-group-ulock`, `syscall-group-bsdthread`, `syscall-group-fcntl`, `syscall-group-kevent`, `syscall-group-read`, +22 |

### sysctl

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `sysctl*` | yes | yes | yes | 11 | `sysctl-name`, `sysctl-name-prefix` |
| `sysctl-read` | yes | yes | yes | 93 | `sysctl-name`, `sysctl-name-prefix` |
| `sysctl-write` | yes | yes | yes | 68 | `sysctl-name`, `sysctl-name-prefix` |

### System

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `system*` | yes | yes | yes | 0 | — |
| `system-acct` | yes | yes | yes | 0 | — |
| `system-audit` | yes | yes | yes | 34 | — |
| `system-automount` | yes | yes | — | 1 | `process-attribute`, `require-all` |
| `system-debug` | yes | yes | — | 0 | — |
| `system-fcntl` | yes | yes | — | 29 | `fcntl-command` |
| `system-fsctl` | yes | yes | yes | 78 | `fsctl-command`, `_IO` |
| `system-info` | yes | yes | — | 15 | `info-type` |
| `system-kas-info` | yes | yes | — | 0 | — |
| `system-kext*` | yes | yes | — | 4 | `kext-bundle-id` |
| `system-kext-load` | yes | yes | — | 3 | `kext-bundle-id` |
| `system-kext-query` | yes | yes | — | 6 | — |
| `system-kext-unload` | yes | yes | — | 1 | — |
| `system-mac*` | yes | yes | — | 0 | — |
| `system-mac-label` | yes | yes | yes | 0 | — |
| `system-mac-syscall` | yes | yes | — | 37 | `mac-syscall-number`, `mac-policy-name`, `require-all` |
| `system-memorystatus-control` | yes | yes | — | 1 | `memorystatus-control-command` |
| `system-necp-client-action` | yes | yes | — | 4 | `necp-client-action` |
| `system-nfssvc` | yes | yes | yes | 0 | — |
| `system-package-check` | yes | yes | — | 10 | — |
| `system-privilege` | yes | yes | — | 11 | `privilege-id` |
| `system-reboot` | yes | yes | yes | 0 | — |
| `system-sched` | yes | yes | — | 17 | `target` |
| `system-set-time` | yes | yes | yes | 0 | — |
| `system-socket` | yes | yes | yes | 115 | `socket-domain`, `require-all`, `socket-protocol`, `socket-type` |
| `system-suspend-resume` | yes | yes | — | 1 | — |
| `system-swap` | yes | yes | yes | 0 | — |

### XPC

| Operation | Compiles bare (v1) | v3 | 2011 guide | Used by Apple profiles | Filters seen with it |
|---|---|---|---|---|---|
| `xpc-message-send` | context-limited | — | — | 0 | — |

## Version-1-only operations

These compile under `(version 1)` but are **unbound** at `(version 2)` / `(version 3)`. They still work today because every mainstream profile declares version 1, but they are the first thing that will break if Apple ever retires the compatibility mode.

```
file-fsctl
iokit-open
ipc-posix-sem
ipc-posix-shm
ipc-posix-shm-read-metadata
mach-per-user-lookup
```

## Compared with the 2011 fG! guide

The 2011 guide lists 59 operations.

### No longer accepted (4)

```
file-write-mount
file-write-unmount
system-lcid
system-write-bootstrap
```

### Added since 2011 (162)

```
appleevent-send
asr-parser-enter
authorization-right-obtain
boot-arg-set
coalition-info
consume-extension
darwin-notification-post
default-message-filter
device*
device-camera
device-microphone
distributed-notification-post
dynamic-code-generation
exception-entitlement
file-clone
file-fsctl
file-graft
file-issue-extension
file-link
file-lock
file-map-executable
file-mknod
file-mount
file-mount-update
file-search
file-test-existence
file-ungraft
file-unmount
file-write-acl
file-write-create
file-write-finderinfo
file-write-unlink
fs-info
fs-quota*
fs-quota-get
fs-quota-off
fs-quota-on
fs-quota-set*
fs-quota-set-limits
fs-quota-set-usage
fs-quota-stat
fs-quota-sync
fs-rename
fs-snapshot*
fs-snapshot-create
fs-snapshot-delete
fs-snapshot-mount
fs-snapshot-revert
generic-issue-extension
hid-control
iokit*
iokit-async-external-method
iokit-external-method
iokit-external-trap
iokit-get-properties
iokit-issue-extension
iokit-open
iokit-open*
iokit-open-service
iokit-open-user-client
iokit-set-properties
ipc-posix-sem*
ipc-posix-sem-create
ipc-posix-sem-open
ipc-posix-sem-post
ipc-posix-sem-unlink
ipc-posix-sem-wait
ipc-posix-shm*
ipc-posix-shm-read*
ipc-posix-shm-read-data
ipc-posix-shm-read-metadata
ipc-posix-shm-write*
ipc-posix-shm-write-create
ipc-posix-shm-write-data
ipc-posix-shm-write-unlink
isp-command-send
lsopen
mach-cross-domain-lookup
mach-derive-port
mach-host*
mach-host-exception-port-set
mach-host-special-port-set
mach-issue-extension
mach-message-send
mach-register
mach-task*
mach-task-exception-port-set
mach-task-inspect
mach-task-read
mach-task-special-port*
mach-task-special-port-get
mach-task-special-port-set
managed-preference-read
necp-client-open
nvram*
nvram-delete
nvram-get
nvram-set
opendirectory-user-modify
process-codesigning
process-exec*
process-exec-interpreter
process-exec-update-label
process-info*
process-info-codesignature
process-info-dirtycontrol
process-info-ledger
process-info-listpids
process-info-pidfdinfo
process-info-pidfileportinfo
process-info-pidinfo
process-info-rusage
process-info-sandbox-container
process-info-setcontrol
process-iopolicy*
process-iopolicy-get
process-iopolicy-set
process-legacy-codesigning*
process-legacy-codesigning-blob-get
process-legacy-codesigning-cdhash-get
process-legacy-codesigning-entitlements-blob-get
process-legacy-codesigning-identity-get
process-legacy-codesigning-status*
process-legacy-codesigning-status-get
process-legacy-codesigning-status-set
process-legacy-codesigning-teamid-get
process-legacy-codesigning-text-offset-get
pseudo-tty
qtn-exec
qtn-exec-no-quarantine
qtn-user
sandbox-check
socket-ioctl
socket-option*
socket-option-get
socket-option-set
storage-class-map
syscall*
syscall-mach
syscall-mig
syscall-unix
system-automount
system-debug
system-fcntl
system-info
system-kas-info
system-kext*
system-kext-load
system-kext-query
system-kext-unload
system-mac*
system-mac-syscall
system-memorystatus-control
system-necp-client-action
system-package-check
system-privilege
system-sched
system-suspend-resume
user-preference*
user-preference-read
user-preference-write
xpc-message-send
```

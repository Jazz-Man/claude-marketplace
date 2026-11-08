# SBPL filters and matchers reference

Filters narrow a rule to a subset of objects. Apple publishes no list of them, so this table combines two independent measurements: whether the compiler binds the name as a filter primitive, and how often Apple's own profiles actually use it.

> Generated 2026-11-08 from machine probing of `sandbox-exec` on **macOS 27.2 (build 26B123)**
> and from an s-expression parse of the 611 Apple `.sb` profiles on that machine.
> Regenerate with `tmp/apple-sandbox/probe-ops.sh` + `tmp/apple-sandbox/parse-profiles.py`
> + `tmp/apple-sandbox/gen-reference.py`.


## Anatomy of a filter

```
(allow file-read-data
  (require-all                 ; combinator: every child must match
    (subpath "/usr/lib")       ; matcher: path prefix
    (vnode-type REGULAR-FILE)) ; matcher: vnode kind
  (with report))               ; modifier, not a filter
```

A rule may carry **several filters**; they are OR-ed together unless you wrap them in `require-all`, which ANDs them. `require-any` is an explicit OR and `require-not` negates.

**Kind** column meanings:

* **built-in** — the compiler binds it as a filter primitive (`(allow <name>)` fails with `illegal argument: #<FOREIGN PROCEDURE …>`).
* **built-in macro** — bound as a Scheme macro inside `libsandbox`.
* **Apple profile macro** — not built in; defined with `(define …)` inside Apple's own `.sb` files, so it only exists in profiles that import them.
* **Scheme** — plain TinyScheme facility (`param`, `string-append`, `require-all`, …).
* **seen in profiles** — appears in a rule but this probe did not classify it.


## All filters and matchers

| Name | Kind | Uses in Apple profiles | Typical operations |
|---|---|---|---|
| `global-name` | built-in | 9525 | `mach-lookup`, `mach-register`, `mach-issue-extension`, `ipc-posix-shm-read-data`, `ipc-posix-shm-write-create` |
| `subpath` | built-in | 3051 | `file-read*`, `file-write*`, `file-map-executable`, `file-read-data`, `file-issue-extension` |
| `literal` | built-in | 2644 | `file-read*`, `file-read-metadata`, `file-write*`, `file-read-data`, `network-outbound` |
| `preference-domain` | built-in | 2444 | `user-preference-read`, `user-preference-write`, `user-preference*`, `managed-preference-read` |
| `iokit-user-client-class` | built-in | 896 | `iokit-open`, `iokit-open-user-client`, `iokit-open-service`, `iokit-open*`, `iokit-set-properties` |
| `regex` | built-in | 877 | `file-read*`, `file-write*`, `file-issue-extension`, `file-read-data`, `file*` |
| `iokit-property` | built-in | 857 | `iokit-get-properties`, `iokit-set-properties` |
| `extension-class` | built-in | 672 | `file-issue-extension`, `generic-issue-extension`, `mach-issue-extension`, `file-issue-extension*`, `iokit-issue-extension` |
| `require-all` | built-in | 592 | `file-issue-extension`, `file-read*`, `file-write*`, `file-write-create`, `system-socket` |
| `extension` | built-in | 493 | `file-read*`, `file-write*`, `file-issue-extension`, `mach-lookup`, `file-clone` |
| `target` | built-in | 488 | `process-info*`, `process-info-dirtycontrol`, `signal`, `process-info-pidinfo`, `process-info-setcontrol` |
| `syscall-number` | built-in | 451 | `syscall-unix`, `syscall-mach` |
| `ipc-posix-name` | built-in | 286 | `ipc-posix-shm-read-data`, `ipc-posix-shm-write-data`, `ipc-posix-shm-write-create`, `ipc-posix-shm`, `ipc-posix-shm-read*` |
| `iokit-registry-entry-class` | built-in | 267 | `iokit-open`, `iokit-open-service`, `iokit-get-properties`, `iokit-open-user-client` |
| `right-name` | built-in | 200 | `authorization-right-obtain` |
| `nvram-variable` | built-in | 153 | `nvram-get`, `nvram*`, `nvram-set`, `nvram-delete` |
| `remote` | built-in | 147 | `network-outbound`, `network*`, `network-inbound`, `network-bind` |
| `fsctl-command` | built-in | 143 | `system-fsctl` |
| `sysctl-name` | built-in | 135 | `sysctl-read`, `sysctl-write`, `sysctl*` |
| `system-attribute` | built-in | 111 | `syscall-mach` |
| `ipc-posix-name-regex` | built-in | 102 | `ipc-posix-shm-read-data`, `ipc-posix-shm-write-data`, `ipc-posix-shm-read*`, `ipc-posix-shm`, `ipc-posix-shm-read-metadata` |
| `require-any` | built-in | 96 | `file-issue-extension`, `file-read*`, `file-write*`, `file*`, `mach-issue-extension` |
| `mount-relative-regex` | built-in | 93 | `file-write*`, `file-read*`, `file-issue-extension`, `file*`, `file-clone` |
| `path` | built-in | 77 | `file-read*`, `file-write*`, `file-map-executable`, `network-outbound`, `process-exec` |
| `machtrap-number` | built-in | 47 | `syscall-mach` |
| `socket-domain` | built-in | 46 | `system-socket`, `network-inbound` |
| `vnode-type` | built-in | 46 | `file-read*`, `file-write*`, `file-write-create`, `file-read-metadata`, `file-write-data` |
| `local` | built-in | 45 | `network-inbound`, `network*`, `network-bind`, `network-outbound` |
| `prefix` | built-in | 42 | `file-read*`, `file-write*`, `file-ioctl`, `file-map-executable`, `file-read-data` |
| `control-name` | built-in | 36 | `network-outbound` |
| `ipc-posix-name-prefix` | built-in | 36 | `ipc-posix-shm-read*`, `ipc-posix-shm-write-data`, `ipc-posix-shm-read-data`, `ipc-posix*`, `ipc-posix-shm*` |
| `mount-relative-literal` | built-in | 33 | `file-write*`, `file-read*`, `file*`, `file-read-data`, `file-read-metadata` |
| `deny` | built-in | 30 | `iokit-open-user-client`, `mach-bootstrap` |
| `allow` | built-in | 28 | `iokit-open-user-client`, `mach-bootstrap` |
| `nvram-variable-prefix` | built-in | 28 | `nvram-get`, `nvram-delete` |
| `iokit-user-client-class-regex` | built-in | 27 | `iokit-open`, `iokit-open-user-client` |
| `kernel-mig-routine` | built-in | 27 | `syscall-mig` |
| `local-name` | built-in | 27 | `mach-lookup`, `mach-register` |
| `sysctl-name-prefix` | built-in | 27 | `sysctl-read`, `sysctl-write`, `sysctl*` |
| `xpc-service-name` | built-in | 27 | `mach-lookup` |
| `iokit-method-number` | built-in | 26 | `iokit-open-user-client` |
| `require-not` | built-in | 26 | `file-write*`, `file-read*`, `file-write-create`, `mach-bootstrap`, `file*` |
| `xattr` | built-in | 26 | `file-write-xattr`, `file-read-xattr` |
| `regex-quote` | built-in | 23 | `file-read*`, `file-read-data`, `file-write*`, `file-read-metadata`, `file-unlink` |
| `global-name-prefix` | built-in | 22 | `mach-lookup`, `mach-register` |
| `mac-syscall-number` | built-in | 22 | `system-mac-syscall` |
| `fcntl-command` | built-in | 21 | `system-fcntl` |
| `iokit-registry-entry-class-prefix` | built-in | 20 | `iokit-open`, `iokit-open-service`, `iokit-open-user-client` |
| `mac-policy-name` | built-in | 20 | `system-mac-syscall` |
| `preference-domain-prefix` | built-in | 19 | `user-preference-read`, `user-preference-write`, `managed-preference-read`, `user-preference*` |
| `global-name-regex` | built-in | 18 | `mach-lookup`, `mach-register` |
| `file-mode` | built-in | 14 | `file-read*`, `file-write*` |
| `info-type` | built-in | 14 | `system-info` |
| `ioctl-command` | built-in | 14 | `socket-ioctl` |
| `mount-relative-subpath` | built-in | 14 | `file-write*`, `file-read*`, `file-issue-extension` |
| `kext-bundle-id` | built-in | 13 | `system-kext-load`, `system-kext*` |
| `socket-protocol` | built-in | 12 | `system-socket` |
| `xpc-service-name-prefix` | built-in | 11 | `mach-lookup` |
| `appleevent-destination` | built-in | 10 | `appleevent-send` |
| `necp-client-action` | built-in | 9 | `system-necp-client-action` |
| `xattr-prefix` | built-in | 9 | `file-read-xattr`, `file-write-xattr` |
| `iokit-connection` | built-in | 8 | `iokit-open-user-client`, `iokit-open`, `iokit-open-service`, `iokit-set-properties` |
| `file-attribute` | built-in | 6 | `file-read*`, `file-write*`, `file-read-data` |
| `process-attribute` | built-in | 6 | `system-automount`, `user-preference-read` |
| `xattr-regex` | built-in | 6 | `file-write-xattr`, `file-read-xattr` |
| `privilege-id` | built-in | 5 | `system-privilege` |
| `asr-parser-domain` | built-in | 4 | — |
| `local-name-prefix` | built-in | 4 | `mach-register`, `mach-lookup` |
| `notification-name` | built-in | 4 | `darwin-notification-post` |
| `state-flag` | built-in | 4 | `mach-bootstrap` |
| `device-conforms-to` | built-in | 3 | `file-ioctl`, `file-read*` |
| `extension-path-ancestor` | built-in | 3 | `file-read-metadata`, `file-read-data` |
| `xpc-service-name-regex` | built-in | 3 | `mach-lookup` |
| `control-name-prefix` | built-in | 2 | `network-outbound` |
| `extension-class-prefix` | built-in | 2 | `generic-issue-extension` |
| `message-number` | built-in | 2 | `mach-bootstrap` |
| `right-name-regex` | built-in | 2 | `authorization-right-obtain` |
| `socket-option-name` | built-in | 2 | `socket-option-get`, `socket-option-set` |
| `codesigning-operation` | built-in | 1 | `process-codesigning` |
| `extension-class-regex` | built-in | 1 | `generic-issue-extension` |
| `filesystem-name` | built-in | 1 | — |
| `iokit-property-prefix` | built-in | 1 | `iokit-set-properties` |
| `memorystatus-control-command` | built-in | 1 | `system-memorystatus-control` |
| `preference-domain-regex` | built-in | 1 | `user-preference*` |
| `process-path` | built-in | 1 | — |
| `process-path-regex` | built-in | 1 | — |
| `semaphore-owner` | built-in | 1 | `ipc-posix-sem` |
| `signal-number` | built-in | 1 | `signal` |
| `socket-type` | built-in | 1 | `system-socket` |
| `target-signing-identifier` | built-in | 1 | `process-info-codesignature` |
| `uid` | built-in | 1 | — |
| `accept-profile-extension` | built-in | 0 | — |
| `ancestor-signing-identifier` | built-in | 0 | — |
| `asr-parser-name` | built-in | 0 | — |
| `autobox` | built-in | 0 | — |
| `boot-arg` | built-in | 0 | — |
| `check-operation` | built-in | 0 | — |
| `coalition-info-flavor` | built-in | 0 | — |
| `csr` | built-in | 0 | — |
| `datavault-disk-filter` | built-in | 0 | — |
| `delegate` | built-in | 0 | — |
| `device-major` | built-in | 0 | — |
| `device-minor` | built-in | 0 | — |
| `disable-callouts` | built-in | 0 | — |
| `disable-full-symbolication` | built-in | 0 | — |
| `enable-profile-flag` | built-in | 0 | — |
| `error` | built-in | 0 | — |
| `exception-entitlement-name` | built-in | 0 | — |
| `exception-entitlement-value` | built-in | 0 | — |
| `extension-flag` | built-in | 0 | — |
| `extension-token-attribute` | built-in | 0 | — |
| `extension-token-type` | built-in | 0 | — |
| `fileprovider-syncroot-path` | built-in | 0 | — |
| `from` | built-in | 0 | — |
| `host-special-port` | built-in | 0 | — |
| `iokit-registry-entry-attribute` | built-in | 0 | — |
| `iokit-trap-number` | built-in | 0 | — |
| `iokit-usb-interface-class` | built-in | 0 | — |
| `iokit-usb-interface-subclass` | built-in | 0 | — |
| `iokit-user-client-type` | built-in | 0 | — |
| `iopolicy-policy` | built-in | 0 | — |
| `iopolicy-scope` | built-in | 0 | — |
| `iopolicy-type` | built-in | 0 | — |
| `isp-command` | built-in | 0 | — |
| `kas-info-selector` | built-in | 0 | — |
| `mach-derived-port-role` | built-in | 0 | — |
| `mach-exception-behavior` | built-in | 0 | — |
| `mach-exception-type` | built-in | 0 | — |
| `message-name` | built-in | 0 | — |
| `mount-flag` | built-in | 0 | — |
| `mount-relative-path` | built-in | 0 | — |
| `mount-root-path` | built-in | 0 | — |
| `notification-payload` | built-in | 0 | — |
| `operation-expand` | built-in | 0 | — |
| `operations-allowed-by-default` | built-in | 0 | — |
| `path-lookup-properties` | built-in | 0 | — |
| `persona-type` | built-in | 0 | — |
| `profile-flag` | built-in | 0 | — |
| `reboot-flags` | built-in | 0 | — |
| `require-ancestor-with-entitlement` | built-in | 0 | — |
| `require-responsible-binary-with-entitlement` | built-in | 0 | — |
| `require-target-with-entitlement` | built-in | 0 | — |
| `rootless-boot-device-filter` | built-in | 0 | — |
| `rootless-disk-filter` | built-in | 0 | — |
| `sbpl-operation-name` | built-in | 0 | — |
| `signing-identifier` | built-in | 0 | — |
| `snapshot-name` | built-in | 0 | — |
| `socket-option-level` | built-in | 0 | — |
| `storage-class` | built-in | 0 | — |
| `storage-class-extension` | built-in | 0 | — |
| `target-attribute` | built-in | 0 | — |
| `task-special-port` | built-in | 0 | — |
| `user-intent-extension` | built-in | 0 | — |
| `variable-quote` | built-in | 0 | — |
| `version` | built-in | 0 | — |
| `warn` | built-in | 0 | — |
| `with` | built-in | 0 | — |
| `with-filter` | built-in macro | 4 | `mach-bootstrap` |
| `debug` | built-in macro | 0 | — |
| `quasiquote` | built-in macro | 0 | — |
| `sbpl-message-filter` | built-in macro | 0 | — |
| `unless` | built-in macro | 0 | — |
| `when` | built-in macro | 0 | — |
| `with-modifier` | built-in macro | 0 | — |
| `home-subpath` | Apple profile macro | 1121 | `file-read*`, `file-write*`, `file-issue-extension`, `file-read-data`, `file-read-metadata` |
| `home-literal` | Apple profile macro | 242 | `file-read*`, `file-write*`, `file-read-metadata`, `file-issue-extension`, `file-read-data` |
| `home-regex` | Apple profile macro | 64 | `file-read*`, `file-write*`, `file-read-metadata`, `file-issue-extension`, `file-read-data` |
| `home-prefix` | Apple profile macro | 26 | `file-write*`, `file-read*` |
| `darwin-user-root-subpath` | Apple profile macro | 20 | `file-read*`, `file*`, `file-write*`, `file-map-executable`, `file-issue-extension` |
| `private-literal` | Apple profile macro | 14 | `file-read*`, `file-read-metadata`, `file-write*` |
| `home-directory-subpath` | Apple profile macro | 12 | `file-read*`, `file-write*`, `file-read-data`, `file-read-metadata` |
| `container-subpath` | Apple profile macro | 11 | `file-issue-extension`, `network-inbound`, `network-outbound`, `file-write-create`, `file-ioctl` |
| `appsupport-subpath` | Apple profile macro | 10 | `file-issue-extension`, `file-read*`, `file-write*` |
| `library-subpath` | Apple profile macro | 10 | `file-read*`, `file-write*`, `file-issue-extension` |
| `application-group-literal` | Apple profile macro | 8 | `file-read-data`, `file-write-create` |
| `enterprise-clouddocs-subpath` | Apple profile macro | 8 | `file-issue-extension` |
| `home` | Apple profile macro | 8 | `file-read*`, `file-write*` |
| `container-literal` | Apple profile macro | 6 | `file-unlink`, `file-write-create`, `file-write-data` |
| `font-file-or-directory` | Apple profile macro | 6 | `file-read*`, `file-issue-extension` |
| `param-subpath` | Apple profile macro | 6 | `file-read*` |
| `uuid-regex-string` | Apple profile macro | 6 | `file-issue-extension`, `file-read*` |
| `application-group-regex` | Apple profile macro | 5 | `file-ioctl`, `file-search`, `network-bind`, `network-outbound`, `file-mknod` |
| `private-regex` | Apple profile macro | 5 | `file-write*`, `file-read*`, `file-write-data` |
| `container-cache-regexes` | Apple profile macro | 4 | `file-read*`, `file-write*` |
| `container-regex` | Apple profile macro | 4 | `file-unlink` |
| `home-path-ancestors` | Apple profile macro | 4 | `file-read*`, `file-read-metadata` |
| `multivolume-store-paths` | Apple profile macro | 4 | `file-issue-extension`, `file-read*`, `file-write*` |
| `container-root-regexes` | Apple profile macro | 3 | `file-read*`, `file-write*` |
| `darwin-user-cache-regex` | Apple profile macro | 3 | `file-read*`, `file-write*` |
| `darwin-user-temp-subpath` | Apple profile macro | 3 | `file-read*`, `file-write*` |
| `data-container-subpath` | Apple profile macro | 3 | `file-issue-extension`, `file-read*`, `file-write*` |
| `data-separated-context-root-regex` | Apple profile macro | 3 | `file-read*`, `file-write*` |
| `enterprise-context-root` | Apple profile macro | 3 | `file-read*`, `file-write*` |
| `enterprise-context-tmp` | Apple profile macro | 3 | `file-read*`, `file-write*` |
| `group-container-subpath` | Apple profile macro | 3 | `file-issue-extension`, `file-read*`, `file-write*` |
| `revisiond-store-paths` | Apple profile macro | 3 | `file-read*`, `file-issue-extension`, `file-write*`, `file-write-xattr` |
| `container-cache-root` | Apple profile macro | 2 | `file-issue-extension`, `file-read*`, `file-write*` |
| `data-separated-context-cache-regexes` | Apple profile macro | 2 | `file-issue-extension`, `file-read*`, `file-write*` |
| `enterprise-context-library` | Apple profile macro | 2 | `file-read*`, `file-write*` |
| `font-file` | Apple profile macro | 2 | `file-read*` |
| `fpfs-enterprise-provided-files` | Apple profile macro | 2 | `file-issue-extension`, `file-read*`, `file-write*` |
| `fpfs-enterprise-provided-files-secondary` | Apple profile macro | 2 | `file-issue-extension`, `file-read*`, `file-write*` |
| `legacy-enterprise-provided-files` | Apple profile macro | 2 | `file-issue-extension`, `file-read*`, `file-write*` |
| `library-literal` | Apple profile macro | 2 | `file-read*` |
| `logd-diagnostic-paths` | Apple profile macro | 2 | `file-issue-extension`, `file-read*`, `file-write*` |
| `temp-directory-subpath` | Apple profile macro | 2 | `file-read-data`, `file-write-data` |
| `unsuffixed-userdir-subpath` | Apple profile macro | 2 | `file-read*`, `file-write*` |
| `user-subpath` | Apple profile macro | 2 | `file-read*` |
| `cache-subpath` | Apple profile macro | 1 | `file-read*`, `file-write*` |
| `container-root` | Apple profile macro | 1 | `file-read*`, `file-write*` |
| `darwin-user-cache-subpath` | Apple profile macro | 1 | `file-read*`, `file-write*` |
| `darwinuserdir-subpath` | Apple profile macro | 1 | `file-read*` |
| `enterprise-cloudkit-cache` | Apple profile macro | 1 | `file-read*`, `file-write*` |
| `enterprise-context-regex` | Apple profile macro | 1 | `file-read*`, `file-write*` |
| `fileprovider-enterprise-wharf` | Apple profile macro | 1 | `file-read*`, `file-write*` |
| `fileprovider-wharf` | Apple profile macro | 1 | `file-read*`, `file-write*` |
| `fpfs-primary-provided-files` | Apple profile macro | 1 | `file-read*`, `file-write*` |
| `global-container-prefix-subpath` | Apple profile macro | 1 | `file-read*`, `file-write*` |
| `global-container-subpath` | Apple profile macro | 1 | `file-issue-extension` |
| `library-regex` | Apple profile macro | 1 | `file-read*` |
| `param-literal` | Apple profile macro | 1 | `file-read*` |
| `private-subpath` | Apple profile macro | 1 | `file-read-metadata` |
| `temp-subpath` | Apple profile macro | 1 | `file-read*`, `file-write*` |
| `tempdir-subpath` | Apple profile macro | 1 | `file-read*` |
| `unusual-container-subpath` | Apple profile macro | 1 | `file-read*`, `file-write*` |
| `param` | Scheme | 1056 | `file-read*`, `file-write*`, `file-issue-extension`, `file-read-data`, `file*` |
| `string-append` | Scheme | 166 | `file-read*`, `file-write*`, `file-read-data`, `file-write-create`, `file-issue-extension` |
| `apply` | Scheme | 25 | `file-read-metadata`, `file-read*`, `file-issue-extension`, `file-write*`, `file-write-create` |
| `car` | Scheme | 1 | `appleevent-send` |
| `_IO` | seen in profiles | 52 | `system-fsctl` |
| `apply-message-filter` | seen in profiles | 25 | `iokit-open-user-client`, `mach-bootstrap` |
| `syscall-group-ulock` | seen in profiles | 16 | `syscall-unix` |
| `require-entitlement` | seen in profiles | 14 | — |
| `syscall-group-bsdthread` | seen in profiles | 13 | `syscall-unix` |
| `syscall-group-fcntl` | seen in profiles | 12 | `syscall-unix` |
| `syscall-group-kevent` | seen in profiles | 12 | `syscall-unix` |
| `syscall-group-read` | seen in profiles | 12 | `syscall-unix` |
| `syscall-group-pthread` | seen in profiles | 11 | `syscall-unix` |
| `syscall-group-rlimit` | seen in profiles | 11 | `syscall-unix` |
| `syscall-group-signal` | seen in profiles | 11 | `syscall-unix` |
| `syscall-group-stat` | seen in profiles | 11 | `syscall-unix` |
| `syscall-group-mkdir` | seen in profiles | 10 | `syscall-unix` |
| `syscall-group-send` | seen in profiles | 10 | `syscall-unix` |
| `syscall-group-statfs` | seen in profiles | 10 | `syscall-unix` |
| `path-ancestors` | seen in profiles | 9 | `file-read*`, `file-read-metadata`, `file-test-existence` |
| `syscall-group-getfsstat` | seen in profiles | 9 | `syscall-unix` |
| `path-literal` | seen in profiles | 8 | `network-outbound` |
| `syscall-group-close` | seen in profiles | 8 | `syscall-unix` |
| `syscall-group-kqueue` | seen in profiles | 5 | `syscall-unix` |
| `syscall-group-open-dprotected` | seen in profiles | 5 | `syscall-unix` |
| `syscall-group-pthread-locks` | seen in profiles | 5 | `syscall-unix` |
| `syscall-group-select` | seen in profiles | 5 | `syscall-unix` |
| `_home-subpath` | seen in profiles | 4 | `file-read*`, `file-write*`, `file-issue-extension` |
| `syscall-group-necp-client` | seen in profiles | 4 | `syscall-unix` |
| `syscall-group-open` | seen in profiles | 4 | `syscall-unix` |
| `syscall-group-sockopt` | seen in profiles | 4 | `syscall-unix` |
| `syscall-group-write` | seen in profiles | 4 | `syscall-unix` |
| `resolving-subpath` | seen in profiles | 3 | `network-bind`, `network-outbound` |
| `syscall-group-network-channel` | seen in profiles | 3 | `syscall-unix` |
| `syscall-group-pthread-cv` | seen in profiles | 3 | `syscall-unix` |
| `%entitlement-is-present` | seen in profiles | 2 | — |
| `orig-literal` | seen in profiles | 2 | `file-read-metadata`, `file-write-create` |
| `syscall-group-recv` | seen in profiles | 2 | `syscall-unix` |
| `_home-regex` | seen in profiles | 1 | `file-read*`, `file-write*` |
| `map` | seen in profiles | 1 | `file-mount`, `file-read*`, `file-unmount`, `file-write*` |
| `syscall-group-chflags` | seen in profiles | 1 | `syscall-unix` |
| `syscall-group-mach-eventlink` | seen in profiles | 1 | `syscall-unix` |

## Path matchers

Path matchers are the ones you will use most, and they differ in more than syntax.

| Matcher | Matches | Notes |
|---|---|---|
| `(literal "/a/b")` | exactly `/a/b` | the directory `/a/b/` and its children are **not** covered |
| `(subpath "/a")` | `/a` and everything below it | the workhorse; never write a trailing slash |
| `(prefix "/a/b")` | any path whose text starts with `/a/b` | plain string prefix, so `/a/bc` also matches |
| `(regex #"/a/.*\\.js$")` | regular expression | `#"..."` is the regex literal syntax |
| `(path "/a/b")` | same as `literal` | newer spelling used by Chromium and Apple profiles |
| `(glob "/a/*.txt")` | shell glob | **not bound on this system** — `unbound variable: glob` |

### Filters match physical paths, never symlinks

Measured with a 2x2 matrix (filter spelling x path passed to the program):

| filter | program accesses | result |
|---|---|---|
| `/tmp/f` | `/tmp/f` | **DENIED** |
| `/tmp/f` | `/private/tmp/f` | **DENIED** |
| `/private/tmp/f` | `/tmp/f` | ALLOWED |
| `/private/tmp/f` | `/private/tmp/f` | ALLOWED |

The kernel resolves the path being accessed, but the filter string is used verbatim. `/tmp`, `/var` and `/etc` are symlinks into `/private`, so a filter written as `/tmp/...` silently never matches. Always canonicalise (`pwd -P`, `realpath`) before emitting a rule. The same holds for `subpath`.


## Modifiers

Modifiers are not filters: they sit inside `(with ...)` and change what happens when a rule fires. Counts below are from Apple's own profiles.

| Modifier | Uses | Applies to | Meaning |
|---|---|---|---|

| `report` | 116 | allow | emit a sandbox report for the operation (rejected on `deny`: `report modifier does not apply to deny action`) |
| `telemetry` | 81 | both | attach telemetry to the event |
| `message` | 56 | deny | attach a custom string to the denial log / report |
| `no-log` | 45 | deny | do not log the denial |
| `no-report` | 37 | allow | suppress the report an allow would emit |
| `no-sandbox` | 20 | allow, `process-exec` only | let the executed child run without inheriting the sandbox |
| `send-signal` | 9 | both | raise a signal in the process instead of returning an error, e.g. `(with send-signal SIGKILL)` |
| `no-callout` | 3 | allow | suppress sandbox callouts for the operation |
| `errno` | 2 | deny | return a specific errno such as `EACCES` instead of `EPERM` |
| `telemetry-backtrace` | 1 | both | include a backtrace in telemetry |
| `partial-symbolication` | 1 | both | symbolicate telemetry backtraces partially |

---
# cc-sdd-xsqs
title: "fs v2 fix round 5 — final-round criticals: homeVarToTilde final form, tildeUser gate, SAFE_DEVICES restore"
status: completed
type: task
priority: normal
created_at: 2026-10-15T22:41:18Z
updated_at: 2026-10-15T22:43:40Z
parent: cc-sdd-20zn
---

Full opus re-review found two CRITICAL resolution-engine bypasses (braced-var zone escapes via the open ${HOME prefix strip; tilde-user paths resolving in-project). Fix per plan Task 2 fix-round amendments: (1) homeVarToTilde final form — only exact ${HOME} and boundary-checked $HOME anchor, open branch deleted; (2) new tildeUser export + Bash-walk gate; (3) SAFE_DEVICES +/dev/zero,/dev/urandom,/dev/random (v1 parity); (4) fixtures: 7 DENY + 3 ALLOW rows. TDD: RED then GREEN.

## Summary of Changes

Round-5 final criticals fixed per the amended plan: homeVarToTilde final form (open ${HOME prefix-strip deleted; only exact ${HOME} and boundary-checked $HOME anchor), new tildeUser export + Bash-walk gate in policy.ts (checkFilePath untouched), SAFE_DEVICES +zero/urandom/random (v1 parity), fixtures +7 DENY/+3 ALLOW. TDD RED 69/8 -> GREEN 77/0; full suite 324/3 (known run-hook trio); tsc clean; biome exit 0 (2 known warnings); probe tmp/fixround5-probe.ts ALL OK (37 checks). Report: task-2-report.md ## Fix round 5. Not committed.

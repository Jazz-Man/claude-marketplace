---
# cc-sdd-kcqp
title: "R9-T2: Canonical twins (GP-1 fork resolution, RS-1 FORK line)"
status: completed
type: task
priority: normal
created_at: 2026-09-25T14:17:08Z
updated_at: 2026-09-25T14:54:20Z
parent: cc-sdd-04hq
blocked_by:
  - cc-sdd-c2um
---

6 forks get identical GP-1 resolution block (source: spec-design:47-57 verbatim; validate-impl 'invoking'→'the main', spec-tasks regains 'that epic is') + identical RS-1 FORK sentence 6/6 (validate-impl regains 2nd clause). Verify: resolution opening=6, FORK sentence=6, inline copies untouched.

## Summary of Changes

GP-1 twin: 6 forks md5-identical Step-1 resolution blocks (spec-design source untouched; spec-tasks regained 'that epic is'; validate-impl 'invoking'→'the main' x2). RS-1 twin: 6/6 identical FORK sentences (validate-impl restored full clause; Entry-paths untouched). Only 2 files edited — 4 forks already identical (byte-verified). Review APPROVED; T6 advisories: adopt C1's 3 family-unique anchor patterns + byte-compare (spec 4.1 erratum), grep -I, word-boundary merges, pattern-text-out-of-command-line.

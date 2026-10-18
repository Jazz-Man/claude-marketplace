---
# cc-sdd-5r8c
title: "Wave C2: validation gates + doc-hash"
status: completed
type: task
priority: normal
created_at: 2026-09-24T16:59:41Z
updated_at: 2026-09-24T17:15:54Z
parent: cc-sdd-uwj4
---

Auto-validator on approve, tag+hash at GO, impl freshness gates, hyphen sweep. Closes Wave C.

## Summary of Changes

Approve-gates auto-dispatch validators (requirements/design; Agent opus paths-only) BEFORE any completion write; GO sequence exact (tag validated -> post-fix shasum at GO -> ## Validation round w/ Doc-hash -> -s completed); NO_GO four-part, phase uncompletable (both flow-walks verified); validate-design upgraded to C1 contract (4-category boundary, FIXES_APPLIED, no-hash rule); impl Step 0 freshness gate (tag + LATEST Doc-hash vs recomputed shasum; stale = four-part STOP, never silent); NO-GO hyphens swept incl. validate-impl machine DECISION line. Review APPROVED; fix round clean.

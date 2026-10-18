---
# cc-sdd-0cnj
title: "fs v2 fix round 2: =@ decomposition final form + case-residual basenames"
status: completed
type: task
priority: normal
created_at: 2026-10-15T21:47:05Z
updated_at: 2026-10-15T21:49:06Z
parent: cc-sdd-20zn
---

Re-review round-2 residuals: pathCandidates final form (flag-glued =@ strips @, non-flag NAME=@path classifies path side, prose foo=/etc never decomposes); home-tier .claude.json + SECRETS_BASENAMES lookups lowercased; 4 DENY fixtures per plan Task 2 block.

## Summary of Changes

Round-2 re-review residuals fixed per the plan amendment final forms: pathCandidates =@ decomposition (flag-glued `curl -d=@/etc/passwd`, non-flag `curl -F f=@/etc/hosts`, prose `foo=/etc` never decomposes); lowercased home-tier .claude.json + SECRETS_BASENAMES lookups; 4 DENY fixtures. RED 63/4 -> GREEN 67/0; full gates green (314/3 known run-hook trio; tsc clean; biome exit 0; modules under 300 lines). Report: .superpowers/sdd/2026-10-15-filesystem-policy-v2/task-2-report.md § Fix round 2. Not committed — human reviews and commits.

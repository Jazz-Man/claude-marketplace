---
# cc-sdd-p1mi
title: "Wave D2: bin helpers"
status: completed
type: task
priority: normal
created_at: 2026-09-24T17:34:09Z
updated_at: 2026-09-24T18:11:48Z
parent: cc-sdd-uwj4
---

sdd-gate/sdd-verdict/sdd-promote with live fixture tests.

## Summary of Changes

bin/ helpers shipped: sdd-gate (19 exit paths, LATEST-hash backward scan, read-only), sdd-verdict (prefix-match latest-wins, task+epic), sdd-promote (only write helper, per-id verification, --all excl phases). POSIX sh/set -eu, shellcheck clean, em-dash-safe bytewise. Live transcripts: every path. 3 real parser bugs caught and fixed pre-release (incl. scratch phase-flip, repaired). 3 mention-only skill lines. Review APPROVED (script-quality line-by-line clean); deferred: promote zero-parse warn -> E1.

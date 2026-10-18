---
# cc-sdd-5lgl
title: "Wave B1: spec-init phase beans"
status: completed
type: task
priority: normal
created_at: 2026-09-24T15:01:14Z
updated_at: 2026-09-24T15:15:21Z
parent: cc-sdd-uwj4
---

Three phase beans + chain + idempotent activation (spec Rev 5).

## Summary of Changes

spec-init Step 3.4: three phase beans (exact titles, -t task -s todo --tag phase --parent, gate body line via -d) + two --blocked-by chain updates; idempotent on fresh AND slug-matched activation paths (title+tag match, blockedByIds link check per annex); summary clause added. Review APPROVED — stash incident CLEAN via cold-read; F1 factual nit routed to E1 (create DOES have --blocked-by; earlier claim was wrong).

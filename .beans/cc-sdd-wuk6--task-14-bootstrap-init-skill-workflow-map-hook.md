---
# cc-sdd-wuk6
title: "Task 14: bootstrap — init skill + workflow map + hook"
status: completed
type: task
priority: normal
created_at: 2026-09-23T11:55:12Z
updated_at: 2026-09-23T12:10:17Z
parent: cc-sdd-uwj4
---

Plan task 14: assets/workflow-map.md (wrapped for hook injection), hooks/hooks.json (SessionStart with user-file precedence), skills/init (writes .claude/rules/sdd.md from map minus wrappers, refuse-if-exists, in-chat note).

## Summary of Changes

Bootstrap trio: assets/workflow-map.md (hook-injection form, 60 lines, all required elements incl. 14-skill index + user-file override), hooks/hooks.json (byte-verbatim, precedence check + PLUGIN_ROOT guard, startup|clear|compact), skills/init (disable-model-invocation, runtime single-source read + wrapper strip, refuse-if-exists with diff offer, one-line note). Review APPROVED — hook env/context doc-verified (no Unverified left); minor strip-coupling guard added to the final battery.

Addendum (user-requested, fix 14b): beans prime hooks added — SessionStart (second entry, no matcher) + PreCompact; plugin now self-supplies the beans guide every session and before compaction; canonical plan JSON updated; re-review 3/3 PASS.

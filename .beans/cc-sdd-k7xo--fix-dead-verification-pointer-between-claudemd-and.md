---
# cc-sdd-k7xo
title: Fix dead verification pointer between CLAUDE.md and tech.md
status: completed
type: task
priority: normal
created_at: 2026-11-01T21:29:00Z
updated_at: 2026-11-01T21:29:08Z
---

claude-md-improver audit found tech.md Verify section pointing to CLAUDE.md Verification section for Revision 9 twin-check patterns, claiming it points into two design docs under docs/superpowers/specs/ - but CLAUDE.md records those design docs as gone. Fix both sides: CLAUDE.md closing line gains a resolving pointer to tech.md full battery; tech.md false parenthetical corrected.

## Summary of Changes

- CLAUDE.md Verification section: closing line now resolves to tech.md full battery (helper-tests.sh, bun check --strict --all) instead of silently narrowing to greps + validate.
- tech.md Verify-before-claiming-done item 2: false claim that CLAUDE.md pins the Revision 9 twin-check patterns and points into the (deleted) design docs replaced with the truth - scope stays pinned in CLAUDE.md, twin-check pinning is gone, re-derive before relying on it.
- Verified during audit: claude plugin validate . passes; double-brace and Kiro invariant greps return zero hits; 15-skill census matches the workflow map. Edits touch only dev-context rule files (not skills/assets/hooks/bin/packages), so the full battery is not triggered by this change.

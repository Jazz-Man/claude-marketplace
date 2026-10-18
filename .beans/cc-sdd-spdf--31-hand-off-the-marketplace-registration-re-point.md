---
# cc-sdd-spdf
title: 3.1 Hand off the marketplace registration re-point
status: completed
type: task
priority: normal
tags:
  - status-done-with-concerns
  - verdict-approved
  - verification-verified
created_at: 2026-09-26T16:49:15Z
updated_at: 2026-09-27T10:58:17Z
parent: cc-sdd-lpx9
---

## Brief

Task: 3.1
Title: Hand off the marketplace registration re-point

Restore the user's local marketplace registration against the restructured repository, preserving the existing marketplace and plugin identities.

- Hand the user the re-add command for the repository directory under the existing marketplace name; a same-name re-add replaces the registration in place.
- If the CLI refuses the same-name re-add, hand the documented fallback: remove the marketplace, then re-add.
- The marketplace name and the installed plugin reference are preserved exactly — nothing is renamed anywhere in the flow.
- The broken-registration window is expected, not an error: a session started before the re-add simply runs without the plugin; the user re-adds, then starts or reloads a session.
- Observable completion: the marketplace list shows exactly one registration under the existing name pointing at the repository directory — no duplicate entry.

_Requirements: 3.1, 3.2, 3.6_
_Boundary: Registration re-point procedure_

## Report

Deliverable produced; no files touched — this task is a registration hand-off (boundary: Registration re-point procedure, design.md §Registration re-point procedure; requirements 3.1, 3.2, 3.6).

### Read-only current-state inspection (before hand-off)

- `claude plugin marketplace list` shows 10 registrations; `sdd-local` is present exactly once: `Source: Directory (/Users/vasilsokolik/www/cc-sdd)`. No duplicate.
- The registration predates the restructure, so it is stale until re-added: it was recorded when the plugin entry resolved from `./`, while the re-pointed manifest now carries `source: "./plugins/sdd"` (verified: `.claude-plugin/marketplace.json`). The list output cannot distinguish a stale from a freshly re-added registration (consistent with cc-sdd-qhkg) — hence the mandated re-add is the repair step, not the current list shape.
- Precondition check (design: Validate-green checkpoint): `claude plugin validate .` → "Validation passed", exit 0, naming the re-pointed root manifest.

### User-run command block (hand-off)

Primary — same-name re-add replaces the registration in place (design contract, 3.2):

    claude plugin marketplace add /Users/vasilsokolik/www/cc-sdd

Fallback — only if the CLI refuses the same-name re-add:

    claude plugin marketplace remove sdd-local
    claude plugin marketplace add /Users/vasilsokolik/www/cc-sdd

Names preserved on both paths: marketplace `sdd-local`, plugin reference `sdd@sdd-local` — nothing renamed (3.1). The `enabledPlugins["sdd@sdd-local"]` setting persists through both paths. The broken-registration window before the re-add is expected (3.6): sessions started in the window simply run without the plugin.

After the re-add: start a fresh session (or `/reload-plugins` in a running one).

### Post-run observable-completion check (orchestrator-run, read-only)

    claude plugin marketplace list

Pass criterion: exactly one `sdd-local` registration, `Source: Directory (/Users/vasilsokolik/www/cc-sdd)`, no duplicate entry. Design postconditions additionally name the fresh-session behavior (skills load, hook injects, `CLAUDE_PLUGIN_ROOT` → `plugins/sdd`) — those are the 3.3-3.5 checks owned downstream, run after the user executes the block.

### Concerns

- The re-add itself was NOT executed (by design — user-run state change; agents never run marketplace add/remove). The completion criterion is observably met only after the user runs the block and the orchestrator runs the post-run check.
- Design risk note applies verbatim: replace-in-place is documented (3.2) but not machine-verifiable pre-run; the fallback covers a refusal. If the user reports a refusal, the fallback command block above is the hand-off answer.

## Notes

- Learning for downstream 3.x checks: marketplace list output cannot distinguish a stale pre-restructure registration from a freshly re-added one (same path, no refresh evidence printed) — the re-add's success evidence at list level is only the user having run it plus the single-entry check; load-level proof comes from the fresh-session checks (3.3-3.5).

## Validation

- VERDICT: APPROVED - 2026-09-27, review round 1, package: workspace/review-package-3.1.md

- STATUS: VERIFIED - 2026-09-27, verification gate (fresh): marketplace list shows exactly one sdd-local -> Directory (/Users/vasilsokolik/www/cc-sdd); sdd@sdd-local present in plugin list; primary re-add executed by the user, fallback unused

## Summary of Changes

Registration re-point hand-off executed: same-name re-add of the repository directory under sdd-local (in-place replace, identities preserved, fallback unused); single-entry list shape and user-scope enablement confirmed fresh; review round 1 APPROVED with zero findings. Load-level proof (3.3-3.5) deferred to task 3.2 by design.

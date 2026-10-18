---
# cc-sdd-qhkg
title: 1.2 Re-point the marketplace manifest and validate green
status: completed
type: task
priority: normal
tags:
  - status-done
  - verdict-approved
  - verification-verified
created_at: 2026-09-26T16:49:00Z
updated_at: 2026-09-26T17:22:34Z
parent: cc-sdd-lpx9
---

## Brief

Task: 1.2
Title: Re-point the marketplace manifest and validate green

Update the root marketplace registry so the sdd entry references the plugin by its new subfolder path, then confirm the restructured repository passes platform validation.

- Edit only the entry's source value to the plugin subfolder path; marketplace name, owner, entry name, and descriptions stay byte-identical to the current manifest.
- Keep the registry append-only: with the entry referenced by subfolder path, a future plugin is a new subfolder plus one new entry, requiring no change inside existing plugin subfolders.
- Run plugin validation at the repository root and require zero errors — the first green checkpoint, the earliest state where manifest and layout agree.
- If validation reports errors, its output names the offending field; fix the named field and re-validate before anything downstream proceeds.
- Observable completion: validation passes, naming the marketplace manifest at the root and the plugin entry resolving to the plugin subfolder.

_Requirements: 1.3, 2.1, 2.3_
_Boundary: Root marketplace manifest_

## Report

Task 1.2 — single content edit to the root marketplace manifest: the sdd entry's source re-pointed from "./" to "./plugins/sdd" (design §Manifest content after the edit).

What was done:

- One Edit-tool replacement in `.claude-plugin/marketplace.json`: `"source": "./"` → `"source": "./plugins/sdd"` (line 8). Nothing else in the file touched.

Verification evidence (all read-only besides the edit):

- Byte-identity: `git diff -- .claude-plugin/marketplace.json` → exactly one line changed (the source value); marketplace name (sdd-local), description, owner, entry name (sdd), and entry description byte-identical.
- Content gate: `grep '"source"' .claude-plugin/marketplace.json` → line 8 reads `"source": "./plugins/sdd"`.
- Resolution: `plugins/sdd/.claude-plugin/plugin.json` exists with `"name": "sdd"` — matches the entry name per the design postcondition.
- `claude plugin validate .` at repo root → exit 0, zero errors: "Validating marketplace manifest: /Users/vasilsokolik/www/cc-sdd/.claude-plugin/marketplace.json / ✔ Validation passed".
- `claude plugin validate . --json` → success true; errors, warnings, notes all empty; target = the root manifest path.

Per the 1.1 learning: validate was green pre-edit too (stale source, no root plugin manifest), so the gate here is the edited source content plus validate's named output — both covered above. Findings on the tool: validate output (text and --json forms) names the root marketplace manifest and reports success but never prints per-entry resolved paths; entry resolution is evidenced by the source value plus the plugin manifest's existence at the resolved path.

RED evidence: pre-edit grep showed `"source": "./"` — the content gate's failing state (validate color was never the RED signal, per the 1.1 learning). TDD mapping for this config edit (repo has no test framework per tech.md): RED = failing content grep, GREEN = passing content grep + zero-error validate; REFACTOR: N/A — nothing to clean in a one-line change.

Concerns: none.

## Notes

• Learning for later tasks: `claude plugin validate` output (text and --json) names the root marketplace manifest and reports zero errors but never prints per-entry resolved paths — entry resolution is only evidenced by the manifest's source value plus the plugin manifest's existence at the resolved path, never by validate output.

## Validation

- VERDICT: APPROVED - 2026-09-26, review round 1, package: workspace/review-package-1.2.md
- STATUS: VERIFIED - 2026-09-26, verification gate (fresh): claude plugin validate . exit 0 naming the root manifest; source line 8 reads ./plugins/sdd; plugins/sdd/.claude-plugin/plugin.json name sdd matches the entry

## Parking lot

- design.md Testing Strategy overstates validate output (no per-entry resolved path line exists) - feature-level validate-impl must not wait on that observable; entry resolution stays evidenced by manifest source + plugin manifest existence at the resolved path.

## Summary of Changes

One-line root manifest re-point (entry source ./ -> ./plugins/sdd), everything else byte-identical; validate green with content gate independently verified; review round 1 APPROVED (1 MINOR parked).

---
# cc-sdd-sp3d
title: 3.2 Verify plugin behavior in a fresh session
status: completed
type: task
priority: normal
tags:
  - verdict-approved
  - verification-verified
  - status-done
created_at: 2026-09-26T16:49:15Z
updated_at: 2026-09-27T11:29:30Z
parent: cc-sdd-lpx9
---

## Brief

Task: 3.2
Title: Verify plugin behavior in a fresh session

Confirm the re-pointed installation behaves identically to the pre-move one by checking the plugin's runtime footprint in a fresh session.

- Preconditions: the registration re-point has run and the repository is battery-green.
- Start a fresh session in a scratch project with the re-pointed registration active (or reload plugins in a running one).
- The workflow map is injected at session start — this proves both hook execution and plugin-root resolution to the plugin subfolder, since the hook reads the map through the plugin-root variable.
- The sdd skills appear invocable in the session.
- Observable completion: a fresh session loads the sdd skills and injects the workflow map while the registration points at the restructured repository.

_Requirements: 3.3, 3.4, 3.5_
_Boundary: sdd plugin folder_

## Report

Verification-only task; zero repository files touched. Proved requirements 3.3/3.4/3.5 with the re-pointed registration active, using a fresh headless session in a /tmp scratch project.

Method and pre-checks (all read-only):

- `claude plugin list`: exactly one `sdd@sdd-local` entry — Scope: user, Status: ✔ enabled (precondition from 3.1 holds).
- Hook wiring confirmed in plugins/sdd/hooks/hooks.json: SessionStart matcher `startup|clear|compact`; when `$CLAUDE_PROJECT_DIR/.claude/rules/sdd.md` is absent it runs `cat "${CLAUDE_PLUGIN_ROOT:?unset}/assets/workflow-map.md"`.
- Created empty /tmp/sdd-fresh-session-scratch (no .claude dir) and ran `claude -p` there with a context-only verification prompt (tools disallowed).

Scratch session's verbatim answer:

- "A1: YES - The heading line `# sdd - spec-driven development (default workflow map)` appears verbatim in the SessionStart hook injection; the first non-empty line following it is `Spec-driven development with subagent-first execution; skills run as /sdd:<name>.`"
- "A2: YES - The available skills list includes `sdd:impl`, `sdd:review`, and `sdd:spec-init` (among others such as sdd:spec-requirements, sdd:validate-design, sdd:debug)."

Evidence chain:

- Req 3.4 (SessionStart hook injects the workflow map): the map heading plus opening sentence are present in a fresh session, attributed to the SessionStart injection. Quote fidelity verified: both quoted lines match plugins/sdd/assets/workflow-map.md (heading at line 5, sentence at line 6).
- Req 3.5 (${CLAUDE_PLUGIN_ROOT} -> plugins/sdd): the hook's only read is `${CLAUDE_PLUGIN_ROOT}/assets/workflow-map.md`; `find` over the repository returns exactly one workflow-map.md — plugins/sdd/assets/workflow-map.md — and the `:?unset` guard makes an unset variable error out rather than print nothing. The exact map text landing in context therefore proves the variable resolved to the plugin subfolder; a stale pre-move resolution would have failed the cat and left no map.
- Req 3.3 (/sdd:* skills load): the fresh session lists sdd-prefixed invocable skills.
- Corroboration (not primary): this orchestrator session itself loaded /sdd:impl's skill body from plugins/sdd/skills/impl/ after the re-add — this task's own dispatch and role-prompt resolved through the moved tree live.

Concerns (non-blocking): the scratch `claude -p` run leaves a session transcript under ~/.claude/projects/ for the scratch path — harness session logging, not plugin/marketplace/settings state; left in place. The scratch session's `beans prime` hook outcome was not separately observable and is irrelevant to the map-injection proof (separate hook entry). CLI noise: a 3s stdin warning on `claude -p` (cosmetic; `< /dev/null` silences it).

Cleanup: /tmp/sdd-fresh-session-scratch removed (verified absent).

## Notes

• Fresh-session proof method works: `claude -p` in an empty /tmp dir fires the plugin SessionStart hooks and the model verbatim-reports injected context — reusable for 5.x fresh-evidence checks; pipe `< /dev/null` to silence the 3s stdin warning.

## Validation

- VERDICT: APPROVED - 2026-09-27, review round 1, package: workspace/review-package-3.2.md

## Parking lot

- Fresh-session skill checks (reusable for 5.x): leave the Skill tool enabled, or instruct the scratch model to distinguish the harness skills listing from the hook-injected map - tools-disallowed runs cannot evidence a 3.3-style claim.
- Bean report citation: map heading is at workflow-map.md line 4, not 5 (quoted strings verbatim).

- STATUS: VERIFIED - 2026-09-27, verification gate (fresh, Skill tool enabled): scratch headless session answered A: 13 sdd: skills (init hidden from the model listing by design - disable-model-invocation; user-invocable slash command per the map table) and B: the map heading verbatim - 3.3/3.4/3.5 proven together

## Summary of Changes

Verification-only task: fresh headless scratch session proved the re-pointed registration's runtime footprint - SessionStart hook injects the workflow map from plugins/sdd (plugin-root resolution), sdd skills load and are invocable; review round 1 APPROVED (2 report-level MINOR parked), verified fresh with the tightened method.

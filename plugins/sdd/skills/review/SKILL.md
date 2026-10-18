---
name: review
description: Adversarial task-local review protocol - verify an implementation is real, complete, bounded, spec-aligned, and backed by mechanical evidence. Use after an implementer finishes a task, after remediation, or before accepting a task as complete.
argument-hint: <task-id>
---

# review

## Overview

This skill performs task-local adversarial review. It verifies that the implementation is real, complete, bounded, aligned with approved requirements and design, and supported by mechanical verification evidence.

This is the protocol the impl orchestrator's task-reviewer role implements
(`skills/impl/templates/task-reviewer-prompt.md`): the template is the
single source of truth for the dispatch contract, and where the two
differ, the template's verdict block wins. This document carries the
full checklist and stands alone for ad-hoc use - reviewing a change by
hand, or any context where no orchestrator dispatch exists.

**beans is the only tracker** - verdicts and outcomes are bean state
(statuses, verdict lines, tags), never checkboxes or progress notes
written into documents; when running standalone, report findings in chat
and let the caller record any beans.

Boundary terminology continuity:

- discovery identifies `Boundary Candidates`
- design fixes `Boundary Commitments`
- tasks constrain execution with `_Boundary:_`
- review rejects concrete `Boundary Violations`

## When to Use

- After an implementer returns `DONE` or `DONE_WITH_CONCERNS`
- After a remediation round for a rejected review
- Before the orchestrator completes the task bean in beans
- Before accepting a task into feature-level validation

Do not use this skill to invent missing requirements or silently reinterpret the spec.

## Inputs

Provide:

- Task ID and exact task text from the task bean's `## Brief` body section
- Relevant requirement section numbers
- Relevant design section numbers
- Spec file paths (`requirements.md`, `design.md`)
- The implementer's status report
- The task `_Boundary:_` scope constraints
- Validation commands discovered by the orchestrator
- Relevant steering excerpts when applicable
- Relevant `## Implementation Notes` entries when applicable

## First Action

Run `git diff` to inspect the actual code changes. If the diff is large or ambiguous, read the changed files directly. Do not trust the implementer report as source of truth.

## Core Principle

Read the spec yourself. Read the diff yourself. Verify mechanically where possible. Reject on concrete failures rather than interpretive optimism.
The main review question is not just "does it work?" but "does it stay inside the approved responsibility boundary without hiding new coupling?"

## Mechanical Checks

Run these checks and use the result as primary signal.

### 1. Regression Safety

- Run the project's canonical test suite using the validation commands discovered by the orchestrator.
- If tests fail, reject.

### 2. No Residual Placeholder Markers

- Check changed files for `TBD`, `TODO`, `FIXME`, `HACK`, `XXX`.
- Reject if new placeholder markers were introduced without explicit task justification.

### 3. No Hardcoded Secrets

- Check changed files for hardcoded secrets or credentials.
- Reject if concrete secret patterns are introduced.

### 4. Boundary Respect

- Compare changed files against the task `_Boundary:_` scope.
- Reject if the change spills outside the approved boundary without explicit justification.
- Reject if the implementation introduces hidden cross-boundary coordination inside what should be a local task.

### 5. RED Phase Evidence

- For behavioral tasks, verify that the implementer status report includes `RED_EVIDENCE`.
- Reject if RED evidence is missing, empty, or unrelated to the task's acceptance criteria.

### 6. Runtime-Sensitive Static Checks

- If the project already has lint or equivalent static analysis for the touched stack, run the relevant command for the task boundary.
- Pay attention to patterns that can survive typecheck/build yet fail at runtime: type-only imports used as values, missing namespace value imports for qualified-name access, unresolved globals, and newly introduced runtime-sensitive dependencies without matching boot/runtime handling.
- If no project lint command exists, perform a targeted diff-based spot check in the changed files for those patterns.
- Reject on concrete findings that create a realistic boot-time or module-load failure.

## Judgment Checks

### 7. Reality Check

- Confirm the implementation is real production code, not a placeholder, stub, fake path, or deferred-work shell.

### 8. Acceptance Criteria Coverage

- Read the task description and confirm all aspects are implemented, not only the primary happy path.

### 9. Requirements Alignment

- Read the referenced sections in `requirements.md`.
- Confirm each requirement is satisfied by concrete observable behavior.
- Use original section numbers only.

### 10. Design Alignment

- Read the referenced sections in `design.md`.
- Confirm the implementation uses the prescribed structures, interfaces, and dependency direction.
- Reject silent substitutions for design-mandated choices.

### 10.5 Boundary Audit

- Compare the implementation against the design's boundary commitments and out-of-boundary statements.
- Reject if downstream-specific behavior is pushed into an upstream boundary for convenience.
- Reject if the implementation creates new hidden dependencies, shared ownership, or undeclared coupling across adjacent boundaries.
- Reject if a task that is not an explicit integration task now behaves like one.

### 11. Test Quality

- Confirm tests prove the required behavior rather than only scaffolding.
- Confirm tests would fail if the implementation were removed or broken.

### 12. Error Handling

- Confirm relevant failure paths are handled and not silently swallowed.

## Finding Classification

Every finding is exactly one of:

- **BLOCKING** - must be fixed before the task is accepted: broken
  functionality, spec non-conformance, boundary violation, invalid or
  missing verification evidence, data loss, or security risk.
- **MINOR** - real but safe to defer with no correctness risk:
  non-blocking improvements and informational notes.

The verdict is `APPROVED` only when there are zero BLOCKING findings.
MINOR findings never affect the verdict and never enter the fix loop -
they land in the parking lot, to surface at feature finish.

## Stop / Escalate

Escalate instead of papering over the issue when:

- The approved spec is ambiguous in a correctness-critical way
- The design conflicts with what is technically possible
- Required evidence cannot be gathered
- The implementation only works by silently deviating from approved scope
- Boundary ownership cannot be determined cleanly from requirements, design, and task scope

## Common Rationalizations

| Rationalization                           | Reality                                                         |
| ----------------------------------------- | --------------------------------------------------------------- |
| “Tests pass, so approve”                  | Passing tests do not prove spec compliance or boundary respect. |
| “The extra behavior is useful”            | Extra behavior outside approved scope is still drift.           |
| “The implementer said RED was done”       | RED must be evidenced, not asserted.                            |
| “This gap is small enough to let through” | Real gaps must be rejected or escalated.                        |

## Output Format

End the review with exactly one verdict block in this shape (it extends
the task-reviewer template's verdict block: `REMEDIATION` and the extra
mechanical sub-lines are ad-hoc additions; the template at
`skills/impl/templates/task-reviewer-prompt.md` remains the single
source of truth. The orchestrator parses the heading and the
`- VERDICT:` line mechanically):

```md
## Review Verdict

- VERDICT: APPROVED | REJECTED
- TASK: <task-id>
- MECHANICAL_RESULTS:
  - Tests: PASS | FAIL (command and exit code)
  - TBD/TODO grep: CLEAN | <count> matches
  - Secrets grep: CLEAN | <count> matches
  - Static checks: PASS | FAIL | SPOT_CHECKED
  - Boundary: WITHIN | <files outside boundary>
  - Boundary audit: CLEAN | <spillover / hidden dependency findings>
  - RED phase: VERIFIED | MISSING | N/A
- FINDINGS:
  1. [BLOCKING] <specific finding with exact files/spec refs and required remediation>
  2. [MINOR] <finding>
- PARKING_LOT: <one line per MINOR finding, written to outlive this review>
- REMEDIATION: <mandatory if REJECTED>
- SUMMARY: <one sentence>
```

With no findings, FINDINGS and PARKING_LOT read `none`. Output in
English. Never approve an incomplete review: if an input is missing or
unreadable, return REJECTED with the missing input as a BLOCKING finding
and how to restore it.

---
name: debug
description: Root-cause-first debugging protocol - reproduce, isolate, confirm the root cause, then plan the minimal fix. Use when an implementer is blocked, verification fails, or repeated remediation does not converge.
argument-hint: <failure-summary>
---

# debug

## Overview

This skill is for fresh-context root cause investigation. It combines local evidence, runtime/config inspection, and external documentation or issue research when available. It is not a patch generator for guess-first debugging.

This is the protocol the impl orchestrator's debugger role implements
(`skills/impl/templates/debugger-prompt.md`): the template is the single
source of truth for the dispatch contract, and where the two differ, the
template's outcome block wins. This document carries the full method and
stands alone for ad-hoc use - investigating any failure by hand, with no
orchestrator dispatch.

**beans is the only tracker** - verdicts and outcomes are bean state
(statuses, verdict lines, tags), never checkboxes or progress notes
written into documents; when running standalone, report findings in chat
and let the caller record any beans.

## When to Use

- Implementer reports `BLOCKED`
- Reviewer rejection repeats after remediation
- Validation fails unexpectedly
- A task appears to conflict with runtime or platform reality
- The same failure survives more than one attempted fix

Do not use this skill to speculate about fixes before gathering evidence.

## Inputs

Provide:

- Exact failure symptom or blocker statement
- Error messages, stack trace, and failing command output
- Current `git diff` or summary of uncommitted failed changes
- Task brief: what was being built
- Reviewer feedback, if the failure came from review rejection
- Relevant spec file paths (`requirements.md`, `design.md`)
- Relevant requirement/design section numbers
- Relevant `## Implementation Notes`
- Runtime or environment constraints already known

## Method

### 1. Reproduce

Run the failing command. Capture and read carefully:

- Exact error text
- Stack trace or failure location
- The command that produced the failure and its exit code
- Whether the failure is deterministic or intermittent

### 2. Isolate

Shrink the failure to the smallest reproducing unit - one command, one
file, one code path.

### 3. Root-Cause

Form ONE primary hypothesis and validate it against evidence before
proposing anything:

- **Inspect local runtime and repository state**: `package.json`,
  `pyproject.toml`, `go.mod`, `Makefile`, `README*`, build config,
  `tsconfig` or equivalent language/runtime config, runtime-specific
  config, dependency versions and scripts, relevant changed files from
  `git diff`.
- **Search the web if available**: the exact error message, the
  technology + symptom combination, official documentation,
  version-specific issue trackers and migration notes. Prefer official
  docs, official repos/issues, and version- and runtime-specific
  references - for runtime/dependency issues these often hold the
  shortest path to root cause.

A hypothesis is confirmed by evidence, never by trying a fix to see what
happens. Classify the confirmed cause with one category:

- `MISSING_DEPENDENCY`
- `RUNTIME_MISMATCH`
- `MODULE_FORMAT`
- `NATIVE_ABI`
- `CONFIG_GAP`
- `LOGIC_ERROR`
- `TASK_ORDERING_PROBLEM`
- `TASK_DECOMPOSITION_PROBLEM`
- `SPEC_CONFLICT`
- `EXTERNAL_DEPENDENCY`

### 4. Plan the Minimal Fix

The smallest set of repo-fixable actions that removes the cause rather
than the symptom - each action naming its file path - plus the
verification commands that will prove resolution. Decide the outcome:

- **RESOLVED** when the cause is repo-fixable inside the current approved
  task plan: editing files, adjusting configuration, adding or correcting
  dependencies, restructuring code.
- **UNRESOLVED** when the cause genuinely requires more than that:
  - A missing prerequisite task should exist before this one
  - The current task is ordered incorrectly relative to unfinished work
  - The current task boundary is wrong and should be split or merged
  - The task is too large or ambiguous to fix safely inside the current
    implementation loop
  - A human product/requirements decision, external credentials or
    inaccessible services, hardware or unavailable external systems
  - A spec conflict or architecture problem

Do not propose a brute-force code fix as a substitute for revising
the task beans or the approved plan, and do not escalate prematurely when
the issue is plainly repo-fixable.

### 5. Budget: at most two investigation rounds

If the first confirmed hypothesis fails verification, you get exactly
one refinement. Past that, return UNRESOLVED with the root cause found
so far and the escalation block filled.

## Critical Rule

Do not propose a multi-fix shotgun plan. Identify the root cause first, then produce the smallest plausible fix plan. If the true problem is a spec conflict or architecture problem, say so directly.

## Common Rationalizations

| Rationalization                             | Reality                                                                                               |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| “This probably just needs a quick patch”    | Patch-first debugging creates rework.                                                                 |
| “Let’s try a few fixes”                     | Multi-fix guessing hides root cause.                                                                  |
| “The spec is probably wrong, I’ll adapt it” | Spec conflicts must be surfaced explicitly.                                                           |
| “The docs search is optional”               | For runtime/dependency issues, docs and version issues often contain the shortest path to root cause. |

## Output Format

End the investigation with exactly one outcome block in this shape
(identical to the debugger template's contract; the orchestrator parses
the heading and the `- OUTCOME:` line mechanically):

```md
## Debug Outcome

- OUTCOME: RESOLVED | UNRESOLVED
- ROOT_CAUSE: <1-2 sentence root cause>
- CATEGORY: MISSING_DEPENDENCY | RUNTIME_MISMATCH | MODULE_FORMAT | NATIVE_ABI | CONFIG_GAP | LOGIC_ERROR | TASK_ORDERING_PROBLEM | TASK_DECOMPOSITION_PROBLEM | SPEC_CONFLICT | EXTERNAL_DEPENDENCY
- FIX_PLAN: <RESOLVED only - numbered minimal repo-fixable actions with file paths>
- VERIFICATION: <command(s) to confirm the fix>
- STUCK: <UNRESOLVED only - what is established and why it does not resolve>
- ESCALATION: <UNRESOLVED only>
  1. Per plan: <what the plan/task bean specified>
  2. Actual: <what happened>
  3. Why it matters: <consequence>
  4. Options: accept as-is / fix now / change the plan / abort
- CONFIDENCE: HIGH | MEDIUM | LOW
```

RESOLVED always carries a root cause and a fix plan. UNRESOLVED always
carries the root cause found so far, why it is stuck, and the filled
escalation block - the main context forwards that block to the user
verbatim. Output in English.

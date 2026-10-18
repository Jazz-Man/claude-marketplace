---
name: validate-impl
description: Generative fork - the feature-level GO/NO_GO gate. Reads completion state from the feature's task beans, runs integration, coverage, design-alignment, and boundary checks with fresh evidence, and returns the verdict with remediation. Runs at feature finish (dispatched by impl) or standalone on demand.
context: fork
background: false
model: opus
---

# validate-impl - feature-level GO/NO_GO

## Entry paths - this skill is entered one of two ways

1. **Standalone**: the user invokes `/sdd:validate-impl`; this skill body
   loads as a fork and IS the task prompt.
2. **Orchestrator dispatch**: the `/sdd:impl` feature-finish step
   dispatches a fresh subagent whose prompt says
   `Apply: <abs-path>/skills/validate-impl/SKILL.md` plus the feature's
   spec and workspace paths. Reading and following this file top-to-
   bottom is exactly that dispatch's task; the SKILL.md is the single
   source of truth for both entries.

Neither path carries conversation history, and nothing below may depend
on one. Both entries do the same thing: resolve the feature from beans,
run the gate, return the verdict contract.

## Role

You are a FORK: a fresh subagent with no conversation history. This skill
body is your entire task prompt - everything you need is resolved from
beans and files below. You NEVER
ask the user questions and you NEVER dispatch subagents of your own -
you run every check yourself. When you cannot proceed, return the
BLOCKED status contract from the Return contract section. The context
that invoked you owns all dialogue with the user.

Individual tasks were reviewed during implementation. Your job is to
catch what only becomes visible when the completed tasks are viewed
together.

Boundary terminology continuity:

- discovery identifies `Boundary Candidates`
- design fixes `Boundary Commitments`
- tasks constrain execution with `_Boundary:_`
- feature validation checks for cross-task `Boundary Violations`

## Hard rules

1. Bash is limited to the beans CLI, validation commands, greps, and
   read-only git inspection.
2. **This skill writes no beans** and flips no checkboxes anywhere.
   Completion state is READ from the task beans under the feature epic -
   beans is the tracker, documents are static.
3. **No user questions.** Blocked means return BLOCKED, not stop-and-ask.
4. **Fresh evidence only.** Reported success in implementer reports and
   review packages is reference material, never evidence. Run every
   mechanical check against the current code state yourself and use the
   actual output and exit codes.
5. **English output** - fixed; no per-spec language configuration exists.

## What this skill does NOT do

It does not replace task-local review. It does not re-check individual
task acceptance criteria, per-file reality (mock/stub detection), or
single-task spec alignment. Its one question: when the completed tasks
are viewed together, do they respect the designed boundary seams and
dependency direction - and is the feature actually finished and
verifiable?

## Step 1 - Resolve the active feature

Query beans: `beans list --json -t epic -s in-progress`.

- **Exactly one** -> that epic is the active feature. Resolve its spec
  directory from the `Spec path:` line in the bean body
  (`.sdd/specs/<feature>/`); if the body names none, return BLOCKED
  asking the main context where the feature lives.
- **None** -> return BLOCKED: no active feature; point to
  `/sdd:spec-init` (a spec is already shaped) or `/sdd:discovery`
  (nothing shaped yet).
- **More than one** -> return BLOCKED: the single-active-feature rule is
  violated; the main context resolves it with the user.

## Step 2 - Read completion state from beans

Query the epic's children, e.g.
`beans query --json '{ bean(id: "<epic-id>") { children { id title status body } } }'`.

- **No task beans at all** -> return BLOCKED pointing to
  `/sdd:spec-tasks`: the plan has not been generated.
- **Every task bean completed or scrapped** -> proceed to the full gate
  (Step 3). A task bean carrying a `## Blocker` note is not complete -
  it reads `in-progress` and counts as open.
- **Any task bean open** (`todo`, `draft`, `in-progress`) -> the feature
  is not finished; the full battery is predetermined to fail. Return
  DONE with `DECISION: NO_GO`, the open tasks as the blocking finding,
  and REMEDIATION pointing to `/sdd:impl` - and say explicitly that
  integration checks were skipped because the feature is incomplete.

## Step 3 - Load inputs and discover validation commands

Read, under the spec directory from Step 1:

- `.sdd/specs/<feature>/requirements.md` - REQUIRED. Missing -> return
  BLOCKED pointing to `/sdd:spec-requirements`.
- `.sdd/specs/<feature>/design.md` - the conformance reference:
  boundary commitments, structure map. Missing -> return BLOCKED
  pointing to `/sdd:spec-design`.
- `.sdd/specs/<feature>/workspace/` - review packages and other large
  evidence blobs; the minor-findings parking lot lives in the task
  beans' `## Parking lot` sections (Step 2). Reference only: claims
  there are never evidence.
- Steering: already in your context (project memory, loaded at session
  start) - apply it; do not re-read the files.
- The verify-completion protocol - the fresh-evidence gate you apply in
  Step 5, claim type `FEATURE_GO`. Its file sits in a sibling skill
  directory of this one; resolve it from the absolute path of this file
  in your prompt: `<given-path>/../verify-completion/SKILL.md` (neither
  `${CLAUDE_SKILL_DIR}` nor `${CLAUDE_PLUGIN_ROOT}` expands in a
  plain-file-read dispatch). Hard rule 4 and Step 5 restate its core
  discipline regardless.

**Feature boundary scope**: translate the tasks' `_Boundary:_`
annotations into path patterns via design.md's structure map; when no
boundary is declared or the translation is not confident, use the full
working tree.

**Discover canonical validation commands**: inspect repository-local
sources of truth in this order - project scripts/manifests
(`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, app
manifests), task runners (`Makefile`, `justfile`), CI/workflow files,
existing e2e/integration configs, then `README*`. Derive the full-test
command and the lightest trustworthy smoke command. Prefer commands
already used by repo automation over ad hoc pipelines.

## Step 4 - Run the gate

### Mechanical checks (run them; output and exit codes are the signal)

**A. Full test suite**

- Run the canonical full-test command. Use the exit code.
- Tests fail -> NO_GO. No judgment needed.
- No canonical test command identifiable -> MANUAL_VERIFY_REQUIRED.

**B. Residual placeholder markers**

- `grep -rn "TBD\|TODO\|FIXME\|HACK\|XXX" <feature-boundary-paths>`
- Matches introduced by this feature -> Warning finding.

**C. Residual hardcoded secrets**

- `grep -rni "password\s*=\|api_key\s*=\|secret\s*=\|token\s*=" <feature-boundary-paths>`
  (case-insensitive)
- Matches that are not environment-variable references -> Critical
  finding.

**D. Runtime liveness (smoke boot)**

- Run the canonical smoke command proving the built artifact starts and
  reaches its first usable state (root URL load, Electron launch-ready,
  CLI `--help`, service health endpoint - whatever fits the app shape).
- Boot crash, unhandled exception, module-load failure, native ABI
  mismatch, missing required env/config -> NO_GO.
- No trustworthy smoke command, or the runtime environment is
  unavailable -> MANUAL_VERIFY_REQUIRED.

### Judgment checks (read code, compare to spec)

**E. Cross-task integration**

- Where tasks share interfaces, data models, or API contracts: Task A's
  output format matches Task B's expected input.
- No conflicting assumptions between tasks (naming, error codes, data
  shapes); shared state (schemas, config, environment) consistent.
- Integration happens at the designed seams, not by leaking one
  boundary's behavior into another.

**F. Requirements coverage gaps**

- Every requirement section maps to at least one completed task;
  identify cross-cutting requirements no single task fully covers.
- Use the original section numbering from requirements.md; never invent
  `REQ-*` aliases.

**G. Design end-to-end alignment**

- Component graph, integration patterns, and dependency direction match
  design.md (no upward imports); File Structure Plan matches the actual
  layout. Report drift.

**G.5 Boundary audit**

- Compare completed work against the design's Boundary Commitments,
  Out of Boundary, Allowed Dependencies, and Revalidation Triggers.
- Cross-task spillover (one area quietly absorbing another boundary's
  responsibility), downstream-specific workarounds embedded upstream,
  new hidden dependencies or undeclared shared ownership -> findings.
- If a revalidation trigger fired, verify the affected adjacent
  integration points were actually re-checked.

**H. Blocked tasks and implementation notes**

- Open task beans and unresolved `## Blocker` notes (Step 2) and their
  impact on feature completeness.
- `## Notes` one-liners in the task beans that need cross-cutting
  attention.

## Step 5 - Classify ownership, apply verify-completion, report

**Ownership** (before writing any remediation):

- `LOCAL` - the defect belongs to this feature.
- `UPSTREAM` - the root cause belongs to a dependency, foundation,
  shared platform, or earlier spec. Do not collapse it into local
  remediation: name the owning upstream spec and which dependent specs
  need revalidation after the upstream fix.
- `UNCLEAR` - ownership cannot be established from the evidence.

**Fresh-evidence discipline**: before returning any decision, apply the
verify-completion protocol, claim type `FEATURE_GO` - a passing test
suite alone is insufficient; the evidence must span full-suite, runtime
liveness, coverage, integration, design alignment, and completion
state.

## Return contract

**To the fork (your final message).** Return exactly this block - the
caller parses the heading, the `- STATUS:` line, and the `- DECISION:`
line mechanically:

```
## Validation Summary
- STATUS: <DONE | BLOCKED>
- DECISION: <GO | NO_GO | MANUAL_VERIFY_REQUIRED>
- MECHANICAL_RESULTS:
  - Tests: PASS | FAIL (command and exit code)
  - TBD/TODO grep: CLEAN | <count> matches
  - Secrets grep: CLEAN | <count> matches
  - Smoke boot: PASS | FAIL | MANUAL_REQUIRED
- INTEGRATION:
  - Cross-task contracts: <status>
  - Shared state consistency: <status>
  - Boundary audit: <status>
- COVERAGE:
  - Requirements mapped: <X/Y sections covered>
  - Coverage gaps: <uncovered requirement sections, or none>
- DESIGN:
  - Architecture drift: <findings or none>
  - Dependency direction: <violations or none>
  - File Structure Plan vs actual: <match/mismatch>
- INCOMPLETE_TASKS: <open task beans, or none>
- OWNERSHIP: LOCAL | UPSTREAM | UNCLEAR
- UPSTREAM_SPEC: <feature name | N/A>
- REMEDIATION: <mandatory when NO_GO - specific, actionable steps; vague feedback is not acceptable>
- BLOCKERS: <BLOCKED only - the condition and the command to run>
```

Return `GO` only when every check passed. Return `NO_GO` for concrete
failures and `MANUAL_VERIFY_REQUIRED` when a mandatory validation could
not be executed - and never treat a feature as complete on a manual-
verify result. Do not return GO if the feature only works by smearing
responsibilities across boundaries, even when tests pass.

**Remediation is not yours.** When dispatched by the impl orchestrator
(feature finish), the orchestrator owns all loop budgets. `GO` plus an
approved whole-branch review ends the phase.

**To the main context (standalone entry only).** On DONE:
present the decision with its evidence highlights (the block above is
the report; do not dump spec files into chat), then AskUserQuestion:
**GO** - suggest completing the feature: finish via `/sdd:impl`
(feature-finish flow) or complete the epic bean per the global beans
guide; **NO_GO** - remediate via `/sdd:impl` or manual work, then
re-invoke `/sdd:validate-impl`; **MANUAL_VERIFY_REQUIRED** - state the
exact missing validation or environment prerequisite; the feature is
not complete until it is resolved. On BLOCKED: present the condition and
the named command, then AskUserQuestion on how to proceed.

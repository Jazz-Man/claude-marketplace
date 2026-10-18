---
name: impl
description: Execute the active feature's approved task plan one task at a time - dispatch subagent implementers and reviewers, run the bounded fix loop, verify completion with fresh evidence, and stop after every task for the user's review.
argument-hint: [task-id]
---

# impl - execution orchestrator

## Role

You run INLINE in the main conversation. You never implement or review code
yourself: all execution goes to subagents dispatched via the Agent tool
(general-purpose type; the subagent's role is defined by the prompt-template
files in this skill's `templates/` directory). You own the loop, the beans
state, the workspace files, and every interaction with the user.

Division of labor:

- **Subagents** implement, review, and debug. They NEVER ask the user
  questions. They return status contracts with structured explanations, and
  you formulate the AskUserQuestion.
- **You** resolve state from beans, translate task boundaries into dispatch
  payloads, build review packages, parse contracts, adjudicate, update
  beans, and gate every stop point.

## Hard rules

1. Bash use is limited to read-only git (`git diff`, `git status`, `git log`,
   `git merge-base`), the beans CLI, the plugin's
   `bin/` helpers (`sdd-gate`, `sdd-verdict`, `sdd-phase`, and `sdd-next`
   are read-only; `sdd-promote` is the sole write helper — strictly
   `beans update <id> -s todo`), and file operations.
2. **Paths and ids, never contents.** Dispatch prompts carry file paths,
   path patterns, and bean ids, never file contents. Subagents read
   files, run `beans show` on the ids, and Glob-expand patterns
   themselves.
3. **Resolve plugin variables before dispatch.** `${CLAUDE_SKILL_DIR}` and
   `${CLAUDE_PLUGIN_ROOT}` expand in your context only; subagent prompts are
   plain text. Always pass resolved absolute paths to templates and protocols.
4. **Model policy is pinned, never the agent's choice.** Set the `model`
   parameter in every Agent dispatch exactly as follows:

   | Dispatch                                                           | Model  |
   | ------------------------------------------------------------------ | ------ |
   | Implementer - initial dispatch and fix rounds 1-3                  | sonnet |
   | Implementer - fix rounds 4-5, and the retry after a RESOLVED debug | opus   |
   | Implementer - feature-finish remediation rounds                    | sonnet |
   | Debugger                                                           | opus   |
   | Task-reviewer, scoped re-review, code-reviewer, validate-impl      | opus   |

5. **Subagents never ask the user directly.** Any question a subagent raises
   arrives as a status contract; you decide whether it is answerable from the
   repo/spec files or must go to the user via AskUserQuestion.
6. **beans is the only tracker.** Never flip checkboxes or write progress,
   approval, or blocked state into documents. The task beans ARE the
   plan (spec Revision 4 - no plan document exists), and the bean GRAPH
   is the sequence: statuses and `blockedByIds` edges, never checklists
   or step lists inside a bean body - a task that needs steps gets child
   beans from `/sdd:spec-tasks`, not a `- [ ]` list the next agent must
   scan for. The global beans guide's checkbox convention does NOT apply
   to sdd task beans: never flip unchecked/checked box markers in ANY
   body, even a legacy brief that carries them - a leaf's progress is
   its status plus appended `## Report`/`## Notes` lines; a brief with a
   step checklist is legacy debt: finish the whole leaf or surface it
   for decomposition, never tick steps off. Execution state lives in
   beans and workspace files only. Lifecycle follows the global beans
   guide.
7. **Single active feature.** Exactly one feature is active at any time (spec
   5.5). You never accept a feature argument; you resolve the feature from
   beans.
8. **Workspace is append-only.** Never rewrite or delete
   `.sdd/specs/<feature>/workspace/` artifacts; append new rounds and
   sections.
9. **The task bean is the lifecycle record; verdicts dual-write**
   (spec 8.1, Revision 7). Task-bean bodies carry the append-only
   sections `## Brief`, `## Report`, `## Notes`, `## Validation`,
   `## Parking lot` — append beneath a section, never rewrite or
   reorder it. Every 8.1 verdict/outcome/status you record on a bean
   ALSO sets its lowercase-hyphen mirror tag on that same bean, and a
   new round that flips a verdict removes the old tag of the family in
   the same call
   (`beans update <id> --remove-tag <old> --tag <new>`; plain `--tag`
   when no tag of that family is set):

   | Contract line (writer)                                                                        | Mirror tags                                                                                   |
   | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
   | implementer `STATUS: DONE` / `DONE_WITH_CONCERNS`                                             | `status-done` / `status-done-with-concerns`                                                   |
   | review + re-review `VERDICT: APPROVED` / `REJECTED`                                           | `verdict-approved` / `verdict-rejected`                                                       |
   | debugger `OUTCOME: RESOLVED` / `UNRESOLVED`                                                   | `outcome-resolved` / `outcome-unresolved`                                                     |
   | verification `STATUS: VERIFIED` / `NOT_VERIFIED` / `MANUAL_VERIFY_REQUIRED`                   | `verification-verified` / `verification-not-verified` / `verification-manual-verify-required` |
   | validate-impl `DECISION: GO` / `NO_GO` / `MANUAL_VERIFY_REQUIRED` (recorded on the epic bean) | `decision-go` / `decision-no-go` / `decision-manual-verify-required`                          |

   `BLOCKED` and `NEEDS_CONTEXT` get no tag — transient control
   states, not records. Phase beans carry `validated` (Revision 6,
   already wired). You are the single tag writer: subagents never set
   tags. The implementer's ONE bean write is its `--body-append` of
   `## Report` / `## Notes` (its role prompt's carve-out); reviewer and
   debugger subagents are read-only, and you record their outcomes.
   The loop is sequential — one task at a time — so plain appends are
   safe; any path that could write a bean in parallel with another
   writer must guard every append with `--if-match` (etag from
   `beans show <id> --etag-only`).

## Step 0 - Resolve state from beans (every cycle)

Run this at the start of EVERY cycle, including after a user "continue". Never
trust session memory of prior cycles - state is re-derived from beans each
time.

**Run the mechanical helpers first** (both read-only):

```
${CLAUDE_PLUGIN_ROOT}/bin/sdd-phase impl     # the full impl gate
${CLAUDE_PLUGIN_ROOT}/bin/sdd-next           # the next actionable task
```

- `sdd-phase impl` nonzero -> STOP: its one-line stderr names the failed
  gate and the fixing `/sdd:<name>` command. The inline procedure below
  is the canonical fallback and explains what the gate checked.
- `sdd-next` prints `ROLLUP:` lines first: complete each pending major
  container (`beans update <id> -s completed` with a one-line
  `## Summary of Changes` - a major is done exactly when all its leaves
  are), then re-run `sdd-next`. Its `NEXT:` line is the task for this
  cycle (an in-progress leaf wins - interrupted runs resume; otherwise
  the lowest number among unblocked leaves). `FINISHED` -> Feature
  finish. A drafts or stuck diagnosis -> STOP and report as the message
  says (drafts point to the `/sdd:spec-tasks` approve gate).

The items below are the inline procedure the helpers wrap - step
through them when a helper is unavailable or its failure needs
adjudication:

1. **Resolve the active feature**: query beans for epic beans with status
   `in-progress` (e.g. `beans list --json -t epic -s in-progress`).
   - **Exactly one** -> that epic is the active feature. Resolve its spec
     directory from the epic bean body (recorded at feature creation); if the
     body names no directory and `.sdd/specs/` has no unambiguous match, stop
     and ask the user which directory the feature lives in.
   - **None** -> stop: no feature is being implemented. Tell the user to start
     one via `/sdd:spec-init` (spec already shaped) or `/sdd:discovery`
     (nothing shaped yet).
   - **More than one** -> beans violates the single-active-feature rule.
     Stop and resolve it via AskUserQuestion, one question per extra epic:
     complete it / scrap it (you run either as a beans update on the user's
     answer) / stop and the user fixes beans manually. Then re-invoke
     `/sdd:impl`.
2. **Phase-gate check**: query the epic's children once -
   `beans query --json '{ bean(id: "<epic-id>") { children { id title status tags blockedByIds body } } }'`
   (the resolved relation `blockedBy` is broken in beans v0.4.2 - always
   read `blockedByIds`) - and reuse the result for the task queue below.
   Identify the phase beans by exact title plus the `phase` tag:
   `Phase — requirements`, `Phase — design`, `Phase — tasks`.

   > **Gate:** ALL THREE phase beans must exist and be `completed` -
   > `completed` IS the approval record (spec Revision 5).

   (`${CLAUDE_PLUGIN_ROOT}/bin/sdd-gate <epic-id>` wraps this whole
   check - phases + freshness + queue readiness - as a read-only script;
   the inline procedure stays canonical.)

   - **Any of the three phase beans missing** -> partial-legacy state:
     stop and point the user to `/sdd:spec-init` (a heal run with the
     same feature name creates missing phase beans idempotently).
   - **First phase bean in flow order (requirements -> design -> tasks)
     not `completed`** -> stop naming its command:
     `/sdd:spec-requirements`, `/sdd:spec-design`, or `/sdd:spec-tasks`
     respectively.

   **Freshness gate (spec Revision 6)** - on top of `completed`, the
   requirements and design phase beans must carry the `validated` tag
   (read from the children query's `tags`), and the LATEST line of
   the form `Doc-hash: <sha256>` in each one's `## Validation` body
   section (read from the query's `body`) must equal the CURRENT hash
   of the document it validated - validation rounds append, so only
   the last `Doc-hash:` counts; an earlier round's line never wins.
   The tasks phase bean carries neither - validation is scoped to
   requirements and design only. Recompute both hashes yourself:

   - `shasum -a 256 .sdd/specs/<feature>/requirements.md` vs the
     `Doc-hash:` on `Phase — requirements`
   - `shasum -a 256 .sdd/specs/<feature>/design.md` vs the
     `Doc-hash:` on `Phase — design`

   (The recorded hash was computed at the GO moment, after the
   validator's fixes; any later edit - committed or not - changes the
   current one.)

   - **Tag missing, or the `Doc-hash:` line absent, on requirements
     or design** -> the phase closed without its validation record:
     stale. STOP - never proceed past it, never re-validate silently.
     Present the four-part format - 1. Per plan: completed
     requirement/design phases carry `validated` and a `Doc-hash:`
     line. 2. Actual: `<bean>` is missing `<the tag | the Doc-hash
line>`. 3. Why it matters: the approval's validation evidence
     does not exist. 4. Options: re-run the phase's command to revise
     and re-validate / stop - naming `/sdd:spec-requirements` or
     `/sdd:spec-design`.
   - **Hash mismatch** -> the document changed after its validation
     (committed or not): stale. Same STOP, same four parts, naming
     the re-validation command for the mismatched document
     (`/sdd:spec-requirements` for requirements.md,
     `/sdd:spec-design` for design.md). Staleness is mechanical and
     the decision is the user's: you never re-validate, never
     overwrite a `Doc-hash:`, and never continue past a stale gate.

3. **Resolve the task queue**: the epic's task TREE - the children query
   returns the majors (feature-type containers), any flat undecomposed
   tasks, and the phase beans; query each major's children for the
   leaves. Work happens on LEAVES only; a major is never executed and
   completes by rollup when all its leaves are completed/scrapped. A
   leaf is **unblocked** when none of its blocked-by beans - and none of
   its ancestors' blocked-by beans - is incomplete (`todo`, `draft`, or
   `in-progress`; completed and scrapped blockers do not block). A leaf
   is **actionable** when it has status `todo` or `in-progress`, is
   unblocked, and its body carries no unresolved `## Blocker` note (the
   blocked-task encoding written by Step 6; a note is unresolved until
   the task completes or the user explicitly clears it). Task beans with
   status `draft` are NEVER auto-selected - `draft` means
   generated-not-approved (spec Revision 5); the `/sdd:spec-tasks`
   approve gate promotes them to `todo`.
4. **Select the task**:
   - No argument: the lowest-numbered actionable leaf; an `in-progress` leaf
     wins over a `todo` leaf with the same number (interrupted run resumes
     there). If a task would be selected but for an unresolved `## Blocker`
     note, do NOT auto-select it: report the task and its recorded root
     cause, then ask via AskUserQuestion - retry the blocked task now /
     skip it for this run (select the next actionable task; the note
     re-surfaces it on the next invocation) / stop.
   - `[task-id]` argument (e.g. `3.2`): map the plan-style id to the task
     bean by matching the task number in the bean's title or body, then that
     task, provided it belongs to the active feature and is not completed or
     scrapped; if it is effectively blocked, stop and report the blocking
     beans.
5. **Terminal checks**:
   - No task beans at all -> stop: the plan has not been generated. Point the
     user to `/sdd:spec-tasks`.
   - No actionable tasks remain and every task bean is completed or scrapped
     -> go to **Feature finish**.
   - No actionable tasks remain for any other reason (unresolved blocked-by
     relations, or `## Blocker` notes the user declined to retry) -> stop and
     report the stuck tasks with their blockers; the user must resolve them
     (or change the plan) before impl can proceed.

## Step 1 - Prepare the task

1. **Baseline the working tree**: run `git status --porcelain` and note any
   pre-existing uncommitted changes. This baseline lets review packages
   exclude unrelated user work and lets you tell pre-existing changes from
   task changes.
2. **Discover validation commands**: inspect repository-local sources of
   truth (project manifests, task runners, CI workflow files, then README)
   and derive the canonical set for this repo - test, build, and the lightest
   trustworthy smoke check. Keep the full set in your context; pass only the
   task-relevant subset into dispatch prompts.
3. **Mark the task started**: `beans update <task-id> -s in-progress`.
4. **Resolve the dispatch inputs** - no brief file is written: the task
   bean's `## Brief` body section IS the brief (spec Revisions 4+7); the
   subagent reads the bean itself. You resolve:
   - The task bean id (from Step 0) for the dispatch payload.
   - The boundary translated into path patterns (use design.md's
     structure map); note `full working tree` when no boundary is
     declared or the boundary cannot be translated confidently.
   - The task-relevant validation command subset (from the validation
     discovery above).
   - The learnings source: the ids of the feature's completed task
     beans — their `## Notes` sections carry the one-liners past
     implementers appended. None completed yet -> omit the learnings
     line from the dispatch.

## Step 2 - Dispatch the implementer

Read `${CLAUDE_SKILL_DIR}/templates/implementer-prompt.md`, resolve it to an
absolute path, and dispatch:

```
Agent(
  description: "Implement task <N>",
  subagent_type: general-purpose,
  model: sonnet,
  prompt: (paths and ids only)
    Role prompt: <abs-path>/skills/impl/templates/implementer-prompt.md
                 (read it first and follow it exactly)
    Task bean:   <task-bean-id> (run `beans show <task-bean-id>` - its
                 ## Brief section IS the task brief; per your role
                 prompt, append your ## Report and any ## Notes
                 one-liners to this bean before returning)
    Spec files:  .sdd/specs/<feature>/requirements.md,
                 .sdd/specs/<feature>/design.md
    Steering:    .claude/rules/ of this project (only when present)
    Code scope:  <boundary path patterns, or repo root>
    Code analysis: apply the `lsp-code-analysis` skill (LSP first, Grep/Glob fallback)
    Validation:  <task-relevant command subset>
    Learnings:   <completed task bean ids, if any> (their ## Notes
                 sections carry the one-liners - read before you start)
    Return exactly the ## Status Report block your role prompt defines.
)
```

## Step 3 - Handle the status contract

Parse the implementer's final message for the exact block:

```md
## Status Report

- STATUS: <DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT>
```

Parse discipline: only the exact `## Status Report` block and its `- STATUS:`
line count. If the block is missing, ambiguous, or replaced with prose, resume
the agent once (SendMessage) requesting the exact structured block only. Never
infer status from surrounding prose. The report must list the files touched
this round (field shape defined by the role prompt).

| STATUS               | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DONE`               | Hold the contract in context; go to Step 4.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `DONE_WITH_CONCERNS` | Same as `DONE`, plus hold the concerns: they surface at the STOP in the four-part format; the implementer's `## Report` records them and Step 8 appends anything further. Review still runs - concerns do not bypass it.                                                                                                                                                                                                                                       |
| `BLOCKED`            | Go to Step 6 (debug protocol).                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `NEEDS_CONTEXT`      | The report states exactly what is missing. If it is trivially answerable from repo or spec files, answer it yourself and resume the implementer (SendMessage) with the answer. Otherwise formulate an AskUserQuestion for the user, then resume the implementer with their answer. Context rounds do not count against the fix-loop budget - but if the implementer repeats `NEEDS_CONTEXT` with no new specifics after being answered, treat it as `BLOCKED`. |

On `DONE` or `DONE_WITH_CONCERNS`, two bean duties are yours before
Step 4 (Hard rule 9): confirm the task bean now carries the
implementer's `## Report` (`beans show <task-id>`; if the section is
absent, resume the implementer once requesting the append - the append
precedes the contract by its role prompt), and set the status mirror
tag for the parsed STATUS (`status-done` /
`status-done-with-concerns`, removing a prior round's tag of the
family in the same call).

## Step 4 - Build the review package and dispatch the reviewer

1. **Build** `workspace/review-package-<N>.md` (append a new
   `# Round <K>` section per review round; never rewrite earlier rounds):
   - Scope: the task's boundary paths when declared, else the full working
     tree. Unrelated uncommitted user work (the Step 1 baseline outside the
     scope) never enters the package.
   - Contents: header (task ID, requirement IDs from the task bean's
     `_Requirements:` metadata, scope, baseline note), the findings
     under remediation (rounds 2+), the scoped diffstat and diff
     (`git diff -- <paths>`), and full contents of untracked in-scope files
     (from `git status --porcelain`).
   - `git diff` and `git status` are the only git calls used here; the
     working tree vs HEAD is always the task's complete change set.
2. **Dispatch** the task-reviewer. Read
   `${CLAUDE_SKILL_DIR}/templates/task-reviewer-prompt.md`, resolve paths, and
   dispatch:

```
Agent(
  description: "Review task <N>",
  subagent_type: general-purpose,
  model: opus,
  prompt: (paths and ids only)
    Role prompt:     <abs-path>/skills/impl/templates/task-reviewer-prompt.md
    Review protocol: <abs-path>/skills/review/SKILL.md (apply it to this task)
    Package:         .sdd/specs/<feature>/workspace/review-package-<N>.md
    Spec files:      .sdd/specs/<feature>/requirements.md, design.md
    Code analysis:   apply the `lsp-code-analysis` skill for code claims (LSP first, Grep/Glob fallback)
    Task bean:       <task-bean-id> (its ## Brief carries the task text and
                     requirement IDs - verify against it independently;
                     the implementer's contract is not evidence)
    Return exactly the ## Review Verdict block your role prompt defines.
)
```

3. **Parse the verdict**:

```md
## Review Verdict

- VERDICT: <APPROVED | REJECTED>
```

Same parse discipline as Step 3 (exact block and `- VERDICT:` line only).
`REJECTED` findings must be marked blocking or minor.

**Record the round on the task bean** (every review round - first
review and each re-review): ONE line appended under `## Validation`:

```
- VERDICT: <APPROVED | REJECTED> - <date>, review round <K>, package: workspace/review-package-<N>.md
```

(the package pointer rides the round line; `<K>` counts review cycles,
`<N>` is the task's package file), plus the verdict mirror tag per
Hard rule 9 (`verdict-approved` / `verdict-rejected`, old family tag
removed in the same call).

- **APPROVED** -> Step 7 (verification gate).
- **Minor findings** never enter the fix loop regardless of verdict:
  each lands as a one-liner appended under `## Parking lot` in the
  task bean (the parking lot, surfaced at feature finish).
- **REJECTED** -> Step 5.

## Step 5 - Fix loop (REJECTED verdicts)

One counter per review cycle; it resets only when the task closes
(APPROVED + verified), not on intermediate verdicts.

- **Rounds 1-3**: resume the SAME implementer agent via SendMessage with the
  blocking findings, the scoped package path, and the requirement to list
  every file touched this round. Model stays as dispatched (sonnet).
- **Rounds 4-5**: dispatch a FRESH implementer via the Agent tool with
  `model: opus` - full dispatch data from Step 2 plus the blocking findings
  and a short summary of prior rounds (paths, not transcripts).
- **Every round**: after the implementer returns `DONE`/`DONE_WITH_CONCERNS`,
  apply the Step 3 bean duties (confirm its `## Report` addendum landed;
  flip the status mirror tag if the round's STATUS differs), append a
  `# Round <K>` scoped section to the review package covering the
  files changed this round only, then dispatch a scoped re-review (read
  `${CLAUDE_SKILL_DIR}/templates/re-review-prompt.md`, resolve, dispatch with
  `model: opus`, package + findings paths, plus the code-analysis
  instruction - apply the `lsp-code-analysis` skill). Parse the same
  `## Review Verdict` block and record the round on the task bean per
  Step 4 (`## Validation` line + package pointer + verdict mirror
  tag); park the re-review's `PARKING_LOT` one-liners under
  `## Parking lot`.
- **APPROVED** -> Step 7. **Five rounds exhausted** -> Step 6.

Adjudication: if the implementer substantively disputes the same finding two
rounds in a row and you cannot settle it from the spec, stop burning rounds -
escalate to the user with the four-part format and an AskUserQuestion
(enforce the finding / accept the dispute / plan change / abort).

## Step 6 - Blocked path (debug protocol)

Entered when: the implementer returns `BLOCKED`, a `NEEDS_CONTEXT` loop
degenerates, or the fix loop exhausts five rounds.

1. **Dispatch the debugger** - fresh context, it receives failure evidence,
   not the failed implementation history. Read
   `${CLAUDE_SKILL_DIR}/templates/debugger-prompt.md`, resolve, dispatch:

```
Agent(
  description: "Debug task <N> failure",
  subagent_type: general-purpose,
  model: opus,
  prompt: (paths and ids only)
    Role prompt:      <abs-path>/skills/impl/templates/debugger-prompt.md
    Debug protocol:   <abs-path>/skills/debug/SKILL.md (apply it)
    Failure summary:  <one-line symptom>
    Task bean:        <task-bean-id> (its ## Brief section says what was
                      being built)
    Review evidence:  .sdd/specs/<feature>/workspace/review-package-<N>.md
                      (if built; on a first-round BLOCKED no package exists
                      yet - the debugger relies on the working tree)
    Working tree:     inspect read-only (git diff / git status)
    Code analysis:    apply the `lsp-code-analysis` skill (LSP first, Grep/Glob fallback)
    Return exactly the ## Debug Outcome block your role prompt defines.
)
```

2. **Parse the outcome**:

```md
## Debug Outcome

- OUTCOME: <RESOLVED | UNRESOLVED>
```

Same parse discipline. `RESOLVED` carries a root cause and a fix plan;
`UNRESOLVED` carries the root cause found so far and why it is stuck.

**Record the round on the task bean**: ONE line appended under
`## Validation` —
`- OUTCOME: <RESOLVED | UNRESOLVED> - <date>, debug round <n>` — plus
the outcome mirror tag per Hard rule 9 (`outcome-resolved` /
`outcome-unresolved`, old family tag removed in the same call). The
debugger itself writes nothing; you record its outcome.

3. **Handle it**:
   - `RESOLVED` -> dispatch a fresh implementer (`model: opus`) with the fix
     plan plus the Step 2 dispatch data, then a scoped re-review. Still
     failing -> next debug round.
   - `UNRESOLVED`, or two debug rounds exhausted -> **mark the task blocked
     in beans**: append a `## Blocker` note to the task bean body (root
     cause, rounds attempted, date) and leave the status `in-progress`.
     Escalate: four-part format plus an AskUserQuestion with options - you
     intervene then re-invoke `/sdd:impl` to retry / skip to the next
     actionable task for the rest of this run (the `## Blocker` note keeps it
     out of auto-selection per Step 0 and re-surfaces it on the next
     invocation) / escalate to plan change / abort the feature.

## Step 7 - Verification gate (fresh evidence)

Before any completion claim, apply the verify-completion protocol
(`${CLAUDE_PLUGIN_ROOT}/skills/verify-completion/SKILL.md`) inline, claim
type `TASK`:

- Re-run the task-relevant validation commands yourself via Bash. Reported
  success from the implementer is not evidence; only fresh output and exit
  codes from the current code state count.
- **Record the result on the task bean** (every run): ONE line appended
  under `## Validation` —
  `- STATUS: <VERIFIED | NOT_VERIFIED | MANUAL_VERIFY_REQUIRED> - <date>, verification gate` —
  plus the verification mirror tag per Hard rule 9 (old family tag
  removed in the same call).
- `VERIFIED` -> Step 8.
- `NOT_VERIFIED` -> the evidence gap becomes a blocking finding; re-enter the
  Step 5 fix loop under the same cycle counter.
- `MANUAL_VERIFY_REQUIRED` -> complete the beans/workspace updates that are
  safe, then STOP with the missing verification presented as a concern in the
  four-part format.

## Step 8 - Record state

1. Concerns the implementer's `## Report` does not already carry
   (verification gaps, accepted disputes): one line each, appended to
   the task bean's `## Report`.
2. Cross-cutting learnings for later tasks the implementer did not
   already record: one line each, appended to the task bean's
   `## Notes` (later dispatches read the completed beans' `## Notes`
   as their learnings input).
3. Complete the task bean: `beans update <task-id> -s completed` with a short
   `## Summary of Changes` appended per the global beans guide.

## Step 9 - STOP (after every task)

**The stop report is SHORT**: task ID, final status, review verdict, and
verification result; optionally ONE line of test results if tests ran. No
diff summary, no changed-file list, no beans recap.

Present any concern or deviation in the four-part format, verbatim:

```
1. Per plan: <what the task bean's ## Brief specified>
2. Actual: <what happened>
3. Why it matters: <consequence>
4. Options: accept as-is / fix now / change the plan / abort
```

Then ask via AskUserQuestion (recommended option first, labeled):

1. **Continue** (Recommended) - proceed to the next task (Step 0 re-resolves
   state from beans), or to Feature finish when no tasks remain.
2. **Revise this task** - you supply feedback; the orchestrator reopens the
   task bean (`-s in-progress`), runs one fix cycle with your feedback as the
   input (same implementer via SendMessage where possible, else fresh sonnet
   dispatch), scoped re-review, verification gate, beans update, and STOPs
   again.
3. **Escalate to plan change** - stop the run. The plan (the task beans)
   must be revised before impl resumes; the user drives that revision
   (possibly via `/sdd:spec-tasks`).
4. **Abort feature** - cancellation is a first-class outcome: run
   `beans update <epic-id> -s scrapped` and the same for every task bean of
   the feature - plan tasks AND the three `phase` gate beans, which are its
   task-type children too (append a one-line reason first), then stop. The
   branch, spec, workspace, and bean files are the user's to carry away;
   nothing else is touched.

## Feature finish

Entered from Step 9 "Continue" when all task beans are completed (or directly
from Step 0 when invoked in that state).

1. **Whole-branch review**. Build `workspace/review-package-final.md`: the
   committed diff since the feature branch diverged from the repository's
   default branch (divergence point via `git merge-base <default-branch>
HEAD`, diff via `git diff <base>...HEAD`) plus the uncommitted
   working-tree remainder. Then
   dispatch the code-reviewer: read
   `${CLAUDE_SKILL_DIR}/templates/code-reviewer-prompt.md`, resolve, dispatch
   with `model: opus`, package + spec paths + the feature's task bean
   ids, plus the code-analysis instruction (apply the `lsp-code-analysis`
   skill) (read-only `beans show`: their `## Notes` sections are the
   learnings, their `## Parking lot` sections the parked minors).
   Parse `## Review Verdict` as usual; blocking findings start a
   remediation round. Record the round on the EPIC bean: ONE line
   under `## Validation` —
   `- VERDICT: <APPROVED | REJECTED> - <date>, whole-branch review, package: workspace/review-package-final.md` —
   plus the verdict mirror tag per Hard rule 9 — and park the
   code-reviewer's `PARKING_LOT` one-liners under the EPIC bean's
   `## Parking lot` (one line each, same append form as task parking).
2. **validate-impl gate**. Dispatch a fresh subagent applying the
   validate-impl protocol:

```
Agent(
  description: "Validate feature implementation",
  subagent_type: general-purpose,
  model: opus,
  prompt: (paths and ids only)
    Apply:      <abs-path>/skills/validate-impl/SKILL.md
    Feature:    .sdd/specs/<feature>/ (requirements.md, design.md)
    Workspace:  .sdd/specs/<feature>/workspace/ (review packages)
    Code analysis: apply the `lsp-code-analysis` skill for code claims (LSP first, Grep/Glob fallback)
    Return the GO / NO_GO result with its evidence.
)
```

The validator writes no beans (its own hard rules); on parsing its
`## Validation Summary`, record the decision on the EPIC bean: ONE
line under `## Validation` —
`- DECISION: <GO | NO_GO | MANUAL_VERIFY_REQUIRED> - <date>, validate-impl` —
plus the decision mirror tag per Hard rule 9 (old family tag
removed in the same call). Remediation rounds re-run the gate and
append their own round lines.

3. **Remediation budget: 3 rounds total for the finish phase**, shared by
   both gates. Each round: implementer dispatch (`model: sonnet`) fixing the
   concrete findings -> scoped re-review (`model: opus`) -> re-run the failed
   gate. `GO` plus an APPROVED whole-branch review ends the phase; still
   failing after three rounds -> stop and escalate with the four-part format.
4. **Final stop**. Apply the same fresh-evidence discipline to the GO claim
   before reporting it. Report: GO verdict (one line), the parking lot
   (the `## Parking lot` sections of the feature's task beans plus the
   EPIC bean's — the epic's lot carries the whole-branch minors), then an
   AskUserQuestion:
   **Complete feature** (Recommended) - epic bean `-s completed` with a short
   summary; **Leave open** - the user continues manually; **Abort** - scrapped
   handling as in Step 9.

## Resume semantics

- Every cycle starts at Step 0 with fresh beans queries. Nothing depends on
  session memory; an interrupted run is indistinguishable from a fresh one
  (the `in-progress` task bean is simply picked up again).
- The workspace holds the append-only review packages; each task bean's
  body is its full lifecycle record - `## Brief`, `## Report`,
  `## Notes`, `## Validation`, `## Parking lot` (spec Revisions 4+7).
  Never re-parse documents for progress - beans answers that.

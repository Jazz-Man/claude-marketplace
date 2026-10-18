# Skill Reference

Reference for the 15 skills of the `sdd` plugin. Every skill is invoked as
`/sdd:<name>`. This guide describes each skill's purpose and its key contracts —
what it takes, what it writes, what it refuses to do. The `SKILL.md` files under
`skills/` are the source of truth; where your memory of a skill and its file
disagree, trust the file.

## Three interaction patterns

Skills come in three shapes. Knowing which one you are talking to explains most
of their behavior:

1. **Inline interactive** (`discovery`, `spec-init`, `spec-requirements`,
   `init`, `steering`) — runs in the main conversation, talks to you directly,
   dispatches subagents only for heavy research or drafting.
2. **Generative fork** (`spec-design`, `spec-tasks`, `validate-gap`,
   `validate-requirements`, `validate-design`, `validate-impl`) — a fresh
   subagent with no conversation history; the skill body is its entire task
   prompt. It never asks questions: when it cannot proceed it returns a
   `BLOCKED` status contract, and the main context that invoked it owns the
   dialogue with you. Frontmatter pins `context: fork`, `background: false`,
   `model: opus`.
3. **Orchestrator** (`impl`) — inline in the main conversation, owns the loop
   and the user gates, and dispatches all execution to subagents via five
   prompt templates.

`review`, `debug`, and `verify-completion` are protocol documents: normally
applied by dispatched subagents inside `/sdd:impl`, but each stands alone for
ad-hoc use.

## The skill table

| Skill                        | Purpose                                                             |
| ---------------------------- | ------------------------------------------------------------------- |
| `/sdd:init`                  | write the user-owned `.claude/rules/sdd.md` from the plugin default |
| `/sdd:discovery`             | entry point: research and route new work; writes `.sdd/brief.md`    |
| `/sdd:spec-init`             | birth a feature: spec directory + epic bean + three phase beans     |
| `/sdd:spec-requirements`     | interview the user, dispatch the EARS draft (opus)                  |
| `/sdd:spec-design`           | fork: research the feature and write `design.md`                    |
| `/sdd:spec-tasks`            | fork: draft one task bean (`## Brief`) per sub-task                 |
| `/sdd:impl`                  | orchestrator: subagent implement/review, stop-per-task              |
| `/sdd:review`                | adversarial task-local review protocol                              |
| `/sdd:debug`                 | root-cause-first debugging protocol                                 |
| `/sdd:verify-completion`     | fresh-evidence gate for completion claims                           |
| `/sdd:validate-requirements` | requirements gate: EARS, completeness, contradictions               |
| `/sdd:validate-gap`          | requirements vs codebase gap analysis (`research.md`)               |
| `/sdd:validate-design`       | design quality review, verdict per criterion                        |
| `/sdd:validate-impl`         | feature-level GO/NO_GO gate                                         |
| `/sdd:steering`              | manage `.claude/rules/` in the target project                       |

Contracts every skill shares, regardless of shape:

- **The user reviews and commits at every stop.** Bash is limited to the
  beans CLI, `mkdir`, and read-only inspection.
- **beans is the only tracker.** No skill writes progress, approvals, or
  checkbox flips into documents.
- **AskUserQuestion, always** (where the skill talks to you at all): prose
  explanation first, then the structured question.
- **Paths, never contents.** Dispatch prompts carry file paths and patterns,
  never pasted file contents.

## Workflow skills

### `/sdd:init`

Writes `<project>/.claude/rules/sdd.md` — the sdd workflow rules, taken
verbatim from the plugin's default workflow map (stripped of its hook-injection
wrappers). Once the file exists, the SessionStart hook stays silent and your
file takes precedence over the plugin default, even if it lags behind a newer
plugin version.

Contracts: refuses to overwrite an existing file — offers a read-only diff
instead. Writes nothing but the stripped map: no session briefing, no appended
content. User-invoked; it will not fire on its own.

### `/sdd:discovery`

The entry point for new work. Researches your idea against the codebase (one
general-purpose survey subagent when the idea touches an existing codebase),
the workstream brief, beans state, and steering files, then routes it via
AskUserQuestion:

1. **Extend an existing spec** — the request lives inside a spec's boundary
2. **No spec needed** — answered or done directly in the main chat
3. **Single new feature** — one spec through the full cycle
4. **Multi-spec initiative** — a milestone with a strictly sequential epic
   chain

A mixed decomposition appears as its own option when it fits. Clarification is
one question at a time, only what research did not answer.

Contracts: writes `.sdd/brief.md` before ending (intent, scope, decisions, open
questions, and a queue snapshot — beans stays the source of truth for the
queue). Follow-up features discovered while another is active are queued as
`todo` epics with `--blocked-by`, never started alongside it. Ends by naming
the next command in a code block — it does not run the next command itself.

### `/sdd:spec-init`

Births a feature — the only skill that creates one. Deliberately lightweight:
no subagents, no document generation.

Contracts: guards the single-active-feature rule — while an `in-progress` epic
exists it refuses and asks (one question per epic) whether to complete it,
scrap it, or stop. Creates `.sdd/specs/<name>/` and activates a matching queued
epic or creates a new one (`in-progress`), never duplicating. Records stable
lines in the epic body (`Spec path:`, `Description:`, `Created:`) that later
skills parse. Also seeds the three phase-gate beans under the epic
(`phase`-tagged, titled `Phase — requirements` / `Phase — design` /
`Phase — tasks`, chained in flow order, born `todo`): `completed` on one IS
that phase's approval, and later skills gate on them. The seeding is
idempotent — a follow-up run with the same feature name heals missing phase
beans without re-birthing the feature. Ends with a short summary and the next
command: `/sdd:spec-requirements` — no argument, the next skill resolves the
feature from beans.

### `/sdd:spec-requirements`

Shapes the requirements for the active feature. Interviews you one question at
a time, then dispatches an opus subagent that drafts `requirements.md` in EARS
format from a Q&A digest.

Contracts: everything the drafter needs is written to
`workspace/qa-digest.md` before dispatch — the dispatch prompt carries paths,
never transcript. The drafter applies the requirements review gate and returns
a short summary contract; it never asks you questions. Approval is
validator-gated: the confirm gate's Approve option auto-dispatches
`/sdd:validate-requirements` first, and only its GO completes the phase (with
the `validated` tag and a `Doc-hash:` of the document recorded on the phase
bean). NO_GO escalates in the four-part format and the phase stays open.

### `/sdd:spec-design`

Fork. Researches the feature (classified discovery — full or light depending
on novelty) and writes `design.md`: boundary-first architecture, considered
alternatives with trade-offs and a recommendation, a mermaid diagram.

Contracts: options, not silent picks — architecturally significant choices are
presented as 2–3 approaches. Consistency discipline, not brevity: length is
fine; diagrams and tables matching the prose 100% is the hard requirement.
The fork writes no beans; blocked means the `BLOCKED` contract, not a
question. Approval is validator-gated like requirements: the approve gate
auto-dispatches `/sdd:validate-design`, and only its GO completes the phase
(`validated` tag + `Doc-hash:`); NO_GO escalates and the phase stays open.

### `/sdd:spec-tasks`

Fork. Turns the approved requirements and design into one task bean per
sub-task under the feature epic — born `draft`, each leaf body's `## Brief`
section carrying number, title, natural-language description, detail bullets
(at least one observable completion condition), and `_Requirements:_` /
`_Boundary:_` / `_Depends:_` metadata. Majors are real feature-type container
beans (one-line scope brief); leaves are task beans under them — that shape
is fixed by the beans CLI (tasks nest only under milestone/epic/feature).
There is no plan document; the bean tree is the plan, and the sequence lives
in `--blocked-by` edges (leaf to predecessor, major to major) — never in
number order.

Contracts: no checkboxes, no parallel markers, no step lists inside a brief,
no progress or approval state anywhere — a multi-step task is decomposed into
child beans, not a checklist in a body. The
fork only syncs beans idempotently (updates preserve promoted statuses;
re-runs never reset `todo`/`in-progress`/`completed` to `draft`, and numbers
are never reused for different work). Promotion is yours, not the fork's: the
approve gate in the main context promotes drafts to `todo` — approve-all or
selective, both via `bin/sdd-promote` — and completes the tasks phase bean.
`draft` beans are never auto-selected by impl.

### `/sdd:impl`

The execution orchestrator. See the next section.

## Inside `/sdd:impl`

`/sdd:impl` runs inline and owns the loop, the beans state, the workspace
files, and every interaction with you. It never implements or reviews code
itself. Execution goes to subagents (general-purpose type; the role defined by
five prompt templates kept in the skill's `templates/` directory):

| Template                  | Role                                   | Model  |
| ------------------------- | -------------------------------------- | ------ |
| `implementer-prompt.md`   | implement one task from its brief      | sonnet |
| `task-reviewer-prompt.md` | adversarial review of a task's package | opus   |
| `re-review-prompt.md`     | scoped re-review after a fix round     | opus   |
| `code-reviewer-prompt.md` | whole-branch review at feature finish  | opus   |
| `debugger-prompt.md`      | root-cause investigation of a failure  | opus   |

The task cycle:

1. **Resolve state from beans** — every cycle, including after a "continue".
   Active feature = the `in-progress` epic; the three phase beans must all be
   `completed` (impl refuses unapproved phases) and fresh: the requirements
   and design phase beans carry a `validated` tag plus a `Doc-hash:` line,
   and the current document hash must still match it — a document edited
   after validation is stale, and stale escalates four-part rather than
   silently re-validating. Task queue from the epic's task beans with
   blocked-by relations; lowest-numbered actionable task (an `in-progress`
   task resumes first). Task beans carrying an unresolved `## Blocker` note
   are reported, not auto-selected; `draft` beans never are.
2. **Prepare** — baseline the working tree, discover the repo's validation
   commands, mark the task `in-progress`. No brief file is written: the task
   bean's `## Brief` body section IS the brief.
3. **Implement** — dispatch the implementer with the task bean id; it reads
   the bean, appends its `## Report` (and any `## Notes` one-liners) itself,
   and returns a status contract
   (`DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT`).
4. **Review** — build `workspace/review-package-<N>.md` (scoped diff vs HEAD;
   the working tree is always the task's full change
   set) and dispatch the task-reviewer. Verdict: `APPROVED` or `REJECTED` with
   blocking/minor-marked findings. Every verdict round lands on the task bean
   as a `## Validation` line (with the package pointer) plus a mirror tag
   (`verdict-approved`, …). Minor findings park in the task bean's
   `## Parking lot` and never enter the fix loop.
5. **Fix loop, max 5 rounds** — rounds 1–3 resume the same implementer
   (sonnet); rounds 4–5 dispatch a fresh one with the model raised to opus.
   Every round gets a scoped re-review of only the changed files. A dispute
   that repeats two rounds running escalates to you instead of burning rounds.
6. **Blocked path** — fresh opus debugger applying the debug protocol, max 2
   rounds. Still stuck: the task bean gets a `## Blocker` note (root cause,
   rounds, date) and the failure escalates.
7. **Verification gate** — the orchestrator itself re-runs the task-relevant
   validation commands. Reported success is not evidence; only fresh output
   and exit codes count. `NOT_VERIFIED` re-enters the fix loop under the same
   counter.
8. **Record state** — complete the task bean with a short summary; concerns
   and learnings already live in its `## Report` / `## Notes` sections.
9. **STOP** — short report (task ID, status, verdict, verification result,
   optionally one line of test results), concerns in the four-part escalation
   format, then AskUserQuestion: continue / revise this task / escalate to
   plan change / abort feature.

At feature finish: a whole-branch review (committed diff since the feature
branch diverged from the default branch, plus the uncommitted remainder) and
the `validate-impl` GO/NO_GO gate, sharing 3 remediation rounds between them.
Both verdicts are recorded on the epic bean's `## Validation`; the final stop
surfaces the parking lot — the `## Parking lot` sections of the task beans
plus the epic's. Learnings propagate forward via the completed task beans'
`## Notes` sections.

Resume semantics: every cycle re-derives state from beans. An interrupted run
is indistinguishable from a fresh one; the workspace is append-only.

## Protocol skills

### `/sdd:review`

Adversarial task-local review: verifies an implementation is real, complete,
bounded, spec-aligned, and backed by mechanical evidence — not styled. This is
the protocol the task-reviewer template implements inside `/sdd:impl`; where
the two differ, the template's verdict block wins. The document stands alone
for reviewing a change by hand. Takes a task ID.

Boundary terminology runs through the workflow: discovery identifies Boundary
Candidates, design fixes Boundary Commitments, tasks constrain with
`_Boundary:_`, review rejects Boundary Violations.

### `/sdd:debug`

Root-cause-first debugging: reproduce, isolate, confirm the root cause, then
plan the minimal fix — never a guess-first patch generator. The protocol
behind the debugger dispatch in `/sdd:impl`; also stands alone for hand
investigation. Takes a failure summary.

### `/sdd:verify-completion`

The fresh-evidence gate: a claim is only as good as evidence collected after
the work, matching the claim's scope. Claim types `TASK`, `FIX`,
`TEST_OR_BUILD`, `FEATURE_GO`; outcomes `VERIFIED`, `NOT_VERIFIED`,
`MANUAL_VERIFY_REQUIRED`. Applied inline by `/sdd:impl` before completing any
task bean and by `validate-impl` before returning GO.

## Validation skills

### `/sdd:validate-gap`

Fork. Measures the distance between the active feature's requirements and the
existing codebase: findings with quoted evidence (every claim cites
`file:line` with the snippet verbatim, every gap names the requirement ID it
threatens), written to `research.md`, plus a gap-list and an
implementation-approach recommendation. For brownfield features — after
requirements, before or during design. Produces information, not decisions:
the design phase (with you) makes the choice.

### `/sdd:validate-requirements`

Fork. Validates the active feature's `requirements.md` — the text on disk —
against EARS syntax, user-intent completeness (qa-digest + brief + epic
description), internal contradictions, steering alignment, and testability;
returns GO/NO_GO with evidence-quoted findings (`file:line` + verbatim
quote). Auto-dispatched by the requirements approve gate; also runs
standalone as a formative check anytime, no phase state required.

Contracts: applies only zero-semantics fixes (typos, wrong paths, formatting,
ID-label normalization) and lists every one under `FIXES_APPLIED`; anything
touching meaning is a finding, never an edit. Writes no beans and computes no
hash — the phase-completion writes (tag, `Doc-hash:`, `completed`) belong to
the presenting context at the GO moment. For brownfield features it pairs
with `validate-gap`.

### `/sdd:validate-design`

Fork. Quality-reviews `design.md` against four review criteria and writes the
verdict-per-criterion report to `workspace/design-review.md`, returning
GO/NO_GO with blocking and minor findings. Auto-dispatched by the design
approve gate (Revision 6); also runs standalone as a formative check before
the plan gets built. Reviews; does not redesign — findings go to the report,
you decide what happens to the document.

Contracts: like `validate-requirements`, only zero-semantics fixes (each
listed under `FIXES_APPLIED`); the fork writes no beans and computes no hash.

### `/sdd:validate-impl`

Fork. The feature-level GO/NO_GO gate: reads completion state from the
feature's task beans and runs integration, coverage, design-alignment, and
boundary checks with fresh evidence — catching what only becomes visible when
completed tasks are viewed together. Entered two ways: standalone via
`/sdd:validate-impl`, or dispatched by `/sdd:impl` at feature finish. Runs
every check itself; returns the verdict with remediation.

## `/sdd:steering`

Manages `.claude/rules/` in the target project (local) and `~/.claude/rules/`
(global): bootstrap the core rules from the codebase, sync drifted rules,
create domain or topic rules, edit existing ones. One skill, four modes, two
scopes; local rules are conflict-checked against global ones. Every change is
drafted, checked, and shown for approval before anything is written.

## Reading order

1. [Spec-Driven Workflow](spec-driven.md) — the phase-by-phase walkthrough
2. This reference
3. [Why sdd?](why-cc-sdd.md) — the design rationale

# sdd — Kiro-style spec-driven development for Claude Code

`sdd` is a prompt-only Claude Code plugin. It runs a spec-driven workflow —
discovery, requirements, design, task plan, implementation — where every skill is
invoked as `/sdd:<name>` and all heavy execution happens in subagents, so the main
conversation stays a place for decisions rather than file dumps.

It borrows the document discipline from Kiro's spec methodology (EARS-format
requirements, design docs with mermaid diagrams, boundary-annotated task briefs)
and the execution discipline from subagent-driven development (fresh implementer
and reviewer per task, status contracts, bounded fix and debug loops, hard stops
where a human must decide).

Honest scope: this is a personal plugin, written for one user's daily workflow.
It is English-only, loaded locally via `--plugin-dir`, and not published to any
marketplace. If it works for someone else, good; it makes no claim of general
support.

## Getting started

From the plugin checkout:

```bash
claude --plugin-dir /path/to/cc-sdd/plugins/sdd
```

Inside a running session, `/reload-plugins` picks up edits to skill texts. Run
`claude plugin validate .` in the checkout to confirm the plugin is well-formed.

Skills appear as `/sdd:<name>` (for example `/sdd:discovery`). On session start,
a hook injects the workflow map so the session knows the phase flow and the hard
rules without loading any skill body — see [Bootstrap](#bootstrap).

## The workflow

One command per phase, each ending in a confirm gate before the next. The user
drives the cycle; there is no chain skill that runs everything in one go.

```
/sdd:discovery → /sdd:spec-init → /sdd:spec-requirements → /sdd:spec-design → /sdd:spec-tasks → /sdd:impl
```

- **discovery** researches the idea against the codebase, the workstream brief,
  and beans state, then routes it: extend an existing spec, no spec needed
  (answered directly in chat), one new feature, or a sequential multi-spec
  initiative. Writes `.sdd/brief.md`.
- **spec-init** births the feature: creates `.sdd/specs/<feature>/`, the epic
  bean that the rest of the workflow resolves the feature from, and the three
  phase-gate beans (requirements → design → tasks) that record approvals.
- **spec-requirements** interviews the user one question at a time, then
  dispatches an opus subagent that drafts `requirements.md` in EARS format.
  Approving it auto-dispatches the requirements validator; the phase completes
  only on its GO.
- **spec-design** runs as a fork (fresh subagent): researches the feature and
  writes `design.md` — boundary-first architecture, considered alternatives,
  mermaid diagram. Approval runs the design validator the same way.
- **spec-tasks** runs as a fork: drafts the task TREE — feature-type major
  containers under the epic, task leaves under their majors, dependency
  edges (`blockedByIds`) as the sequence — all born `draft`; each leaf
  body's `## Brief` section IS the task brief, there is no plan document.
  The approve gate promotes the drafts (approve-all or selective, via
  `sdd-promote`) to `todo`.
- **impl** executes the approved task beans one at a time (see below),
  stopping after every task.

When a phase ends, its result is presented with a confirm-only question that
also names the next command. Clarifying questions live in discovery and
requirements; design and tasks are review-and-confirm.

Quick one-off work never enters this pipeline — discovery can route it to "no
spec needed" and it happens in the main chat.

## Phase gates

Approval is persistent, not conversational. Each feature epic carries three
phase beans created at feature birth; `completed` on one IS the approval
record. Approving requirements or design auto-dispatches an independent opus
validator first (`validate-requirements` / `validate-design`): GO closes the
phase with a `validated` tag and the document's sha256 recorded in the phase
bean; NO_GO escalates in the four-part format and the phase stays open.
Validators apply only zero-semantics fixes (typos, paths, formatting) and list
every one. Any later gate recomputes the hash — a document edited after its
validation is stale, and stale escalates rather than silently re-validates.
Re-entering an approved phase escalates too: reopen the downstream phases,
accept the desync risk on record, or cancel.

## Single active feature

Exactly one feature is active at any time: the single epic bean with status
`in-progress`. Every skill except `spec-init` and `discovery` resolves the
feature from beans and takes no feature argument. `spec-init` refuses to birth a
new feature while one is in progress (it offers to complete or scrap the current
one first). A follow-up feature discovered mid-work is queued as a `todo` epic
blocked by the active one and starts only after the current feature completes —
or instead of it, if the current one is cancelled.

Multi-spec initiatives follow the same rule: a milestone bean with a strictly
sequential chain of epics. Nothing ever runs in parallel.

## State and artifacts

Two stores, strictly separated — with a size boundary between them:

- **State, verdicts, briefs, and notes live in beans.** Feature = epic bean,
  task = task bean, initiative = milestone bean. Progress, blockers,
  dependencies — all in beans. Nothing ever writes progress, approvals, or
  checkbox flips into documents, and there is no plan document: the task
  beans ARE the plan. Each task-bean body carries the append-only sections
  `## Brief`, `## Report`, `## Notes`, `## Validation`, and `## Parking lot`;
  every machine-parsed verdict line (`- VERDICT: APPROVED`, `- DECISION: GO`,
  …) is written with a lowercase-hyphen mirror tag (`verdict-approved`,
  `decision-go`, …) for cheap cross-bean filtering. Resume means querying
  beans, never re-parsing documents.
- **Blob artifacts live in files**, under `.sdd/` in the target project —
  review packages and other end-to-end-read evidence past roughly 100 lines,
  referenced from beans by pointer:

```
.sdd/
├── brief.md                      workstream narrative (discovery output)
└── specs/<feature>/
    ├── requirements.md           EARS-format requirements
    ├── design.md                 architecture + mermaid
    ├── research.md               validate-gap output, when used
    └── workspace/                append-only blobs: review packages,
                                   qa-digest, design-review and
                                   validation reports, edit digests
```

Five small helpers (plus their shared `_sdd-lib.sh`) in the plugin's `bin/`
guard the mechanical parts: `sdd-phase` (each skill's phase precondition —
what the PreToolUse gate runs), `sdd-gate` (the full impl entry gate: phases,
validation tags, document-hash freshness, tree queue), `sdd-next` (the next
runnable leaf of the task tree plus pending rollups), `sdd-verdict` (latest
verdict token from a bean body), and `sdd-promote` (the approve gate's
`draft` → `todo` promotion across the tree — the only write helper).

## Stop-per-task: the user holds git

After every implementation task, `/sdd:impl` stops. The user reviews the diff,
runs what they want to run, and commits. The stop report is deliberately short:
task ID, final status,
review verdict, verification result, and optionally one line of test results.
No diff summaries or file lists — the user reviews the working tree themselves.

Continuing is an explicit choice (via a structured question), as is revising the
task, escalating to a plan change, or aborting the feature.

## Models

Pinned in the skill texts, never the agent's choice:

| Work                                                                                  | Model  |
| ------------------------------------------------------------------------------------- | ------ |
| Requirements, design, and tasks generation                                            | opus   |
| All reviews and validations (task review, re-review, whole-branch review, validate-*) | opus   |
| Implementation                                                                        | sonnet |
| Implementation in fix-loop rounds 4–5 and post-debug retries                          | opus   |
| Debugger                                                                              | opus   |

## Interaction rules

- **Every question or choice-point goes through AskUserQuestion.** Detailed
  explanation first in chat prose (approaches, trade-offs), then the structured
  question with the recommended option first and labeled. A plain-text "which do
  you prefer?" ending is not part of the workflow.
- **Subagents never ask the user directly.** They return status contracts
  (`DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT`); the main context
  formulates the question.
- **No blind decisions.** Any concern or deviation from the plan escalates in a
  four-part format:
  1. Per plan: what the plan specified
  2. Actual: what happened
  3. Why it matters: the consequence
  4. Options: accept as-is / fix now / change the plan / abort

  The user decides. Cancellation is a first-class outcome: aborting marks the
  epic and its task beans scrapped, and the branch (created and deleted by the
  user) carries the whole feature away.

## The 15 skills

| Skill                        | What it does                                                        |
| ---------------------------- | ------------------------------------------------------------------- |
| `/sdd:init`                  | write the user-owned `.claude/rules/sdd.md` from the plugin default |
| `/sdd:discovery`             | entry point: research and route new work; writes `.sdd/brief.md`    |
| `/sdd:spec-init`             | birth a feature: spec directory + epic bean + three phase beans     |
| `/sdd:spec-requirements`     | interview the user, dispatch the EARS draft (opus)                  |
| `/sdd:spec-design`           | fork: research the feature and write `design.md`                    |
| `/sdd:spec-tasks`            | fork: draft the task tree (majors + leaf `## Brief` beans)          |
| `/sdd:impl`                  | orchestrator: subagent implement/review, stop-per-task              |
| `/sdd:review`                | adversarial task-local review protocol                              |
| `/sdd:debug`                 | root-cause-first debug protocol                                     |
| `/sdd:verify-completion`     | fresh-evidence gate for completion claims                           |
| `/sdd:validate-requirements` | requirements gate: EARS, completeness, contradictions               |
| `/sdd:validate-gap`          | requirements vs codebase gap analysis (`research.md`)               |
| `/sdd:validate-design`       | design quality review, verdict per criterion                        |
| `/sdd:validate-impl`         | feature-level GO/NO_GO gate                                         |
| `/sdd:steering`              | manage `.claude/rules/` in the target project                       |

## Bootstrap

A SessionStart hook (matcher `startup|clear|compact`) checks whether
`.claude/rules/sdd.md` exists in the target project:

- **Missing** — the plugin's default workflow map is injected as session
  context, wrapped so dispatched subagents ignore it. The session knows the
  phase flow and hard rules without any skill being invoked.
- **Present** — the hook stays silent. The user's file always wins, even if it
  lags behind a newer plugin version. Precedence is by design.

`/sdd:init` writes that file once, from the plugin default. If it already
exists, the skill refuses to overwrite and offers a read-only diff instead.
The hook also runs `beans prime` on session start and before compaction so the
tracker's context survives context compression.

## Invocation gates

Three more hooks enforce the workflow mechanically:

- **PreToolUse** (matcher `Skill`) — when the model calls an `/sdd:<name>`
  skill, `bin/sdd-phase` verifies that skill's phase precondition; a failure
  denies the call and the one-line diagnosis (with the fixing command) reaches
  the model.
- **UserPromptExpansion** (matcher `^sdd:`) — the same check for a directly
  typed `/sdd:<name>` command, before it expands.
- **PreToolUse** (matcher `Edit|Write`) — the write guard: file writes into
  `.beans/` are blocked (bean state changes go through the beans CLI) and so
  are checkbox lists written under `.sdd/` (the plan and its progress live in
  the bean graph, never in documents).

Every skill also runs `sdd-phase` as its own first step, so the sequence holds
even where hooks do not fire.

## How it executes

`/sdd:impl` runs inline in the main conversation as an orchestrator. It never
writes code itself — it owns the loop, the beans state, and the user gates, and
dispatches five roles via prompt templates kept in the skill
(`implementer`, `task-reviewer`, `re-review`, `code-reviewer`, `debugger`):

1. Resolve state from beans (every cycle, including after "continue") — active
   feature, the three phase gates (all must be completed and fresh — the
   recorded document hashes must still match), task queue, blocked-by
   relations. Nothing depends on session memory; an interrupted run is
   indistinguishable from a fresh one.
2. Dispatch a sonnet implementer with the task bean id — its `## Brief` body
   section is the brief; no brief file exists — and parse its status contract.
   The implementer appends its own `## Report` (and any `## Notes` one-liners)
   to the bean.
3. Build a scoped review package (working-tree diff vs HEAD; the file stays in
   `workspace/`) and dispatch an opus task-reviewer
   applying the review protocol. Each verdict is recorded on the task bean as
   a `## Validation` line with the package pointer and a mirror tag.
4. **Fix loop, max 5 rounds**: rounds 1–3 resume the same implementer; rounds
   4–5 dispatch a fresh one with the model raised to opus. Each round gets a
   scoped re-review of only the changed files. Minor findings never enter the
   loop — they park in the task bean's `## Parking lot` and surface at feature
   finish.
5. **Blocked path**: a fresh opus debugger (root-cause-first, max 2 rounds).
   Still stuck → the task is marked blocked in beans with the root cause and
   escalated to the user.
6. **Verification gate**: before any completion claim, the validation commands
   are re-run by the orchestrator itself — reported success from the implementer
   is not evidence; only fresh output and exit codes count.
7. **STOP** — short report, concerns in the four-part format, AskUserQuestion.

At feature finish: a whole-branch review (committed diff since the feature
branch diverged from the default branch, plus the uncommitted remainder) and
the `validate-impl` GO/NO_GO gate, sharing a budget of 3 remediation rounds;
both verdicts are recorded on the epic bean's `## Validation`. Learnings from
earlier tasks propagate forward via the completed task beans' `## Notes`
sections.

## Documentation

| Guide                                              | Contents                                          |
| -------------------------------------------------- | ------------------------------------------------- |
| [Skill Reference](docs/guides/skill-reference.md)  | all 15 skills: invocation, purpose, key contracts |
| [Spec-Driven Workflow](docs/guides/spec-driven.md) | the phase-by-phase walkthrough                    |
| [Why sdd?](docs/guides/why-cc-sdd.md)              | design rationale and trade-offs                   |

The conversion's own spec and task plan live in `../../docs/superpowers/` — this
repository was migrated from the multi-agent `cc-sdd` toolkit, and that
directory records how.

## License

MIT — see [LICENSE](../../LICENSE).

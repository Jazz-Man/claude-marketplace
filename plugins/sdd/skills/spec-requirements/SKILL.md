---
name: spec-requirements
description: Shape and write the requirements for the active feature. Interviews the user one question at a time, dispatches an opus subagent that drafts the EARS requirements document from a Q&A digest, then runs a confirm-only review. Use after /sdd:spec-init.
---

# spec-requirements - interview, draft, confirm

## Role

You run INLINE in the main conversation. You own the dialogue with the
user and every dispatch; a subagent owns the document. You never write
`requirements.md` yourself.

Division of labor:

- **You** resolve the feature from beans, ask the clarifying questions,
  write the Q&A digest to disk, dispatch the drafter, present its
  result, and run the confirm gate.
- **The drafter** (Agent tool, general-purpose, `model: opus`) reads the
  digest and the referenced files, applies the review gate, writes
  `requirements.md`, and returns a short summary contract. It NEVER asks
  the user questions.

## Hard rules

1. Bash is limited to the beans CLI, `mkdir`, and read-only inspection.
2. **beans is the only tracker.** This skill writes no task state to
   beans - its bean writes are the Step 0 recovery updates, the re-entry
   updates of the phase-gate check, and the phase-gate completion of
   Phase 3 with its Revision 6 writes (the `validated` tag and the
   `Doc-hash:` round on the phase bean); the document on disk is the
   artifact. Never write progress, approval, or blocked state into
   documents.
3. **State lives in files, not chat.** Everything the drafter needs is
   written to `workspace/qa-digest.md` BEFORE dispatch; the dispatch
   prompt carries paths, never transcript.
4. **Paths, never contents.** Dispatch prompts carry file paths and Glob
   patterns, never pasted file contents. `${CLAUDE_PLUGIN_ROOT}` and
   other variables expand in your context only - resolve them to
   absolute paths before dispatch.
5. **AskUserQuestion, always - one question at a time.** New
   requirements-shaping questions are asked ONLY in the interview (and
   in discovery); the confirm step is confirm-only (spec 5.4).

## Step 0 - Resolve the active feature

1. Query beans: `beans list --json -t epic -s in-progress`.
   - **Exactly one** -> that epic is the active feature. Resolve its
     spec directory from the `Spec path:` line in the bean body; if the
     body names none, stop and ask the user where the feature lives.
   - **None** -> stop: no active feature. Point the user to
     `/sdd:spec-init` (spec already shaped) or `/sdd:discovery`
     (nothing shaped yet).
   - **More than one** -> beans violates the single-active-feature rule
     (spec 5.5). Stop; resolve via AskUserQuestion - one question per
     extra epic (complete it / scrap it / stop; you run the chosen beans
     update), then have the user re-invoke `/sdd:spec-requirements`.
2. Load light context: the epic bean body (feature description) and
   `.sdd/brief.md` if present (workstream narrative from discovery).
   Steering is already in your context (project memory, loaded at
   session start) - apply it; do not re-read the files. Do not load more
   into the main context - the drafter reads the full files.
3. **Phase-gate check**: the requirements phase is the FIRST phase -
   there is no upstream phase gate (the active epic resolved above IS
   the entry condition). The only gate is the re-entry check below
   (spec Revision 5).

   > **Gate:** if the `Phase — requirements` bean is already
   > `completed`, this is re-entry into an approved phase - STOP: run
   > the re-entry escalation below before anything else in this skill.

   Query the epic's children once:
   `beans query --json '{ bean(id: "<epic-id>") { children { id title status tags blockedByIds } } }'`
   (the resolved relation `blockedBy` is broken in beans v0.4.2 - always
   read `blockedByIds`). Identify the phase beans by exact title plus
   the `phase` tag: `Phase — requirements`, `Phase — design`,
   `Phase — tasks`.

   - **`Phase — requirements` already `completed`** -> re-entry (the
     gate above): escalate via AskUserQuestion before proceeding:
     1. **Reopen downstream phases** (Recommended) - the downstream
        approvals descend from the requirements being replaced: set
        `Phase — design` and `Phase — tasks` to `todo`
        (`beans update <phase-id> -s todo` each) with a one-line reason
        appended to each, then continue this run - the interview
        proceeds under the reopened gates and the approve gate
        re-completes the requirements phase.
     2. **Accept desync risk** - leave every gate as it is; append a
        one-line dated note to the epic body (`Desync accepted:
requirements re-entered while phase gates read completed`),
        then continue this run. Downstream phases stay completed
        against a requirements document that may change - the risk is
        on record, not silent.
     3. **Cancel** - stop; nothing changes.
   - **No `Phase — requirements` bean under the epic** -> partial
     legacy state: the interview may proceed, but the approve gate
     cannot close the phase - it names `/sdd:spec-init` (whose heal
     path creates missing phase beans) before completion.

   Keep the requirements phase bean id at hand (when present); Phase 3
   validates onto it and completes it at the approve gate.

4. **Existing-document gate**: if
   `.sdd/specs/<feature>/requirements.md` already exists, ask via
   AskUserQuestion before the interview begins:
   1. **Edit-merge** (Recommended) - keep the document; the interview
      covers only the change intent; the drafter merges.
   2. **Regenerate** - interview from scratch; the drafter rewrites the
      document.
   3. **Stop**.

## Phase 1 - Interview (inline, one question at a time)

Ask ONE question at a time via AskUserQuestion. Prefer multiple choice:
2-4 concrete options, recommended first and labeled when you have a
recommendation. The user may paste free context instead of picking an
option - incorporate it and never re-ask what it already answers.

**Ask about (requirements scope - the WHAT):**

- Functional scope: what is included and what is excluded
- User-observable behavior: "when X happens, what should the user
  see/experience?"
- Business rules and edge cases: limits, error conditions, special cases
- Non-functional requirements visible to users: response-time
  expectations, availability, security level
- Adjacent expectations only when they change user-visible behavior:
  what this feature relies on, and what it explicitly does not own

**Do not ask about (design territory - deferred to /sdd:spec-design):**

- Technology stack choices, architecture patterns, API design, data
  models, internal component structure, and how to achieve the
  non-functional requirements

**Litmus test**: if an EARS acceptance criterion can be written without
mentioning any technology, it belongs in requirements; if it requires a
technology choice, it belongs in design.

Stop when the requirements-shaping information is gathered - do not
interrogate beyond that. Skip every question the epic description, the
workstream brief, or steering already answers. In edit-merge mode, ask
only about the change intent.

**Brownfield option**: when the feature extends an existing codebase and
a scope question needs codebase facts, dispatch one exploration subagent
(Agent tool, general-purpose) to summarize the existing behavior
relevant to the feature - tell it to apply the `lsp-code-analysis` skill
(LSP first, Grep/Glob fallback). The summary enters the interview; raw
exploration never does.

**Write the digest before anything else**: run
`mkdir -p .sdd/specs/<feature>/workspace/`, then write
`workspace/qa-digest.md` with:

- Feature name and one-line description
- Every question with the user's answer (chosen option plus pasted free
  context, lightly compressed)
- Settled scope: in / out
- Constraints, business rules, and edge cases surfaced
- Edit-merge only: the change intent and which parts of the existing
  document it touches

If the digest already exists from an earlier run, append a new dated
section instead of overwriting (workspace files are append-only). The
digest is the drafter's single source of user intent - conversation
text does not survive session boundaries; files do.

## Phase 2 - Dispatch the drafter

Dispatch via the Agent tool with paths only:

```
Agent(
  description: "Draft requirements for <feature>",
  subagent_type: general-purpose,
  model: opus,
  prompt: (paths only)
    Role: draft the requirements document for one feature of a
    spec-driven project. You are a subagent - do NOT ask the user
    questions; return your summary contract instead.
    Single source of user intent (read first):
                  .sdd/specs/<feature>/workspace/qa-digest.md
    Template:     <abs-path>/assets/templates/requirements.md
    EARS rules:   <abs-path>/assets/rules/ears-format.md
    Review gate:  <abs-path>/assets/rules/requirements-review-gate.md
                  (apply it to your draft before writing; at most 2
                  repair passes)
    Steering:     already in your context (project memory, loaded at
                  session start) - apply it; do not re-read files
    Workstream:   .sdd/brief.md (if present)
    Existing doc: .sdd/specs/<feature>/requirements.md (edit-merge only:
                  merge into it; do not rewrite untouched sections)
    Write:        .sdd/specs/<feature>/requirements.md - only after the
                  review gate passes
    Ground rules: WHAT, not HOW - no technology choices, architecture,
                  or implementation detail; every acceptance criterion
                  in EARS per the rules file; requirement headings with
                  numeric IDs only; every requirement testable and
                  unambiguous - never build one on your own assumptions.
    If the digest leaves a real scope ambiguity, return AMBIGUITY with
    the blocking question - never guess and never write guessed
    requirements.
    Return exactly this block as your final message (the caller parses
    the heading and the - STATUS: line mechanically):
      ## Draft Summary
      - STATUS: <DONE | AMBIGUITY>
      - AREAS: <one line - requirement areas covered>
      - BOUNDARY: <one line - in/out highlights>
      - CONCERNS: <one line each, if any>
      - QUESTIONS: <AMBIGUITY only - the scope question(s) blocking
        a clean draft>
)
```

Parse discipline: only the exact `## Draft Summary` block and its
`- STATUS:` line count. If the block is missing,
ambiguous, or replaced with prose, resume the drafter once
(SendMessage) requesting the structured block only.

- **DONE** -> Phase 3.
- **AMBIGUITY** -> verify, do not assume: check whether
  `.sdd/specs/<feature>/requirements.md` was written or modified
  (existence is the check for a from-scratch run; `git diff -- <path>`
  or a Read against the digest's change-intent notes for edit-merge).
  If a partial write exists, note that in the digest and instruct the
  next drafter round to merge into it, not rewrite from scratch. Then
  take QUESTIONS to the user via AskUserQuestion - this is still the
  interview; clarifying questions belong here. Append the answer to the
  digest under `## Clarifications`, and dispatch a FRESH drafter with
  the same prompt shape.

## Phase 3 - Confirm-only review

Present the result in the main conversation - SHORT: the requirement
areas with a one-line objective each, the settled in/out boundary, the
requirement count, and any concerns the drafter flagged.

The full document is `.sdd/specs/<feature>/requirements.md`; point the
user at the path. Do not dump the document into chat.

No new open questions from you here - confirm-only. Then
AskUserQuestion:

1. **Approve** (Recommended) - the requirements phase is settled.
   Approval runs the independent validator FIRST (spec Revision 6):
   the phase completes only on its GO.
   - Dispatch the validate-requirements fork - Agent tool, general-purpose,
     `model: opus`, paths only:
     ```
     Agent(
       description: "Validate requirements for <feature>",
       subagent_type: general-purpose,
       model: opus,
       prompt: (paths only)
         Apply:       <abs-path>/skills/validate-requirements/SKILL.md
         Feature dir: .sdd/specs/<feature>/
         Document:    .sdd/specs/<feature>/requirements.md
         Return exactly the summary block the validate-requirements skill
         defines.
     )
     ```
     Parse discipline: only the exact summary block and its
     `- STATUS:` and `- VERDICT:` lines count; resume the fork once
     (SendMessage) if the block is missing,
     ambiguous, or replaced with prose. Present its verdict, any
     criterion verdicts, findings, and fixes to the user - short
     lists in chat, the file when PATH names one.
   - **GO** - the phase closes in this order (the requirements phase-bean
     id; `completed` IS the approval record, spec Revision 5):
     1. Tag: `beans update <requirements-phase-id> --tag validated`
     2. Hash, computed NOW - after the validator's fixes, at the GO
        moment (the fork never hashes; this write is yours):
        `shasum -a 256 .sdd/specs/<feature>/requirements.md`
     3. Append a `## Validation` round to the PHASE BEAN body
        (`--body-append`; create the section on the first round,
        later rounds append beneath it - only the latest
        `Doc-hash:` counts at later gates): date, verdict GO,
        `Doc-hash: <the sha256 just computed>`
        (this freshness write mirrors `${CLAUDE_PLUGIN_ROOT}/bin/sdd-gate`'s read)
     4. Complete: `beans update <requirements-phase-id> -s completed`
        Then name the next command in a code block:
     ```
     /sdd:spec-design
     ```
     MINOR findings travel with the document into the next phase -
     name them at the completion presentation. (Legacy case from
     the phase-gate check - no requirements phase bean: skip the writes
     above and name `/sdd:spec-init` for its heal path; a heal run
     creates the bean, and a re-run of this gate validates onto it.)
   - **NO_GO** - four-part escalation, verbatim, the validator's
     BLOCKING findings as the payload:
     ```
     1. Per plan: approval requires a validated requirements document -
        zero BLOCKING findings
     2. Actual: the validator returned NO_GO - <the BLOCKING
        findings>
     3. Why it matters: approving now would carry the defects into
        every downstream phase
     4. Options: revise now / stop
     ```
     The phase stays open - no tag, no hash, no completion.
     **Revise now** takes the Edit option below with the findings as
     the seed feedback - and the next Approve re-dispatches the
     validator. Loop edit -> validate until GO or the user stops.
   - **BLOCKED** - present the blocker and the named command, then
     AskUserQuestion on how to proceed (resolve via that command /
     adjust inputs / stop); the phase stays open.
2. **Edit** - the user supplies feedback. Append it to the digest under
   `## Edit round <K>`, resume the SAME drafter via SendMessage where
   possible (fresh dispatch otherwise), then re-present and confirm
   again. Edit rounds are user-driven with no fixed cap, but each round
   must carry concrete feedback, not a bare re-run request.
3. **Stop** - the user takes over; the document stays on disk.

Brownfield note (on GO): `/sdd:validate-gap` (optional) analyzes these
requirements against the existing codebase before design.

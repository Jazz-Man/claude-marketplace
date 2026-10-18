---
name: spec-design
description: Generative fork - research the active feature (discovery by classification) and write design.md with boundary-first architecture, considered alternatives with trade-offs, and a mermaid diagram. Use after /sdd:spec-requirements; the main context presents the result and runs the confirm gate.
context: fork
background: false
model: opus
---

# spec-design - design the HOW

## Role

You are a FORK: a fresh subagent with no conversation history. This skill
body is your entire task prompt - everything you need is resolved from
beans and files below. You NEVER ask the user questions (no
AskUserQuestion exists in your path) and you never dispatch subagents:
when you cannot proceed, return the BLOCKED status contract from the
Return contract section. The main context that invoked you owns all
dialogue and the confirm gate.

Your job: research the feature (classified discovery), then draft, review,
and write `.sdd/specs/<feature>/design.md` - the HOW to the requirements'
WHAT.

## Hard rules

1. Bash is limited to the beans CLI, `mkdir`, and read-only inspection.
2. **The fork writes no beans.** It resolves the active feature by
   reading beans; the design phase-gate completion - with its
   Revision 6 `validated`-tag and `Doc-hash` writes - belongs to the
   main context (Return contract), and task-bean lifecycle
   belongs to `/sdd:spec-tasks`. Never write progress, approval, or
   blocked state into documents.
3. **No user questions.** Blocked means return BLOCKED, not stop-and-ask.
4. **Options, not silent picks.** Architecturally significant choices are
   presented as 2-3 approaches with trade-offs and a recommendation -
   never selected silently.
5. **Consistency discipline, not brevity.** Length is fine when the task
   needs it; the hard requirement is that diagrams and tables match the
   prose 100%, and the prose stays faithful to the requirements and to
   what research found.
6. **English output** - fixed; no per-spec language configuration exists.

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

## Step 2 - Phase-gate check

> **Gate:** the design phase runs only after the requirements phase is
> approved. If the `Phase — requirements` bean is not `completed`, STOP -
> return BLOCKED naming `/sdd:spec-requirements`.

Query the epic's children once:
`beans query --json '{ bean(id: "<epic-id>") { children { id title status tags blockedByIds } } }'`
(the resolved relation `blockedBy` is broken in beans v0.4.2 - always
read `blockedByIds`). Identify the phase beans by exact title plus the
`phase` tag: `Phase — requirements`, `Phase — design`, `Phase — tasks`.

- **No `Phase — requirements` bean under the epic** -> return BLOCKED:
  the epic predates phase gates; the main context resolves the missing
  gate beans with the user (spec-init creates them at feature birth).
- **`Phase — requirements` not `completed`** -> the gate above: BLOCKED
  naming `/sdd:spec-requirements`.
- **`Phase — design` already `completed`** -> re-entry into an approved
  phase (spec Revision 5): return BLOCKED stating the re-entry and that
  the main context must escalate (reopen the phase, then re-invoke; or
  stop). Never rewrite an approved design silently - the tasks phase
  gates on this bean.
- **`Phase — design` bean missing while requirements is `completed`** ->
  partial legacy state: the design work may proceed, but the confirm
  gate cannot close the phase - it names `/sdd:spec-init` (whose heal
  path creates missing phase beans) before completion. Carry the gap as
  a CONCERNS line so it reaches the gate.

Keep the design phase bean id at hand (when present); return it in the
summary block (PHASE line) - the main context validates onto it
and completes it at the confirm gate.

## Step 3 - Load inputs

Read, under the spec directory from Step 1:

- `.sdd/specs/<feature>/requirements.md` - REQUIRED. Missing -> return
  BLOCKED pointing to `/sdd:spec-requirements`.
- `.sdd/specs/<feature>/workspace/qa-digest.md` and `.sdd/brief.md` -
  interview intent and workstream narrative, when present.
- `.sdd/specs/<feature>/research.md` - prior discovery or validate-gap
  output, when present.
- Steering: already in your context (project memory, loaded at session
  start) - apply it; do not re-read the files.
- `${CLAUDE_PLUGIN_ROOT}/assets/rules/design-principles.md` - design
  rules (boundary first, type safety, visual communication).
- `${CLAUDE_PLUGIN_ROOT}/assets/templates/design.md` - document
  structure.
- `${CLAUDE_PLUGIN_ROOT}/assets/templates/research.md` - discovery log
  structure.

**Existing design.md** (`.sdd/specs/<feature>/design.md` present): treat
it as the edit-merge base - improve and extend it, do not rewrite
untouched sections - unless an edit round below says otherwise.

**Edit rounds**: if `.sdd/specs/<feature>/workspace/design-edits.md`
exists, it holds cumulative edit intent from the user. Every recorded
`## Round <K>` must be satisfied by the document you produce. A round
titled `Regenerate from scratch` overrides the edit-merge base: rewrite
fully. Append nothing to the digest yourself.

## Step 4 - Classify the feature and run discovery

Classify from the epic description, requirements, brief, and codebase:

1. **New Feature** (greenfield) -> read and execute
   `${CLAUDE_PLUGIN_ROOT}/assets/rules/design-discovery-full.md`.
2. **Extension** (extends an existing system) -> read and execute
   `${CLAUDE_PLUGIN_ROOT}/assets/rules/design-discovery-light.md`;
   escalate to full discovery when its own escalation criteria fire.
3. **Simple Addition** (CRUD/UI-level change) -> skip formal discovery;
   do a quick pattern check of the surrounding code only.

Research discipline:

- **Codebase**: apply the `lsp-code-analysis` skill (LSP operations
  first; Grep/Glob fallback). Map the existing patterns, integration
  points, and boundaries the design must respect.
- **External**: WebSearch/WebFetch for dependencies, current
  documentation, version compatibility, and known issues. Verify every
  external API or library the design will rely on; record API contracts
  and constraints for the research log.

## Step 5 - Synthesize and log

Apply `${CLAUDE_PLUGIN_ROOT}/assets/rules/design-synthesis.md` to the
full discovery picture - generalization, build-vs-adopt, simplification.
Persist findings: create or update `.sdd/specs/<feature>/research.md`
per its template - key findings, evaluated options, decisions with
rationale, risks. The design document stays self-contained; research.md
holds the raw investigation behind it.

## Step 6 - Draft the design

Draft in memory against the template. Where this skill and
`${CLAUDE_PLUGIN_ROOT}/assets/templates/design.md` conflict, this skill
wins - the rule is general. Keep it unwritten until the review gate
passes. Mandatory content:

- **Boundary first**: This Spec Owns / Out of Boundary / Allowed
  Dependencies / Revalidation Triggers - concrete enough that reviewers
  can later detect boundary violations.
- **Considered Alternatives section**: 2-3 approaches with trade-offs
  and a recommendation. Rejected alternatives and their reasons stay
  visible in the document; deeper evaluation lives in research.md.
- **High-Level Architecture with a mermaid diagram** - mandatory at
  every complexity level, pure Mermaid syntax. The diagram must match
  the prose 100%: every component, boundary, and data flow appears in
  both, identically.
- **File Structure Plan**: concrete file paths, one clear responsibility
  per file - this section directly drives task `_Boundary:_` annotations
  and implementation briefs.
- **Technology Stack table** and **Testing Strategy** derived from the
  requirements' acceptance criteria, not generic patterns.
- **Requirements traceability**: every numeric requirement ID from
  requirements.md mapped to the components, contracts, or flows that
  realize it. Use IDs exactly as written; never invent or relabel them.

## Step 7 - Review gate

Review gate: apply
`${CLAUDE_PLUGIN_ROOT}/assets/rules/design-review-gate.md` -
bounded at 2 repair passes.

If the gate exposes a real requirements gap or ambiguity, do NOT write a
patched-over design: return BLOCKED naming the exact gap and pointing
back to `/sdd:spec-requirements`.

## Step 8 - Write and return

Write `.sdd/specs/<feature>/design.md` (and research.md, Step 5) only
after the gate passes, then return the summary block.

## Return contract

**To the fork (your final message).** Return exactly this block - the
caller parses the heading and the `- STATUS:` line mechanically:

```
## Design Summary
- STATUS: <DONE | BLOCKED>
- DISCOVERY: <full | light | skipped - one line on what was researched>
- APPROACHES: <one line per approach considered, marking the recommended one>
- CONCERNS: <one line each, if any>
- PATH: <.sdd/specs/<feature>/design.md, or - when BLOCKED>
- PHASE: <design phase bean id from Step 2, or `missing` - the gate closes with it>
- BLOCKERS: <BLOCKED only - the gap or condition, and the command to run>
```

**To the main context.** You invoked this fork; it cannot
ask the user anything, so you own the confirm gate. On DONE: present
a SHORT summary in chat - discovery type, the approaches considered
with the recommended one, boundary highlights, and concerns.

The full document is `.sdd/specs/<feature>/design.md`; point the
user at the path. Do not dump the document into chat.

No new open questions from you here - confirm-only. Then
AskUserQuestion:

1. **Approve** (Recommended) - the design phase is settled.
   Approval runs the independent validator FIRST (spec Revision 6):
   the phase completes only on its GO.
   - Dispatch the validate-design fork - Agent tool, general-purpose,
     `model: opus`, paths only:
     ```
     Agent(
       description: "Validate design for <feature>",
       subagent_type: general-purpose,
       model: opus,
       prompt: (paths only)
         Apply:       <abs-path>/skills/validate-design/SKILL.md
         Feature dir: .sdd/specs/<feature>/
         Document:    .sdd/specs/<feature>/design.md
         Return exactly the summary block the validate-design skill
         defines.
     )
     ```
     Parse discipline: only the exact summary block and its
     `- STATUS:` and `- VERDICT:` lines count; resume the fork once
     (SendMessage) if the block is missing,
     ambiguous, or replaced with prose. Present its verdict, any
     criterion verdicts, findings, and fixes to the user - short
     lists in chat, the file when PATH names one.
   - **GO** - the phase closes in this order (the design phase-bean
     id; `completed` IS the approval record, spec Revision 5):
     1. Tag: `beans update <design-phase-id> --tag validated`
     2. Hash, computed NOW - after the validator's fixes, at the GO
        moment (the fork never hashes; this write is yours):
        `shasum -a 256 .sdd/specs/<feature>/design.md`
     3. Append a `## Validation` round to the PHASE BEAN body
        (`--body-append`; create the section on the first round,
        later rounds append beneath it - only the latest
        `Doc-hash:` counts at later gates): date, verdict GO,
        `Doc-hash: <the sha256 just computed>`
        (this freshness write mirrors `${CLAUDE_PLUGIN_ROOT}/bin/sdd-gate`'s read)
     4. Complete: `beans update <design-phase-id> -s completed`
        Then name the next command in a code block:
     ```
     /sdd:spec-tasks
     ```
     MINOR findings travel with the document into the next phase -
     name them at the completion presentation. (Legacy case from
     the phase-gate check - no design phase bean: skip the writes
     above and name `/sdd:spec-init` for its heal path; a heal run
     creates the bean, and a re-run of this gate validates onto it.)
   - **NO_GO** - four-part escalation, verbatim, the validator's
     BLOCKING findings as the payload:
     ```
     1. Per plan: approval requires a validated design document -
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

   A standalone `/sdd:validate-design` run stays available anytime
   as a formative check; the approve gate above runs its own
   validation regardless.

2. **Edit** - the user supplies feedback. Append it under
   `## Round <K>` in
   `.sdd/specs/<feature>/workspace/design-edits.md` (create the file if
   needed; workspace files are append-only), then re-invoke
   `/sdd:spec-design` - a NEW fork reads the digest plus the existing
   document and edit-merges. Edit rounds are user-driven with no fixed
   cap, but each round must carry concrete feedback.
3. **Regenerate from scratch** - offer when design.md existed before
   this run. Append `## Round <K> - Regenerate from scratch` to the
   digest and re-invoke `/sdd:spec-design`.
4. **Stop** - the user takes over; the document stays on disk.

The re-entry BLOCKED case escalates with the Revision 5 triple:
**Reopen** (Recommended) - set the design AND tasks phase beans to
`todo` (`beans update <phase-id> -s todo` each) with a one-line reason
appended to each, then re-invoke `/sdd:spec-design`: the fork runs
under the reopened gate and the confirm gate re-completes it; **Accept
desync risk** - set only the design phase bean to `todo` (the gate must
open for the redo) and append a one-line dated note to the epic body
(`Desync accepted: design re-entered while the tasks gate reads
completed`), then re-invoke `/sdd:spec-design`: the redone design lands
while the tasks phase stays completed - the risk is on record, not
silent; **Cancel** - nothing changes.

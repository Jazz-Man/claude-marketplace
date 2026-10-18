---
name: validate-requirements
description: Generative fork - validate the active feature's requirements.md against EARS syntax, user-intent completeness, internal contradictions, steering alignment, and testability; apply only zero-semantics fixes and return a GO/NO_GO with evidence-quoted findings. Use after requirements are drafted, before or upon approval, or standalone as a formative check; for brownfield features it pairs with validate-gap.
context: fork
background: false
model: opus
---

# validate-requirements - the requirements document gate

## Role

You are a FORK: a fresh subagent with no conversation history. This skill
body is your entire task prompt - everything you need is resolved from
beans and files below. You NEVER ask the user questions (no
AskUserQuestion exists in your path) and you never dispatch subagents:
when you cannot proceed, return the BLOCKED status contract from the
Return contract section. The main context that invoked you owns all
dialogue and the approve gate.

Your job: validate the requirements DOCUMENT - the text on disk -
against the EARS standard, the user's stated intent, itself, and the
project's steering, then return a GO/NO_GO. You are the independent
gate the requirements approval dispatches before the phase may complete
(spec Revision 6); you also run standalone as a formative check anytime

- the same run either way, no phase state required. The drafter already
  applied the review gate before writing; you are the second opinion that
  decides whether approval may stand.

## Hard rules

1. Bash is limited to the beans CLI and read-only inspection.
2. **This skill writes no beans.** It resolves the active feature by
   reading beans; never write progress, approval, or blocked state into
   documents. Phase completion, the `validated` tag, and the
   `Doc-hash:` line are the main context's writes at the GO
   moment - never yours.
3. **No user questions.** Blocked means return BLOCKED, not stop-and-ask.
4. **Zero-semantics fixes only, all listed.** You may edit
   requirements.md solely for typos, wrong paths, formatting, and
   ID-label normalization - and every edit is listed in the return's
   Fixes applied list (`- FIXES_APPLIED:`). Anything that touches
   meaning - rewording an obligation, adding or removing a requirement,
   changing shall to should - is a finding, never an edit, however
   obvious the better text reads.
5. **No hash computation.** Revision 6 pairs the document hash with the
   phase-completion write: the main context computes it at the GO
   moment, after your fixes have landed. You never compute or record a
   hash.
6. **Quoted evidence or it did not happen.** Every finding cites
   `file:line` and quotes the offending text verbatim; contradiction
   and steering findings quote every side.
7. **English output** - fixed; no per-spec language configuration exists.

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

Keep the epic bean body at hand - its feature description is a
completeness input (Step 4).

## Step 2 - Load inputs

Read, under the spec directory from Step 1:

- `.sdd/specs/<feature>/requirements.md` - REQUIRED, the document under
  validation. Missing -> return BLOCKED pointing to
  `/sdd:spec-requirements`.
- `.sdd/specs/<feature>/workspace/qa-digest.md` - the user-intent
  record the drafter worked from, when present: every question with its
  answer, the settled in/out scope, constraints and edge cases.
- `.sdd/brief.md` - the workstream narrative from discovery, when
  present.
- `${CLAUDE_PLUGIN_ROOT}/assets/rules/ears-format.md` - the EARS
  patterns your syntax check enforces.
- `${CLAUDE_PLUGIN_ROOT}/assets/rules/requirements-review-gate.md` - the
  review checklist. It is written for the drafter (review-and-repair
  before writing); in fork form its repair loop is superseded: you
  record findings, and Hard rule 4 bounds your repairs to
  zero-semantics items.
- Steering: already in your context (project memory, loaded at session
  start) - apply it; do not re-read the files.

When the qa-digest is absent (legacy or externally authored document),
completeness checks against the brief and the epic description alone -
and says so in the return (Step 4, check 2).

## Step 3 - Zero-semantics fix pass

Scan requirements.md for mechanical defects and fix them in place,
recording every edit for the Fixes applied list:

- **Typos** - spelling corrections only where the intended word is
  unambiguous.
- **Wrong paths** - references to files or directories that do not
  match the real layout (the spec directory resolved in Step 1 is the
  authority); correct the string.
- **Formatting** - broken headings, list markers, or tables; stray
  markup.
- **ID-label normalization** - a heading like `1a` or `Requirement
One` becomes a numeric ID per the gate's mechanical check; update any
  in-document cross-references to that ID in the same fix.

NOT fixes, ever: rewording an obligation, changing its strength
(shall/should), adding, removing, merging, or splitting requirements,
moving a boundary, restructuring a criterion into EARS. Those change
meaning - record them as findings with the better text as the suggested
fix.

Apply the fixes, then re-read the file and verify the edits took. Every
check below quotes the FIXED text, so evidence line numbers stay true.

## Step 4 - Run the five checks

Each check produces findings; classify every finding **[BLOCKING]** (a
wrong or missing obligation - the document must change before approval)
or **[MINOR]** (real but deferrable; no correctness risk). A check is
PASS with no findings, CONCERN with only MINOR ones, FAIL with any
BLOCKING one.

1. **EARS correctness** (ears-format.md + the gate's mechanical checks):
   every acceptance criterion is an EARS line (When/While/If/Where or
   ubiquitous, `the [system] shall [response]`); every requirement has
   at least one criterion; headings carry numeric IDs only; no
   implementation language (technology names, API patterns) inside
   requirements. BLOCKING: a criterion that is not EARS, a requirement
   with no criterion, a technology choice shaping scope. MINOR: valid
   EARS with awkward phrasing.
2. **Completeness** (against qa-digest + brief + the epic description):
   every user-stated intent, constraint, and edge case maps to at least
   one requirement - and no orphan requirement answers nothing in them.
   BLOCKING: a stated intent with no covering requirement; an orphan
   adding obligations the user never stated. MINOR: an orphan that is a
   defensible derivation from stated intent (name the derivation).
3. **Contradictions**: requirements that cannot all hold - conflicting
   criteria, in/out boundary overlap, the same obligation stated twice
   with divergent responses. Quote every side. A contradiction is
   BLOCKING by nature: the document gives two answers to one question.
4. **Steering alignment**: requirements that violate an in-context
   steering rule - demanding what it forbids, omitting what it
   mandates. Evidence: quote the requirements.md line verbatim with
   `file:line`, and quote the steering rule's wording as loaded in your
   context (it has no file:line for you). BLOCKING: an obligation-level
   violation. MINOR: naming or terminology drift that changes no
   obligation.
5. **Testability**: every criterion states an observable, verifiable
   response. Flag untestable phrasing - "fast", "robust", "secure",
   "user-friendly" with no observable anchor - per the gate's
   normalization rule. BLOCKING: a criterion that cannot be verified at
   all. MINOR: verifiable but vaguer than the source material supports
   (suggest the concrete normalization).

One finding per distinct issue; group issues that share a root cause.
Every finding carries: severity, check name, quoted evidence
(`file:line` + verbatim text, every side for contradictions and
steering), and a suggested fix.

## Step 5 - Decide GO/NO_GO

- **GO**: zero BLOCKING findings. The document may be approved; MINOR
  findings travel with it.
- **NO_GO**: any BLOCKING finding. The document needs revision first;
  the phase stays open (Revision 6).

## Step 6 - Place the findings

If the findings list (every finding with evidence and fix, plus the
check results) exceeds 100 lines, write
`.sdd/specs/<feature>/workspace/validation-requirements.md` (create the
workspace directory if absent). If the file already exists from an
earlier round, APPEND a new `# Validation Round <K>` section after a
`---` separator - earlier rounds survive untouched (the workspace is
append-only). Round structure:

- Summary: 2-3 sentences.
- Check results: five lines (check, PASS/CONCERN/FAIL, one-phrase why).
- Findings: each in full - severity, check, quoted evidence, suggested
  fix.
- Fixes applied: one line each.
- Verdict: GO or NO_GO with 1-2 sentences of rationale.

Verify the write by reading the file back; the return then carries
one-line findings plus the PATH pointer.

At 100 lines or fewer, findings go inline in the return block - no file
is written.

## Return contract

**To the fork (your final message).** Return exactly this block - the
caller parses the heading and the `- STATUS:` line mechanically:

```
## Requirements Validation Summary
- STATUS: <DONE | BLOCKED>
- VERDICT: <GO | NO_GO>
- CHECKS: <five lines - EARS, Completeness, Contradictions, Steering, Testability - each PASS | CONCERN | FAIL, one-phrase why>
- BLOCKING: <one line per blocking finding, or none>
- MINOR: <count first, then one line each>
- FIXES_APPLIED: <one line per zero-semantics fix, or none>
- PATH: <.sdd/specs/<feature>/workspace/validation-requirements.md, or - when findings are inline>
- BLOCKERS: <BLOCKED only - the gap or condition, and the command to run>
```

One-line finding shape, used in BLOCKING, MINOR, and the workspace file
alike:
`[BLOCKING]|[MINOR] <check>: <file:line> "<verbatim quote>" -> <suggested fix>`
(contradictions and steering findings compress each side into the quote
or continue on indented lines).

**To the main context.** You invoked this fork; it cannot ask
the user anything, so you own the gate. On DONE: present the verdict
and the findings - short lists in chat, the workspace file when PATH
names one (point the user at the path; do not dump files into
chat). Then by verdict:

- **GO** - the requirements phase may complete per Revision 6: the
  phase bean closes with the `validated` tag and the document's hash
  recorded as its `Doc-hash:` line, computed at this moment, after the
  fork's fixes (the fork computed no hash and wrote no beans - those
  writes are yours). The wiring lives in the requirements approve gate.
- **NO_GO** - Present the four-part escalation (impl Step 9 shape)
  with payload <findings>.
- **BLOCKED** - present the blocker and the named command, then
  AskUserQuestion on how to proceed (resolve via that command / adjust
  inputs / stop).

Any later edit to requirements.md invalidates this validation
mechanically - the next gate recomputes the hash and escalates on
mismatch. Never treat a GO as surviving a document change.

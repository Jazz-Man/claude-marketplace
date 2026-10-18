---
name: discovery
description: Entry point for new work. Researches the user's idea against the codebase, the workstream brief, and beans state, then routes it via AskUserQuestion - extend an existing spec, no spec needed (answered directly in chat), a single new feature, or a sequential multi-spec initiative queued in beans. Writes .sdd/brief.md.
disable-model-invocation: true
argument-hint: <idea-or-request>
---

# discovery - route the work

## Role

You run INLINE in the main conversation. You are the entry point of the
sdd workflow: the user brings an idea or request, you research enough
to route it honestly, the user picks the route, you record the outcome.
You do not write requirements, designs, or task plans - downstream
skills own those. Your outputs are a routing decision, beans queue
entries when the route needs them, and `.sdd/brief.md`.

Exactly one feature is active at any time: the single epic bean with
status `in-progress`. This skill and `/sdd:spec-init` are the only
entry points that accept a new feature name; every other skill resolves
the feature from beans.

## Hard rules

1. Bash is limited to the beans CLI and read-only inspection.
2. **beans is the only tracker.** Queue state lives in beans via
   `--blocked-by` - never in documents. `.sdd/brief.md` carries the
   narrative; its queue section is a rendered snapshot, never a source
   of truth, and never checkbox state. Otherwise beans usage follows
   the global beans guide.
3. **AskUserQuestion, always - prose first.** Every routing decision is
   preceded by the analysis in chat prose (what research found, which
   routes fit, the trade-offs), then asked as a structured question
   (recommended option first, labeled).
4. **Sequential, never parallel.** Feature work proceeds one feature at
   a time. New specs queue as `todo` epics chained with `--blocked-by`;
   you never create a wave of simultaneously runnable epics, and no new
   spec starts while another feature is active.
5. **No spec is a legitimate outcome.** Answering or doing the work
   directly in the main chat is a first-class route, not a failure of
   discovery.
6. **State on disk, not chat.** Update `.sdd/brief.md` before ending
   the run; conversation text does not survive session boundaries.

## Step 1 - Load state

Read only what routing needs. If `.sdd/` is empty and no epics exist,
note "greenfield" and skip the adjacency checks.

- **beans**: `beans list --json -t epic -s in-progress` (the active
  feature, if any), `beans list --json -t epic -s todo` (queued
  follow-ups), `beans list --json -t milestone` (existing initiatives).
  Note ids and titles.
- **Workstream brief**: `.sdd/brief.md` when present - prior intent,
  decisions, and queue. You are resuming it, not starting over.
- **Specs inventory**: Glob `.sdd/specs/*/` and note the feature names.
  Read a spec's `requirements.md` boundary sections only when the idea
  is plausibly adjacent to that spec.
- **Steering**: already in your context (project memory, loaded at
  session start) - apply it; do not re-read the files.
- **Project surface**: list the project root; do not recurse.

## Step 2 - Research what routing needs

Routing claims must rest on evidence: which specs exist, what the code
already does, what the idea actually touches.

- **Codebase survey via subagent**: when the idea touches an existing
  codebase, dispatch ONE general-purpose agent and let the summary -
  not the raw exploration - enter the main context:

  ```
  Agent(
    description: "Survey codebase for <idea>",
    subagent_type: general-purpose,
    prompt: Survey this codebase against the following idea:
      "<one line>". Apply the `lsp-code-analysis` skill (LSP first,
      Grep/Glob fallback). Return ONLY a summary (under 150 lines): (1) tech
      stack and conventions, (2) module layout, (3) existing behavior
      the idea touches, (4) which parts read as extensions of existing
      modules vs genuinely new boundaries, (5) specs under .sdd/specs/
      adjacent to the idea, if any. No file dumps.
  )
  ```

- **Skip the dispatch** when the request is small or Step 1 already
  answers it - trivial fixes, config changes, questions.
- **External research via subagent**: only when routing itself depends
  on it (is this even buildable with library X?) - same dispatch shape,
  WebSearch/WebFetch inside the subagent; raw search results never
  enter the main context.
- Technical approach selection with trade-offs is NOT yours: it belongs
  to `/sdd:spec-design`. You research to route, not to architect.

## Step 3 - Clarify the idea

Ask ONE question at a time via AskUserQuestion - 2-4 concrete options
when you can derive them, free text always possible. Boundary-first
priorities:

1. Who has the problem, and what pain does it cause?
2. What should be true when this is done?
3. Natural responsibility seams - where could this split so parts can
   proceed independently?
4. What is explicitly NOT owned, even if related?
5. Constraints - technology, compatibility, timeline?

Ask only what Steps 1-2 did not answer; skip every question the brief,
the epic description, or steering settles. Stop when you can state the
idea's boundary in two or three sentences. Detailed requirements
shaping belongs to `/sdd:spec-requirements`.

## Step 4 - Present the routing decision

Write the analysis in chat prose FIRST:

- The idea in one or two sentences, per the clarifications
- What research found: adjacent specs, codebase reality, constraints
- Each route that fits, with its trade-off - what it buys, what it
  costs, what it delays
- **When an active feature exists, say so explicitly in the prose and
  in the question**: any new feature is queued behind the active epic
  and starts only after it completes - or replaces it if it is
  cancelled. New work never begins alongside the active feature.

Then ask via AskUserQuestion. Offer only the routes that genuinely fit,
at most 4 options (the tool's limit), recommended first and labeled:

1. **Extend `<spec>`** - the request lives inside an existing spec's
   boundary. No new spec, fastest to absorb; the spec grows and its
   boundary can blur.
2. **No spec needed** - answer or do it directly in the main chat.
   Fastest; no artifacts, no review gates, no beans trace.
3. **Single new feature `<name>`** - one new spec through the full sdd
   cycle. Full discipline for one boundary; heaviest process per unit
   of work.
4. **Multi-spec initiative** - several features under a milestone,
   queued strictly one after another. Right when the seams are real;
   slowest to first value, and parallel it will never be.

A **mixed** decomposition (extensions plus new specs plus direct items)
appears as its own option when it fits; its description carries the
breakdown, the prose above carries the detail. When the idea matches an
already-queued epic, offer **Start the queued `<feature>`** instead of
a fresh single-feature option.

## Step 5 - Execute the chosen route

### No spec needed

Answer the question or do the small work right here in the
conversation; this skill ends when that is done. Record the decision
and its rationale in `.sdd/brief.md`, create no beans, name no next
command.

### Extend an existing spec

Create no beans. Record in `.sdd/brief.md` which spec and why. The
next command depends on beans state:

- The extended feature IS the active epic -> `/sdd:spec-requirements`
  (its existing-document gate merges the change intent).
- Otherwise -> `/sdd:spec-init "<feature>"`: it finds the feature's
  existing epic by name and re-activates it, guarding on any active
  feature first.

### Single new feature

- **No epic in progress**: do not create the epic - `/sdd:spec-init`
  births it. Record the feature name, one-line description, and
  rationale in `.sdd/brief.md`.
- **An epic is in progress**: this is a follow-up. Queue it - never
  start it alongside the active feature:

  ```bash
  beans create "<name>" -t epic -d "<one-line description>" -s todo
  beans update <new-epic-id> --blocked-by <active-epic-id> \
    --body-append "Queued as follow-up behind <active-epic-id> (<YYYY-MM-DD>)."
  ```

  It starts only after the active feature completes - or replaces it
  if that one is cancelled; `/sdd:spec-init` offers exactly that
  choice when the user comes to birth it.

### Multi-spec initiative

1. Propose the decomposition in prose: each feature's seam in one line,
   the order, and why this order. Confirm via AskUserQuestion (adjust
   the list / adjust the order / proceed) BEFORE creating any beans.
2. Create the milestone, then the epics - one chain, strictly
   sequential:

   ```bash
   beans create "<initiative title>" -t milestone \
     -d "<intent one-liner>" -s todo

   # per feature, in order:
   beans create "<feature>" -t epic -d "<one-line description>" -s todo

   # then link each epic:
   beans update <epic-id> --parent <milestone-id> \
     --body-append "Queued under <milestone-id> (<YYYY-MM-DD>)."
   # ...plus --blocked-by <previous-epic-id> for every epic after
   # the first
   ```

   - The FIRST epic gets no `--blocked-by` - unless an epic is
     in progress (then `--blocked-by <active-epic-id>`) or the user
     stated earlier work that must land first.
   - Each next epic is blocked by its predecessor and nothing else.
     Exactly one epic of the chain is ever runnable at a time. If the
     user asks for two specs in parallel, that is the
     single-active-feature rule talking - keep the chain linear.

3. Append the intent and links to the milestone body:

   ```
   Intent: <one line>
   Brief: .sdd/brief.md
   Queue: <epic-1> -> <epic-2> -> <epic-3> (strictly sequential)
   ```

### Mixed

Execute each leg under its own rule above: extensions recorded (next
command per target), new specs queued as the sequential epic chain,
direct items recorded in `.sdd/brief.md` with no beans. The next
command is whichever leg comes first in the agreed order - usually the
chain's first feature.

## Step 6 - Write `.sdd/brief.md`

The single resume document. Write it BEFORE the closing summary. When
it already covers this workstream, update it in place; when a new
initiative begins and the file holds an earlier one, add a new dated
section on top and leave prior content untouched below.

```markdown
# Workstream Brief

## <Initiative or feature title> (<YYYY-MM-DD>)

### Intent

<who has the problem, what changes when done - two or three sentences>

### Scope

- **In**: <what this workstream includes>
- **Out**: <what it explicitly excludes>

### Decisions

<each decision with its rationale: route taken, boundaries drawn,
order chosen - and the alternatives rejected>

### Open Questions

<unresolved items, each with where it will be resolved:
requirements interview, design, a later initiative>

### Queue

<rendered snapshot only - beans is the source of truth; plain ordered
lines, never checkboxes>

1. <epic-id> - <feature> - todo
2. <epic-id> - <feature> - blocked by 1
```

## Step 7 - Close

A SHORT summary:

- **Route**: <chosen route, one line>
- **Beans**: <milestone/epic ids created or queued, if any>
- **Brief**: `.sdd/brief.md`

Then name the next command for the chosen route in a code block:

- Single new feature or multi-spec initiative (no active feature):
  ```
  /sdd:spec-init "<first feature>"
  ```
- Extend, feature active:
  ```
  /sdd:spec-requirements
  ```
- Extend, feature not active:
  ```
  /sdd:spec-init "<feature>"
  ```
- Queued follow-up behind an active feature: name
  `/sdd:spec-init "<feature>"` and say it will refuse until the active
  feature is completed or scrapped - by design.
- No spec needed: no command - the work happened here.

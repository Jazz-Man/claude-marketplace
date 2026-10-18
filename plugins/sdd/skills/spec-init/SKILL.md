---
name: spec-init
description: Birth a new feature - the only skill that creates one. Guards the single-active-feature rule, creates .sdd/specs/<name>/ and the in-progress epic bean that records the spec path, then names the next command.
argument-hint: <feature-name-or-description>
---

# spec-init - feature birth

## Role

You run INLINE in the main conversation. This skill is deliberately
lightweight: no subagents, no document generation. It collects the
feature name and description, guards the single-active-feature rule,
creates the spec directory and the epic bean, seeds its three phase-gate
beans, records where the feature lives, and hands off. Requirements, design, and tasks are produced by
their own skills.

Exactly one feature is active at any time (spec 5.5). The active feature
IS the single epic bean with status `in-progress`: every other sdd skill
resolves the feature from it and takes no feature argument. This skill
and `/sdd:discovery` are the only entry points that accept a new feature
name/description - the moment a feature is born.

## Hard rules

1. Bash is limited to the beans CLI, `mkdir`, and read-only inspection.
2. **beans is the only tracker.** Never write progress, approval, or
   blocked state into documents. The epic bean body carries the spec
   path - keep its recorded lines stable; other skills parse them.
3. **AskUserQuestion, always.** Every choice-point gets explanation in
   chat prose first, then the structured question (recommended option
   first, labeled, when you have one).

## Step 1 - Collect name and description

- With `$ARGUMENTS`: derive a kebab-case feature name and a one-line
  description from them.
- Without arguments, or when the name is ambiguous: ask via
  AskUserQuestion, offering 2-3 candidate kebab-case names as options
  when you can derive them (the user can always answer freely).

Uniqueness: if `.sdd/specs/<name>/` already exists for a different
feature, append a numeric suffix (`<name>-2`) and say so in the summary.

## Step 2 - Guard the single active feature

Query beans: `beans list --json -t epic -s in-progress`.

- **None** -> Step 3.
- **One or more** -> refuse to birth a new feature while one is active
  (spec 5.5). Explain the situation in prose, then ask ONE question per
  in-progress epic via AskUserQuestion:
  1. **Complete it** - you run the beans updates:
     `beans update <epic-id> -s completed` with a short
     `## Summary of Changes` appended per the global beans guide, and
     the same status change for the epic's incomplete task beans.
  2. **Scrap it** - cancellation: append a one-line reason, then
     `beans update <epic-id> -s scrapped` and the same for its
     incomplete task beans. Completing or scrapping also unblocks any
     follow-up epics queued `--blocked-by` this one.
  3. **Stop** - abort the run; the user resolves beans manually.
     Any "stop" ends the skill; otherwise re-check and continue to Step 3
     once no in-progress epic remains.

**Heal carve-out**: if the active epic's phase beans are missing or
incomplete (partial legacy state - e.g. `Phase — tasks` absent), a
follow-up `/sdd:spec-init` invocation with the SAME feature name
performs ONLY the idempotent phase-bean completion (Step 3.4) - the
refusal guard does not apply to heal runs (no new epic is created;
matched by slug against the in-progress epic). The heal run ends once
Step 3.4 reports what it created or skipped; a name that matches no
in-progress epic is not a heal run - the guard above applies unchanged.

## Step 3 - Create the feature

1. **Directory**: `mkdir -p .sdd/specs/<name>/`.
2. **Epic bean - activate or create, never duplicate**: discovery queues
   follow-up features as `todo` epic beans. List epics
   (`beans list --json -t epic`), normalize the feature name and every
   epic title to a kebab-case slug (lowercase; non-alphanumeric runs
   become a single `-`), and compare on the slug:
   - **Exactly one match** (status `todo` or `draft`) -> activate it:
     `beans update <id> -s in-progress`.
   - **Zero or multiple matches** -> never silently create a possible
     duplicate. Show the candidate epics (the matches, or all queued
     `todo`/`draft` epics when none matched) in prose, then
     AskUserQuestion: pick the epic that IS this feature / create a new
     epic after all (`beans create "<name>" -t epic -s in-progress`).
3. **Record in the epic bean body** (append; stable lines - later skills
   parse them):
   ```
   Spec path: .sdd/specs/<name>/
   Description: <one line>
   Created: <YYYY-MM-DD>
   ```
   When activating a queued epic, keep its existing body content (its
   description, its queued-by notes); add only the missing lines.
4. **Phase beans** - the three persistent phase gates under the epic
   (spec Revision 5), all `todo` and tagged `phase`, chained in flow
   order: requirements -> design -> tasks. Each body carries one line
   naming its gate:
   ```
   beans create "Phase — requirements" -t task -s todo --tag phase --parent <epic-id> -d "Phase gate for <feature>: completed = approved (spec Rev 5)."
   beans create "Phase — design" -t task -s todo --tag phase --parent <epic-id> -d "Phase gate for <feature>: completed = approved (spec Rev 5)."
   beans create "Phase — tasks" -t task -s todo --tag phase --parent <epic-id> -d "Phase gate for <feature>: completed = approved (spec Rev 5)."
   ```
   Capture each bean's id from the create output, then chain:
   ```
   beans update <design-phase-id> --blocked-by <requirements-phase-id>
   beans update <tasks-phase-id> --blocked-by <design-phase-id>
   ```
   This step is idempotent and covers BOTH paths above: when activating
   a queued epic that already carries phase beans (created by an older
   flow or manually), list the epic's children
   (`beans query --json '{ bean(id: "<epic-id>") { children { id title tags } } }'`),
   match on exact title plus the `phase` tag, skip the ones that exist,
   and create only the missing - adding only the chain links that are
   not yet present (`blockedByIds` on the child).

## Step 4 - Summary and handoff

A SHORT summary:

- **Feature**: `<name>` - the one-line description
- **Spec directory**: `.sdd/specs/<name>/`
- **Epic bean**: `<bean-id>`
- **Phase chain**: requirements -> design -> tasks beans exist under the
  epic - each gate closes when its phase is approved

Then the next command in a code block:

```
/sdd:spec-requirements
```

The next skill resolves the feature from the in-progress epic - no
argument.

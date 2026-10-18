---
name: steering
description: Create, edit, bootstrap, and sync project rules in .claude/rules/ (local or global). Generate core rules from the codebase, sync drifted rules, create domain or topic rules, and edit existing ones. Every change is drafted, conflict-checked, optimized, and shown for approval before writing.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# steering Skill

Maintain `.claude/rules/` (local: `<project>/.claude/rules/`) and `~/.claude/rules/` (global) as persistent project instructions. One skill, four modes, two scopes.

## Reference files (this skill's directory)

- `references/steering-principles.md` — authoring philosophy (patterns over lists, etc.). READ THIS before drafting any rule.
- `references/core/{product,tech,structure}.md` — core templates, used by **bootstrap**.
- `references/custom/*.md` — domain templates, used by **create** as starting points. Not exhaustive; free-form is first-class.

## How rules load (why conflicts matter)

Claude Code loads BOTH scopes at session start (global first, then local). Rules are context, NOT enforced config — Claude Code does not resolve contradictions between rules, so a local rule and a global rule that disagree may each be followed arbitrarily. Therefore you MUST surface conflicts for the user; never leave a local rule fighting a global one.

## Interaction model

- Use `AskUserQuestion` for: scope choice, mode choice, conflict resolution, and write approval.
- For **edit file-selection**, print a numbered list of rules from BOTH scopes (filename + one-line description) and let the user pick by name or number. (Do not use `AskUserQuestion` for this — it is capped at four options.)

## Scope-gated modes

Ask scope FIRST (`AskUserQuestion`: global / local), then offer only the modes valid for that scope:

- **global** (`~/.claude/rules/`) → **create**, **edit** only.
- **local** (`<project>/.claude/rules/`) → **bootstrap**, **sync**, **create**, **edit**.

## Modes

- **bootstrap** (local) — `.claude/rules/` is empty or missing core files. Draft the core 3 (`product.md`, `tech.md`, `structure.md`) from `references/core/` + codebase patterns.
- **sync** (local) — core files already exist. Draft additive updates from codebase drift (preserve user content); conflict-check the local rules against global rules.
- **create** (local + global) — a new domain or arbitrary-topic rule. If `references/custom/{name}.md` matches the topic, use it as a starting point; otherwise draft FREE-FORM from the topic + codebase (free-form is first-class, not a fallback). When the scope is local, conflict-check against global rules.
- **edit** (local + global) — pick a rule (numbered list, both scopes), apply the user's text-only refine (no codebase re-analysis), and conflict-check it (local scope only: against global rules).

## Generation pipeline (ALL modes — nothing is written until approved)

Every mode produces a DRAFT through this pipeline. Two isolation boundaries keep the main chat clean; heavy cognitive work happens in subagents.

1. **Gather input** — scope (`AskUserQuestion`), mode (`AskUserQuestion`), and the rule description (create/edit, any form) or the codebase (bootstrap/sync).
2. **Subagent A — isolated: analyze + conflict-check.** Dispatch a fresh subagent with the `Agent` tool. It:
   - reads the description and/or codebase plus existing rules in the relevant scope(s);
   - for create/bootstrap: drafts the rule(s) following `references/steering-principles.md` and the generated-rule format below;
   - runs conflict detection (see next section) when operating locally against global rules;
   - returns ONLY the DRAFT plus a conflict report. It does NOT write files.
3. **Conflict resolution (main)** — if the report lists conflicts, resolve each via `AskUserQuestion` per the conflict policy; apply the user's choice to the draft.
4. **Subagent B — isolated: optimize.** Dispatch a fresh subagent that invokes the `llm-application-dev:prompt-optimize` skill on the resolved draft text and returns the polished text. If that skill is unavailable, surface the problem — do NOT substitute or skip.
5. **Present** — show the optimized draft plus the conflict report for review.
6. **Approve / revise / abort (`AskUserQuestion`):**
   - **approve (no edits)** → write to the chosen scope root;
   - **revise (user has edits)** → take the edited version as the new input and loop back to step 2;
   - **abort** → discard, write nothing.
7. **Write ONLY on clean approval** — write to `{rules-root}/{name}.md`.

### Why two subagents with a user step between

Conflicts are resolved by the user BEFORE optimization — never optimize a draft that is about to change.

## Conflict detection & resolution (local ops vs global rules)

1. **Filename/topic gate (deterministic):** flag a local rule whose filename or topic matches an existing global rule — a same-topic match signals an intended specialization that the user should confirm.
2. **Content-contradiction scan (for overlapping rules):** compare the content of the new/edited local rule against related global rules; surface contradictions with QUOTED evidence from both sides plus a confidence label. The scan NEVER auto-acts — it only surfaces candidates for the human.
3. **Resolution:** warn and let the user decide (`AskUserQuestion`: proceed / edit the global rule / abort). Never auto-mutate global state.

## Generated rule format

- Single domain per file, 50–200 lines, imperative voice, concrete project-specific detail (commands, paths, types).
- "Patterns over lists." Flexible structure adapted to the topic (Core Principle → workflow/steps → concrete rules → checklist/integration as fits).
- Close with an italic line stating the rule's intent. Plain markdown, no YAML frontmatter (rules are unconditional).

## Output

- Write target — local: `<project>/.claude/rules/{name}.md`; global: `~/.claude/rules/{name}.md`. Kebab-case filename.
- After writing, give a short chat summary of what was written. The file is written only after approval.

## Safety

- Never include secrets, keys, passwords, or tokens (see `references/steering-principles.md`).
- Never auto-mutate global rules.
- When uncertain about scope or a conflict, ask the user.

# Task Generation Rules

## Core Principles

### 1. Natural Language Descriptions

Focus on capabilities and outcomes, not code structure.

**Describe**:

- What functionality to achieve
- Business logic and behavior
- Features and capabilities
- Domain language and concepts
- Data relationships and workflows

**Avoid**:

- File paths and directory structure
- Function/method names and signatures
- Type definitions and interfaces
- Class names and API contracts
- Specific data structures

**Rationale**: Implementation details (files, methods, types) are defined in design.md. Tasks describe the functional work to be done.

### 2. Dependency Principle — edges in the bean graph, not number order

**The dependency graph is the plan's sequencing mechanism**: each leaf task
bean carries `blockedByIds` edges to the beans that must finish first. Task
numbers are labels for humans (grep-able reading order) — never the gating
mechanism. The executor resolves "what runs next" from the graph, so a plan
whose order lives only in its numbering is an unsequenced plan.

**Chain by default**: within a major group, each leaf is blocked-by its
immediate predecessor; each major container is blocked-by the previous
major. Omit an edge only when the design genuinely makes the work
independent — and say so in that leaf's brief.

**Tasks must follow this phase order**:

1. **Foundation**: Environment setup, test infrastructure, shared utilities, database schema, configuration
2. **Core**: Primary feature implementation
3. **Integration**: Wiring components together, cross-boundary connections
4. **Validation**: E2E tests, edge cases, regression checks

**Rationale**: Foundation work unblocks everything else. Placing setup tasks early prevents downstream blocking.

### 3. Task Integration & Progression

**Every task must**:

- Build on previous outputs (no orphaned code)
- Connect to the overall system (no hanging features)
- Progress incrementally (no big jumps in complexity)
- Respect architecture boundaries defined in design.md (Architecture Pattern & Boundary Map)
- Honor interface contracts documented in design.md
- Use major task summaries sparingly—omit detail bullets if the work is fully captured by child tasks.

**End with integration tasks** to wire everything together.

### 4. Dependency Declaration

**Default**: every leaf carries a `blockedByIds` edge to its immediate
predecessor (chain within the major; major containers chain to the previous
major). The edge is native beans state — written with `--blocked-by` at bean
creation, readable by tools, and never expressed as prose order in a body.

**Explicit `_Depends:` declaration required when**:

- A leaf depends on a non-adjacent bean (a specific earlier leaf in another major-task group)
- The dependency is non-obvious from the chain alone

**Format**: `_Depends: 1.2, 2.3_` — placed alongside `_Requirements:_` in task detail sections; each entry becomes one extra `--blocked-by` edge at bean creation.

**Designed independence**: a leaf with no chain edge must say in its brief why it is independent (the executor treats "no incoming edge" as intentional).

### 5. Boundary Scope

**Each task should declare its component boundary** using design.md component/module names:

- `_Boundary: AuthService_` or `_Boundary: API Layer, UserRepository_`
- Helps validate independence: tasks with non-overlapping boundaries carry no hidden cross-boundary dependency
- Helps agents understand scope: what to touch and what not to touch

**When to use**: Declare it for each executable task unless the component scope is obvious from the description alone; component names must come from design.md.

**Boundary rule**:

- Each executable task should stay within a single responsibility boundary
- If work must cross boundaries, make it an explicit integration task rather than a normal implementation task
- Do not hide cross-boundary coordination inside a task that appears local

### 6. Flexible Task Sizing

**Guidelines**:

- **Major tasks**: As many sub-tasks as logically needed (group by cohesion)
- **Sub-tasks**: 1-3 hours each, 3-10 details per sub-task
- Balance between too granular and too broad

**Don't force arbitrary numbers** - let logical grouping determine structure.

### 7. Requirements Mapping

**End each task detail section with**:

- `_Requirements: X.X, Y.Y_` listing **only numeric requirement IDs** (comma-separated). Never append descriptive text, parentheses, translations, or free-form labels.
- For cross-cutting requirements, list every relevant requirement ID. All requirements MUST have numeric IDs in requirements.md. If an ID is missing, stop and correct requirements.md before generating tasks.

### 7.5 Observable Completion

**Each executable task must include at least one detail bullet that describes the observable completed state**:

- Phrase it as a deliverable, runtime behavior, persisted state, UI state, endpoint behavior, test result, or integration outcome
- Avoid vague bullets like "implement support", "wire things up", or "handle logic" unless paired with a concrete observable result
- Prefer making one detail bullet clearly answer: "What will be true when this task is done?"
- Keep this within the existing task body; do not add extra bookkeeping fields

### 8. Code-Only Focus

**Include ONLY**:

- Coding tasks (implementation)
- Testing tasks (unit, integration, E2E)
- Technical setup tasks (infrastructure, configuration)

**Exclude**:

- Deployment tasks
- Documentation tasks
- User testing
- Marketing/business activities

## Task Plan Review Gate

Before creating the task briefs, review the draft plan and repair local issues until it passes or a true spec gap is discovered.

### Coverage Review

- Every requirement ID from `requirements.md` must appear in at least one task.
- Every design component, interface/contract, integration point, runtime prerequisite, and validation concern from `design.md` must be represented by at least one task.
- If coverage is missing because the task plan is incomplete, repair the draft tasks and review again.
- If coverage cannot be added cleanly because requirements or design are ambiguous, contradictory, or underspecified, stop and return to the requirements/design phase instead of papering over the gap in the task plan.

### Executability Review

- Every sub-task must be executable as written, usually within 1-3 hours.
- Every sub-task must produce a verifiable deliverable (behavior, artifact, endpoint, UI state, config, migration, test, or integration result).
- Every executable sub-task must include at least one detail bullet that states the observable completion condition.
- Split tasks that combine multiple independently verifiable outcomes.
- Split tasks that combine multiple responsibility boundaries unless they are explicit integration tasks.
- If many tasks require broad `_Boundary:_` scopes or repeated cross-boundary coordination, stop and return to design — or split the feature into separately queued specs — instead of forcing the spec through task generation.
- Merge or collapse tasks that are too small, bookkeeping-only, or not meaningful execution units.
- Make implicit prerequisites explicit as preceding tasks.
- Re-check `_Depends:_` and `_Boundary:_` after edits so dependency declarations still match the design boundaries and dependency graph.

### Review Loop

- Run the review gate on the drafted briefs before any task bean is written.
- If issues are task-plan-local, repair the draft and re-run the review gate.
- Keep the loop bounded: no more than 2 review-and-repair passes before escalating a real spec gap.
- Sync the task beans only after the review gate passes.

### Deferrable Test Coverage Tasks

- The plan format has no optional marker: every sub-task in the plan is planned work. When the design already guarantees functional coverage and rapid MVP delivery is prioritized, place purely test-oriented follow-up work (e.g., baseline rendering/unit tests) at the end of the Validation phase instead of interleaving it with implementation.
- A deferrable test sub-task must directly reference the acceptance criteria from requirements.md that it verifies in its detail bullets.
- Never treat implementation work or integration-critical verification as deferrable—reserve late placement for auxiliary test coverage that can be revisited post-MVP. Deferring a requirement entirely requires documented rationale in the plan.

## Task Tree Rules

### Physical shape (beans CLI constraints)

- **Major groups are real container beans**: type `feature`, parent = the
  feature epic, own concise `## Brief` (scope of the group, no detail
  bullets). The beans CLI allows task beans only under milestone, epic, or
  feature parents — and feature under feature is refused — so the tree has
  exactly two task levels:
  - **Major container** (`1`, `2`, ...): feature-type bean under the epic;
    never executed itself, completes by rollup when all its leaves are
    completed/scrapped.
  - **Leaf task** (`1.1`, `1.2`, ...): task-type bean under its major; the
    atomic work unit an implementer is dispatched against.
- **Deeper logical decomposition flattens**: sub-sub-steps (no physical
  `1.1.1` bean) become dotted-number leaves under the same major
  (`1.1`, `1.2`, ...), sequenced by `blockedByIds` edges.
- **Single-item collapse**: if a major would contain only one actionable
  leaf, drop the container — that leaf becomes a flat task child of the
  epic with the major's number.

### Sequential Numbering

- Major groups MUST increment: 1, 2, 3, 4, 5...
- Leaves reset per major: 1.1, 1.2, then 2.1, 2.2...
- Never repeat major numbers; numbers are labels, edges are the sequence.

### Independence analysis (edge decisions)

- Execution is strictly sequential; the dependency edges encode it.
- Chain every leaf to its immediate predecessor and every major to the
  previous major by default. Omit an edge only when ALL hold:
  - No data dependency on other pending tasks
  - No shared file or resource contention
  - No prerequisite review/approval from another task
  - `_Boundary:_` annotations confirm non-overlapping component scopes
- A leaf depending on a non-adjacent bean declares `_Depends: X.X_`
  explicitly (one extra edge each).
- Foundation-phase tasks establish shared prerequisites — Core-phase tasks
  typically satisfy the independence criteria once foundation is complete.
- Validate that boundary declarations match the boundaries defined in the Architecture Pattern & Boundary Map.
- Confirm API/event contracts from design.md do not imply hidden ordering the plan fails to declare.
- Explicitly call out dependencies that break independence even when tasks look similar.

### Brief Format

The plan is the bean tree — one concise `## Brief` per major container
(scope only) and one full `## Brief` per leaf task under its major. Draft
shape:

```markdown
- 1. Foundation: environment and test infrastructure setup
- 1.1 Sub-task description
  - Detail item 1
  - Detail item 2
  - Observable completion condition
  - _Requirements: X.X_

- 2. Core feature A
- 2.1 Sub-task description
  - Detail items...
  - Observable completion condition
  - _Requirements: Y.Y_
  - _Boundary: AuthService_

- 2.2 Sub-task description
  - Detail items...
  - Observable completion condition
  - _Requirements: Z.Z_
  - _Boundary: UserRepository_

- 3. Integration and wiring
- 3.1 Sub-task description
  - Detail items...
  - Observable completion condition
  - _Depends: 2.1, 2.2_
  - _Requirements: W.W_
```

Each `N.` major line becomes one feature-type container bean under the epic
(number + one-line scope); each `N.M` leaf becomes one task-type bean under
that major: number and title in the bean's `Task:`/`Title:` lines,
description and bullets its body, metadata lines kept verbatim, and a
`--blocked-by` edge per chain/predecessor link (the `_Depends:` entries add
theirs on top).

## Requirements Coverage

**Mandatory Check**:

- ALL requirements from requirements.md MUST be covered
- Cross-reference every requirement ID with task mappings
- If gaps found: Return to requirements or design phase
- No requirement should be left without corresponding tasks

Use `N.M`-style numeric requirement IDs where `N` is the top-level requirement number from requirements.md (for example, Requirement 1 → 1.1, 1.2; Requirement 2 → 2.1, 2.2), and `M` is a local index within that requirement group.

Document any intentionally deferred requirements with rationale.

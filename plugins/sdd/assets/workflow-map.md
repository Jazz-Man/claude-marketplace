<SUBAGENT-STOP> If you were dispatched as a subagent to execute a task, ignore this block.

<EXTREMELY_IMPORTANT>

# sdd - spec-driven development (default workflow map)

Spec-driven development with subagent-first execution; skills run as /sdd:<name>.

**Fixed paths.** Feature specs live in `.sdd/specs/<feature>/` - requirements.md, design.md, and the
append-only `workspace/` (review packages and large evidence; briefs/reports/notes live in bean
bodies). The workstream brief is `.sdd/brief.md`; nothing is configurable.

**Phase flow.** `/sdd:discovery` -> `/sdd:spec-init` -> `/sdd:spec-requirements` -> `/sdd:spec-design`
-> `/sdd:spec-tasks` -> `/sdd:impl`, one phase per command, no chain skill: a phase ends with its
result and a confirm-only question naming the next (quick one-off work stays in the chat).

**Phase gates.** spec-init births the epic plus three `phase` beans (requirements, design, tasks);
`completed` on one IS the approval. Approving requirements/design auto-runs its validator: GO
closes the phase with the `validated` tag and a `Doc-hash:` of the document; NO_GO escalates,
the phase stays open. A later-edited document is stale - gates recompute the hash and escalate,
not silently re-validate. Task beans are born `draft`; approve promotes; impl gates on all three.

**Single active feature.** The active feature IS the one epic bean with status `in-progress`; every
other skill resolves it from beans and takes no feature argument. Only spec-init and discovery
accept a new feature name; follow-ups queue as `todo` epics blocked by the active one.

**beans is the only tracker.** State lives in beans, artifacts in files; follow the global beans guide.
Never write progress, approvals, or checkbox flips into documents; no plan document exists - the
task beans ARE the plan, as a TREE (feature-type major containers, task leaves) whose dependency
edges (`blockedByIds`) are the sequence; a multi-step task is decomposed into child beans, never a
checklist in a body (`## Brief`/`## Report`/`## Notes`/`## Validation`/`## Parking lot` body
sections; verdict lines carry mirror tags). Resume by querying beans, never by re-parsing documents.

**Mechanical gates.** The sequence is bash-checkable: `sdd-phase <skill>` verifies each skill's
phase precondition, `sdd-gate <epic>` the full impl entry, `sdd-next` the next runnable leaf;
PreToolUse hooks run these at invocation time and block out-of-order `/sdd:*` calls and
tracking writes into documents (`.beans/` is CLI-only; specs never carry checkboxes).

**Code analysis.** Any code reading or navigation, in any phase and in any dispatched subagent,
applies the `lsp-code-analysis` skill: LSP operations first (definitions, references, types,
call structure), Grep/Glob as the fallback - semantic awareness beats text matching.

**Interaction.** Every question or choice-point goes through AskUserQuestion; subagents never
ask the user - they return status contracts. Clarifying questions only in discovery and
requirements; design and tasks are confirm-only. Stop-per-task: after each impl task the
orchestrator stops - the user reviews, tests, and commits.

**Models (pinned, never the agent's choice).** Generation of requirements, design, and tasks:
opus. All reviews and validations: opus. Implementation: sonnet, raised to opus in rounds 4-5.

**Escalation - no blind decisions.** Any concern or deviation surfaces in four parts: per plan /
actual / why it matters / options (accept as-is / fix now / change the plan / abort). The user decides via AskUserQuestion.

| Skill                                                                                          | Purpose                                                         |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| /sdd:init                                                                                      | write the user-owned .claude/rules/sdd.md from this default     |
| /sdd:discovery                                                                                 | entry point: research and route new work; writes .sdd/brief.md  |
| /sdd:spec-init                                                                                 | birth a feature: spec directory + epic bean + three phase beans |
| /sdd:spec-requirements                                                                         | interview the user, dispatch the EARS draft (opus)              |
| /sdd:spec-design                                                                               | fork: research the feature and write design.md                  |
| /sdd:spec-tasks                                                                                | fork: draft one task bean (## Brief) per sub-task               |
| /sdd:impl                                                                                      | orchestrator: subagent implement/review, stop-per-task          |
| /sdd:review                                                                                    | adversarial task-local review protocol                          |
| /sdd:debug                                                                                     | root-cause-first debugging protocol                             |
| /sdd:verify-completion                                                                         | fresh-evidence gate for completion claims                       |
| /sdd:validate-requirements                                                                     | requirements gate: EARS, completeness, contradictions           |
| /sdd:validate-gap                                                                              | requirements vs codebase gap analysis (research.md)             |
| /sdd:validate-design                                                                           | design quality review, verdict per criterion                    |
| /sdd:validate-impl                                                                             | feature-level GO/NO_GO gate                                     |
| /sdd:steering                                                                                  | manage .claude/rules/ in the target project                     |
| A user-owned `.claude/rules/sdd.md` (written via /sdd:init) always overrides this default map. |
| </EXTREMELY_IMPORTANT>                                                                         |

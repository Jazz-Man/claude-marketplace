---
# cc-sdd-n713
title: "sdd: integrate LSP-first code-analysis rule"
status: in-progress
type: task
priority: normal
created_at: 2026-10-05T15:23:19Z
updated_at: 2026-10-05T15:40:22Z
---

User always instructs agents to use LSP tools for codebase analysis; most target projects have an LSP server for the main language. Research all 15 skills + assets + impl templates, find the consolidation points for one canonical LSP-first rule, wire it with one-line references (DRY: one home in assets/rules, pointers elsewhere).

## Progress

- Old skill snapshotted; polish applied: pushier description, 'External packages (node_modules)' subsection (verified live), fallback dedup.
- sdd wiring: 8 files (map + rules image + 4 fork replacements + validate-gap + validate-design + spec-requirements + 6 impl dispatch spots).
- Battery: validate PASS, twins 6/6/6 IDENTICAL, census 15, checkbox-writes 0.
- 6 eval agents running; ground truth precomputed.

## Validation

- Eval battery: 3 prompts x (polished vs snapshot), live LSP on packages/skill-builder. OUTCOMES: 100% vs 100% parity - old skill already correct on all three task shapes; assertions non-discriminating (recorded honestly). METHOD delta: the polished run explicitly used the new External-packages guidance (goToDefinition-on-import -> manifest fallback) and cited it; old run used the generic fallback blind.
- Grading fix: eval-2 assertion 3 false-positived on quoted tool output; regraded to scope-not-verdict semantics.
- sdd wiring battery: validate PASS, twins 6/6/6 IDENTICAL, census 15, checkbox-writes 0, lsp-code-analysis named in 8 plugin files.
- Viewer launched for human review.

## Notes

- Delayed hook-mechanics report (docs-verified) confirms the implemented design: PreToolUse fires for the Skill tool (skill field), typed /sdd:* covered by UserPromptExpansion (block-capable), deny via exit 2 or JSON permissionDecision (exit 1 does NOT block - our scripts use 2), Edit/Write field names as parsed, plugin hooks.json supports all events. Two flags closed in tech.md: UserPromptExpansion docs-confirmed (bare-vs-qualified command_name still unlogged, in-skill gate covers it); frontmatter context/background/model confirmed functional.
- Eval agents reported DONE with status contracts; all stopped after grading.

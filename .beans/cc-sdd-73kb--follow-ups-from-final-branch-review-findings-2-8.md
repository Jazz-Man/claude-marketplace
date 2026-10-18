---
# cc-sdd-73kb
title: Follow-ups from final branch review (findings 2-8)
status: completed
type: task
priority: normal
created_at: 2026-09-23T12:45:25Z
updated_at: 2026-09-24T18:38:52Z
parent: cc-sdd-uwj4
---

From the final whole-branch review (CLEAN-WITH-FOLLOW-UPS): 2. DELETE assets/templates/requirements-init.md (zero refs) or wire into spec-requirements edit-merge 3. DELETE assets/rules/tasks-parallel-analysis.md + drop spec-tasks:64 prohibition line (criteria condensed in tasks-generation.md) 4. DELETE assets/rules/steering-principles.md (unreferenced post-Task-13; name-collides with skills/steering/references/ copy carrying different content) 5. impl SKILL.md:87 — add blockedByIds to the Step 0 example children query 6. validate-impl:147 — add -i to the case-insensitive grep command 7. verify-completion ~22 — reword garbled 'and that validate-impl applies to use whenever' 8. validate-impl:115 — add CLAUDE_SKILL_DIR sibling fallback phrasing for standalone fork entry
Apply AFTER the user's E2E walkthrough returns (do not desync the scratch session).

9. (E2E finding 1, user decision) REMOVE allowed-tools frontmatter from the 13 sdd-native skills (all except skills/steering — verbatim parity with the user's global original rules that copy; to change steering, edit the global skill and re-port). Verified semantics: allowed-tools is a per-turn permission grant, not a restriction; superpowers ships none. Apply post-E2E together with items 2-8.

10. (E2E finding 5, user) REMOVE redundant steering re-reads: 7 instructions across 6 skills (spec-design:68, spec-requirements:60+146, discovery:63, validate-design:69, validate-gap:68, validate-impl:113) say 'Glob .claude/rules/*.md; read...' — project memory is session-start context for main sessions AND default-context subagents (no omitClaudeMd anywhere in our design; platform-default assumption, noted). Replace with one-liner: steering is already in context — apply, do not re-read. DO NOT TOUCH: skills/init (file operations on sdd.md), skills/steering (verbatim port), assets/rules references (on-demand plugin content). Saves tokens/time, removes hallucination surface.

## Summary of Changes

All 10 items landed: #2-8+10 in wave task A1 (cc-sdd-5bwa, committed); #9 (allowed-tools strip) also A1. This bean was the source manifest; execution tracked in A1.

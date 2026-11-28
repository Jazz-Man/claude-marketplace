---
# cc-sdd-rsis
title: Split grepai-workflow into grepai-init and grepai-workflow
status: completed
type: task
priority: normal
created_at: 2026-11-28T11:39:20Z
updated_at: 2026-11-28T11:52:58Z
---

Move the setup half of plugins/grepai/skills/grepai-workflow (grepai init, ignore layers, search boost, configuration map, chunking, config schema) into a new skill plugins/grepai/skills/grepai-init with its own references; grepai-workflow keeps the search doctrine, the LSP synergy matrix and the subagent dispatch contract. Parked earlier in cc-sdd-z31a. Invoked via skill-creator.

## Summary of Changes

- New skill `plugins/grepai/skills/grepai-init/`: `SKILL.md` (468 words) plus `references/{configuration,ignore,search-boost,chunking}.md` and `config.schema.json`, moved from `grepai-workflow/references/`. configuration.md, search-boost.md and the schema are byte-identical to the committed originals; ignore.md and chunking.md differ in one cross-reference line each.
- `grepai-workflow/SKILL.md`: setup section and setup triggers removed from the description (1008 -> 846 words), pointer paragraph to `grepai-init` added; keeps `references/{search,trace,rpg}.md`, the LSP synergy matrix and the subagent dispatch contract.
- Pointers between the two skills go by skill name, never by file path: ignore.md -> trace.md, chunking.md -> configuration.md (trace section), search.md -> search-boost.md and ignore.md, trace.md -> chunking.md.
- Step 1 of grepai-init names the non-interactive form `grepai init --provider ollama --model bge-m3 --backend gob --yes` and the three edits that bring the file to the solo baseline (owner's choice). Observed in scratch dirs: bare `grepai init` prompts on stdin and with EOF writes nomic-embed-text 768d, fixed chunking, hybrid off; the flagged form writes bge-m3 with dimensions 768 and prints the dimensions note itself; init is idempotent; it adds `.grepai/` to the project .gitignore or writes `.grepai/.gitignore`; it prints `grepai watch` as a next step.
- Plugin README, plugin.json description and marketplace.json description updated for two skills. `.claude/agents/code-explorer.md` unchanged.

## Notes

- Verified: `claude plugin validate .` passed (pre-existing README install-line advice only); both frontmatters carry name and description only, names match directories; every reference pointer resolves inside its own skill or is qualified with the other skill's name; JSON parses; no stale path to the moved files; no double-brace placeholders. PyYAML is absent, so skill-creator's quick_validate.py was not run.
- Deferred by the owner (2026-11-28): the full skill-creator eval cycle runs after the owner's practice-based edits to grepai-init (agents skip steps after config init). Trigger probes were not run.
- Open: whether `ollama pull bge-m3` (printed by init) is the agent's step or the owner's; the skill is silent.
- Cost of the split: two descriptions in the always-loaded skill listing (524 + 650 chars instead of 527).
- `/reload-plugins` or a new session is needed before `grepai:grepai-init` is invocable.

Resolved 2026-11-28 (cc-sdd-vc1w): `ollama pull` is never the agent's step. The skill says so and the sandbox denies the command.

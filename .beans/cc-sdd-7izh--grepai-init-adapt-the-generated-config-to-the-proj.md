---
# cc-sdd-7izh
title: 'grepai-init: adapt the generated config to the project'
status: completed
type: task
priority: normal
created_at: 2026-11-28T12:53:21Z
updated_at: 2026-11-28T12:55:45Z
---

Owner's practice edits (2026-11-28) after the split (cc-sdd-rsis): agents stop after grepai init and leave its generic config. The skill must make them adapt, per project: external_gitignore -> the owner's global ~/.gitignore; ignore -> agent and editor artifacts not already git-ignored; search.boost on and shaped for the project; hybrid and dedup on; trace.enabled_languages -> the project's languages; RPG on with its settings. Also remove the ollama-related commands from the skill. Full skill-creator eval cycle follows these edits (owner's decision).

## Summary of Changes

- `grepai-init/SKILL.md` rewritten around the owner's complaint (agents stop after init). The intro states that `grepai init` writes a generic config and that setup is finished only when a checklist holds. Sections: Initialize, Read the project, Adapt the config (8-row table: key, what init writes, what must hold), Report/hand over/verify. 468 -> 911 words.
- Checklist rows: `external_gitignore` -> `~/.gitignore`; `ignore` -> the defaults plus the project's agent and editor artifacts not already git-ignored; `search.boost` on and shaped for the project; `search.hybrid.enabled` true; `search.dedup.enabled` true; `trace.enabled_languages` -> the project's languages as whole families; `rpg.enabled` true with `feature_mode: local` unless the owner names a chat model; embedder and chunking -> the solo baseline.
- Ollama commands removed from the skill. Step 1 is now `grepai init --yes`, verified in a scratch dir: no prompts; writes nomic-embed-text 768d, fixed chunking, boost on with 20 rules, hybrid off, dedup on, 27 trace extensions, RPG off, 15 ignore defaults, no external_gitignore. The `ollama pull` sentence is gone; the model and dimensions moved into the config row.
- References: ignore.md gained "Agent and editor artifacts (at init)" (base set CLAUDE.md, AGENTS.md, .claude, .agents, .zed, .idea plus agent-tool or editor directories present at the root; skip every name `git check-ignore -q` reports as ignored); search-boost.md gained "Shaping the lists for a project (at init)" with the owner's config as the worked example; the solo baseline in configuration.md gained trace, rpg and external_gitignore lines plus the four edits that lead from init's output to the baseline. Plugin README bullet updated.
- The owner-curation axiom stays at its point of risk: in an already curated config, add what a row lacks and never re-add entries the owner removed.

## Notes

- For the owner: `grepai init` writes boost ON (20 shipped rules), dedup ON, hybrid OFF, RPG OFF.
- Dry run on this repository: the checklist's deterministic rules yield exactly the owner's hand-tuned values (ignore additions, external_gitignore, trace family, hybrid, dedup, RPG, embedder and chunking). The only owner-specific entry is `docs/superpowers` in ignore.
- Verified: `claude plugin validate .` passed; frontmatter and reference-pointer checks pass; no ollama mention left in SKILL.md (configuration.md still documents ollama as the embedder provider).
- Interpretation reported to the owner: "remove ollama commands" was read as the provider and model flags on the init command plus the `ollama pull` mention; the baseline model stays in the config row.
- Not yet tested with agents. The full skill-creator cycle is the owner's stated next step; three candidate evals were proposed: a fresh project, an already-initialized generic config, and an owner-curated config (no re-adding of removed entries).

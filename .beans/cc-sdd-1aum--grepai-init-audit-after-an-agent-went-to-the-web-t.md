---
# cc-sdd-1aum
title: 'grepai-init: audit after an agent went to the web to re-check the ignore system'
status: completed
type: task
priority: normal
created_at: 2026-11-28T17:10:19Z
updated_at: 2026-11-28T17:11:13Z
---

Owner report 2026-11-28: running grepai-init in another project, the agent went online to understand how grepai's ignore works, although the skill describes it. Audit the skill for anything that makes an agent doubt the text or look for an outside authority, and fix what is found. The other session's transcript was not read; which trigger fired there is unverified.


## Summary of Changes

- Audit of `plugins/grepai/skills/grepai-init` for anything that makes an agent doubt the text or consult an outside authority. Three triggers found and removed.
- Factual error: the skill said that without a git repository only the global gitignore can pre-exclude a name. The project's own `.gitignore` files stay a grepai layer with or without git. Corrected in SKILL.md (step 2) and ignore.md: without git, search the project's `.gitignore` files and `~/.gitignore`.
- Open question on the form of config `ignore` entries: the skill said "names or gitignore-style patterns" and recommended glob entries without saying where they go. ignore.md now states the semantics (no slash — any depth; leading slash — anchored to the project root; bare directory name — the whole subtree) and labels the ecosystem additions as entries for the config `ignore` list.
- Pointers to an outside authority removed from the skill: "This file follows the grepai documentation" (configuration.md), "The documentation's chunking strategy list is the authoritative one" and "the documentation's recommendation" (chunking.md), "the documentation points to qdrant" (SKILL.md). The provenance moved to a Maintenance paragraph in the plugin README. SKILL.md gained one sentence: the references are complete for the skill, do not re-check them in grepai's source, its documentation or the web, a doubt goes into the report.

## Notes

- The other session's transcript was not read, so which trigger fired there is unverified. In the third eval iteration three agents had to resolve the no-git sentence on their own: one cited the bundled docs to confirm that grepai honors `.gitignore` without git, two marked it [Inference].
- For the owner, in the documentation: two pages disagree on config `ignore` entries. configuration.md says "names or gitignore-style patterns applied from the project root"; watch-guide.md says "each entry is compared to the file or directory name (not a glob or path)". The skill follows configuration.md.
- That grepai reads `.gitignore` files without git follows from the documentation's wording (the layer is the file); it was not tested, which would need an index build.
- Gates: biome clean on the plugin, `claude plugin validate .` passed, reference pointers resolve.

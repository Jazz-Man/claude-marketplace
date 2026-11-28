---
# cc-sdd-vc1w
title: 'Deny ollama pull: sandbox-config rule and grepai-init wording'
status: completed
type: task
priority: normal
created_at: 2026-11-28T11:52:11Z
updated_at: 2026-11-28T11:55:04Z
---

Owner decision 2026-11-28: pulling an Ollama model is never the agent's step. Add the command to the denied Bash commands in packages/sandbox-config (permissions.deny) and state the rule in plugins/grepai/skills/grepai-init/SKILL.md (grepai init prints 'ollama pull bge-m3' as a next step). Follow-up to the open point in cc-sdd-rsis.

## Summary of Changes

- `packages/sandbox-config/src/lists/permission-deny.ts`: `disableCommands` gains `"ollama pull*"`, so the generated `permissions.deny` gains `Bash(ollama pull*)` (31 -> 32 rules; the other 31 unchanged and in the same order).
- `plugins/grepai/skills/grepai-init/SKILL.md`, step 4: `grepai init` prints `grepai watch` as a next step and `ollama pull` as a hint; both are the owner's, never pull a model.

## Notes

- Verified: the generator was evaluated in memory and compared with the live `~/.claude/settings.json` (identical before the change; afterwards only the new rule is added); `bun check --strict packages/sandbox-config` clean (13 files); `claude plugin validate .` passed.
- Pre-existing, untouched: biome reports `ghCommands` unused in permission-deny.ts; its only use is a commented line at HEAD.
- Not done, owner's step: `bun run sandbox` in `packages/sandbox-config` writes the new rules into `~/.claude/settings.json` and `claude-settings.json` beside the package (not git-ignored).
- Limits per docs/claude/permissions.md, "What a Bash rule doesn't match": the rule matches command text, so `/opt/homebrew/bin/ollama pull ...` and `sh -c 'ollama pull ...'` are not covered; only `pull` is denied (rm, push, cp are not).

Superseded 2026-11-28 by cc-sdd-tgo5: all seven model-changing ollama commands (create, cp, pull, push, rm, run, stop) are denied.

---
# cc-sdd-tgo5
title: Deny every model-changing ollama command
status: completed
type: task
priority: normal
created_at: 2026-11-28T11:54:27Z
updated_at: 2026-11-28T11:55:04Z
---

Owner request 2026-11-28: forbid all ollama commands that change or write models. Widens the single ollama pull rule from cc-sdd-vc1w in packages/sandbox-config/src/lists/permission-deny.ts (permissions.deny).

## Summary of Changes

- `packages/sandbox-config/src/lists/permission-deny.ts`: the single `"ollama pull*"` entry from cc-sdd-vc1w is replaced by `ollamaModelCommands` — `create`, `cp`, `pull`, `push`, `rm`, `run`, `stop`, each emitted as `ollama <cmd>*` — wired into `permissionDeny` as `Bash(ollama <cmd>*)`. Same shape as `gitWriteCommands`.
- `grepai-init` is unchanged; its step 4 already names `ollama pull` as the owner's step.

## Notes

- Why `run` is in the set: `ollama run MODEL` is not read-only (it loads a model). Unverified on this binary: it also downloads a model that is missing locally, which would bypass the `pull` rule.
- Left allowed: the read-only `list`, `ps`, `show`, `help`, and the state-changing commands that are not about models: `serve`, `signin`, `signout`, `launch`.
- Verified: the generator evaluated in memory gives 43 rules; the live settings still hold the old 31; `bun check --strict packages/sandbox-config` is clean; biome is clean on permission-deny.ts.
- The owner uncommented the `ghCommands` line in the same file by hand, so 5 `gh auth` rules are generated as well; not this task's change.
- Pre-existing biome findings elsewhere in the package, untouched: `deny-write.ts` carries an `<explanation>` placeholder in its suppression; `credential-files.ts` has an unused variable.
- Not done, owner's step: `bun run sandbox` in `packages/sandbox-config`.

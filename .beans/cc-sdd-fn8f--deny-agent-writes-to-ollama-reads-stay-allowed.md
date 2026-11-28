---
# cc-sdd-fn8f
title: Deny agent writes to ~/.ollama, reads stay allowed
status: completed
type: task
priority: normal
created_at: 2026-11-28T11:57:15Z
updated_at: 2026-11-28T11:57:45Z
---

Owner request 2026-11-28: agents must not write into ~/.ollama; reading stays allowed. Changes in packages/sandbox-config: sandbox.filesystem.denyWrite (sandboxed commands) and an Edit deny rule for the built-in file tools, which run outside the sandbox. Same ollama hardening as cc-sdd-vc1w and cc-sdd-tgo5.

## Summary of Changes

- `packages/sandbox-config/src/lists/deny-write.ts`: `managerStateDirs` gains `~/.ollama`, so `sandbox.filesystem.denyWrite` gains it (232 -> 233). Covers sandboxed commands.
- `packages/sandbox-config/src/lists/permission-deny.ts`: new live rule `Edit(~/.ollama/**)` in `permissions.deny` (43 -> 44). Covers the built-in file tools (Write, Edit, NotebookEdit), which run outside the sandbox (docs/claude/sandboxing.md, "What runs outside the sandbox"), plus the Bash file commands Claude Code recognizes and redirection targets; Claude Code also adds `Edit` deny paths to the sandbox denyWrite (docs/claude/settings-reference.md).

## Notes

- Reads untouched: `sandbox.filesystem.denyRead`, `sandbox.credentials.files` and the `Read` rules carry no ollama entry. `~/.ollama/id_ed25519` therefore stays readable by sandboxed commands, as the owner asked.
- Verified: the generator was evaluated in memory and compared key by key with the live settings; exactly the two additions above, every other list identical and in the same order. `bun check --strict packages/sandbox-config` clean; biome exit 0 on both files (one pre-existing warning: the `<explanation>` placeholder at deny-write.ts:1).
- Not covered by this change: writes the Ollama server makes itself on behalf of `ollama pull` and similar commands, because the server is not a subprocess of the sandboxed command. Those are the denied commands from cc-sdd-tgo5.
- Not done, owner's step: `bun run sandbox` in `packages/sandbox-config`. The rule's live effect was not tested.

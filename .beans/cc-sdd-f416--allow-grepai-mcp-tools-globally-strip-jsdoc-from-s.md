---
# cc-sdd-f416
title: Allow grepai MCP tools globally; strip JSDoc from sandbox-config
status: completed
type: task
priority: normal
created_at: 2026-11-23T17:30:44Z
updated_at: 2026-11-23T17:34:57Z
---

Two owner requests on packages/sandbox-config: (1) permissions.allow for every grepai MCP tool so agents are not prompted, plan mode included (lists/permission-allow.ts); also mirror the live network.allowedDomains in the generator (lists/allowed-domains.ts) so a regeneration does not drop it. (2) Remove the JSDoc blocks that explain the code from src/; keep all // comments (commented-out code included) and linter directives. Deletion is done by a Sonnet subagent file by file with Read + Edit, no scripts. buildConfig() output must stay byte-identical.

## Summary of Changes

- `lists/permission-allow.ts` (new) → `permissions.allow`: `mcp__plugin_grepai_grepai__*`, `mcp__grepai-api__*`, `mcp__grepai-source-mcp__*`. Rule form for a plugin server per `docs/claude/permissions.md:576-580`. Takes effect after the owner regenerates; generator output then differs from the live user settings only by this `allow`.
- `lists/allowed-domains.ts` (new) → `sandbox.network.allowedDomains: ["*.github.com", "registry.npmjs.org"]`, mirroring a value the owner had put into the live file by hand; without it the next regeneration would have dropped it.
- JSDoc removed from 9 files under `src/` by a Sonnet subagent with Read + Edit: 13 blocks, 62 lines. Verified against a backup of the originals taken before the change: removed lines are JSDoc lines plus the blank line that followed three headers, 0 lines added. The `biome-ignore-all` directive in `lists/deny-write.ts` stays as line 1. All 351 lines of commented-out code are intact.

## Validation

- `buildConfig()` JSON byte-identical to the reference captured before the edits.
- `bun check --strict --all`: 0 errors in 70 files.
- `biome check packages/sandbox-config/src`: no format findings; only the owner's own findings (`<explanation>` placeholder, `ghCommands is unused`).

## Notes

- A first attempt with a regex script misread `/**/` inside template literals as comments and damaged `utils.ts` and `deny-write.ts`; both were restored from the backup and the script approach was dropped at the owner's request.
- While the subagent worked and after its report, the owner kept editing the same files by hand: prose `//` comments disappeared from `allow-write.ts`, `permission-deny.ts`, `claude-md-excludes.ts` and `credential-env-vars.ts` (file mtimes after the report). Those edits are the owner's, not part of this bean.

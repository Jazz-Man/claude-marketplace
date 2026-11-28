---
# cc-sdd-rc93
title: 'lsp-proxy: start a server only when its config file is in the project root'
status: completed
type: task
priority: normal
created_at: 2026-11-28T11:12:40Z
updated_at: 2026-11-28T11:20:26Z
---

Problem: in projects that never initialized biome/jscpd/tsc, every configured server still starts and floods the agent with irrelevant diagnostics. Change: per-server `configFiles` in plugins/lsp-proxy/lsp-proxy.config.json; a server is spawned only when the project root (client initialize workspace folder / rootUri / rootPath) holds at least one of the listed files. Absent field = always start.

## Summary of Changes

- Per-server `configFiles: string[]` in `plugins/lsp-proxy/lsp-proxy.config.json`. A server is spawned only when the project root holds at least one of the listed files; a server without the field always starts.
- New `packages/lsp-proxy/src/activation.ts`: `activeServers(config, initParams, log)`. Root = first `workspaceFolders` entry, then `rootUri`, then `rootPath`, then cwd. Skipped servers are logged as `server <name>: not started, none of [...] in <root>`.
- `proxy.ts` `handleInitialize` starts only the active servers. Every other path is keyed on the live-server map, so nothing else changed.
- Validation: `configFiles` must be a non-empty array of non-empty strings.
- Config values: effect-tsgo `[tsconfig.json, jsconfig.json]`, biome `[biome.json, biome.jsonc]`, jscpd `[.jscpd.json]`, zls `[build.zig, build.zig.zon]`.
- README: feature bullet, Maintenance paragraph, `activation.ts` in the module list.
- Tests +18: field validation, `activeServers` unit tests (7), integration (3): gated server never spawns, starts with a marker, all-inactive session answers `null`. Harness: `boot(servers, root?)`.

## Notes

- The check runs once per session, on `initialize`; a config file created mid-session takes effect in the next session. Only the project root is checked, nothing below it.
- Verified: `bun test` 195/195 (177 before); mutation check with the gate bypassed fails the integration test; `bun check --strict --all` clean; biome clean apart from the pre-existing `framing.ts` `useWhile` warning; live boot of `src/main.ts` with the real config on a marker-less temp root gives 4x "not started", a valid initialize reply, exit 0.
- Not done, owner's call: `bun run build-bin`. `~/.local/bin/lsp-proxy` is a standalone binary built 2026-10-27, so the change reaches Claude Code sessions only after a rebuild.
- Side effect fixed: the `*.js` slices under `tmp/claude-builtin-*` broke `bun check --strict --all` (376 errors). Renamed to `*.js.txt`, content unchanged, 17 reference lines updated.

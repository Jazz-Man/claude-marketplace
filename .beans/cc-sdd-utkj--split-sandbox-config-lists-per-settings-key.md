---
# cc-sdd-utkj
title: Split sandbox-config lists per settings key
status: completed
type: task
priority: normal
created_at: 2026-11-23T09:28:46Z
updated_at: 2026-11-23T09:40:58Z
---

Reorganize packages/sandbox-config/src: one list file per settings key under lists/ (allowWrite, denyRead, denyWrite, credentials.envVars, credentials.files, permissions.deny, claudeMdExcludes), utilities (bothForms, unique, pathsToRules, dependencyMemoryFiles) in utils.ts, config.ts as assembly only. Lists are independent on purpose; all commented-out lines stay; buildConfig() output must stay byte-identical. .jscpd.json ignores lists/.

## Summary of Changes

Reorganized `packages/sandbox-config/src` per settings key, per the owner-approved plan:

- `lists/`: `allow-write.ts`, `deny-read.ts`, `deny-write.ts`, `credential-env-vars.ts`, `credential-files.ts`, `permission-deny.ts`, `claude-md-excludes.ts` — one list per key. Every live import in `lists/` is `../utils.ts`; no list reads another list. The two commented mirror lines in `permission-deny.ts` are the only exception, and only once uncommented.
- `utils.ts`: `bothForms`, `unique` (from `patterns.ts`), `pathsToRules` and the dependency-memory expansion (from `config.ts`), the latter now `dependencyMemoryFiles({ cacheRoots, dirs, folders, names, prefixes })`.
- `config.ts`: assembly only (list → key, plus the scalar flags). Its header carries the "lists never share entries" rule; the original "Order matters" comment stays above `buildConfig`.
- Removed: `catalog/` (6 files) and `patterns.ts`.

Commented-out code kept: of the 72 commented lines in HEAD, 70 are present in the new tree (script check, indentation-insensitive) and 2 were renamed — `...pathsToRules(readDenyPaths, "Read")` / `writeDenyPaths` now name `denyRead` / `denyWrite`, with commented import lines beside them. `deny-read.ts` owns a commented copy of `protectedFiles` (11 groups) and `memoryPaths`, plus the two commented spreads — the owner's choice.

`.jscpd.json`: the planned `ignore` entry for `packages/sandbox-config/src/lists/**` went in and the owner reverted it when taking jscpd out of scope; the file is back at HEAD. Duplication inside `lists/` is intentional and will keep showing up in jscpd.

## Validation

- `buildConfig()` JSON before vs after: byte-identical, 42702 bytes, sha256 `dbcf3976…`. Per-key counts 117 / 31 / 45 / 267 / 3 / 117 / 232 (`claudeMdExcludes` / `permissions.deny` / `envVars` / `credentialFiles` / `allowWrite` / `denyRead` / `denyWrite`).
- `bun check --strict --all`: 0 errors in 68 files.
- `biome check packages/sandbox-config`: exit 0. One warning on the owner's own line, `lists/deny-write.ts:6` — `biome-ignore-all lint/style/noExcessiveLinesPerFile: <explanation>` still carries the `<explanation>` placeholder. The schema-version notice (2.6.4 vs CLI 2.6.8) predates this work.

## Notes

- Owner edited during the work: added the `biome-ignore-all` line above (the file is 304 lines by biome's count, cap 300) and regenerated `claude-settings.json`. I did not touch that file; before the owner's run its three owned subtrees already equaled the builder output.
- `lists/credential-files.ts` (291 lines) and `lists/deny-read.ts` (296 lines) sit close to the 300-line cap.
- `bun.lock` still maps `@cc-sdd/sandbox-config` to `packages/cli-hook` (lines 34, 97) — owner's `bun install`.
- The comment over the allow list in `allow-write.ts` describes only the temp tree although the list also carries `~/.cache`; moved verbatim.

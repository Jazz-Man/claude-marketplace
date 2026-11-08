---
# cc-sdd-psok
title: Remove brew/sudo checks and bin build chain from cli-hook
status: completed
type: task
priority: normal
created_at: 2026-11-08T13:12:35Z
updated_at: 2026-11-08T13:27:41Z
parent: cc-sdd-okin
---

sudo* and brew* are blanket-denied at the Bash permission layer, so the cli-hook-side checks and fixtures are dead weight. Delete: sudo intent tracking (intents/policy/reasons/wrappers), brew entry in test-map + no-deps reason, related fixtures/tests/bench branches, build.ts + build-bin script + bin-builder devDep, cli-hook specs/plans in docs/superpowers.

## Summary of Changes

Removed sudo/brew handling (blanket-denied at the Bash permission layer, so the hook-side checks were dead):
- src: sudo intent tracking gone from intents.ts/policy.ts/reasons.ts (SUDO_REASON) /wrappers.ts (SHARED_WRAPPERS); brew block dropped from test-map.ts; REASON enumeration lost 'brew'.
- tests: sudo rows + blocks cut from fixtures/filesystem.ts and filesystem.test.ts; 4+2 brew rows cut from fixtures/no-deps.ts. Kept 4 path-based fixtures (sudoers//opt/homebrew paths) — they pin zone/PATH/var rules, not the commands.
- bench: sudo stripped from all mirrors (Unwrapped, NEUTRAL, mirrorCheck, unitDecisionOld/AllOld, unwrapScanOld, intentOfOld).
- bins: build.ts deleted; package.json lost build-bin script + @cc-sdd/bin-builder devDep (bun.lock sync = owner's bun install); ~/.local/bin/claude-code-cli-hook left for the owner to rm (sandbox).
- specs/plans deleted: 2026-10-15-filesystem-policy-v2 pair, 2026-10-24-cli-hook-memory-ask pair.

Verification: bun check --strict --all clean (90 files); bun test 545 pass / 8 fail — all 8 pre-existing mutable-commands.txt drift (npx/bunx/uvx/nix rows), unaffected by this change; claude plugin validate passed.

Follow-up (owner order): npx/bunx/uvx/nix + pnpx rows removed from tests/fixtures/no-deps.ts (all blanket-denied upstream via disableCommands). Full battery now 544 pass / 0 fail.

Follow-up 2 (owner order): npx/bunx/uvx/pnpx/nix entries also removed from src — test-map.ts (5 set() blocks incl. nix patterns), mutable-commands.txt (pnpx runner line), no-deps REASON enumeration. Battery: bun check clean, 544 pass / 0 fail. Remaining mentions by design: disableCommands deny rules in settings.ts.

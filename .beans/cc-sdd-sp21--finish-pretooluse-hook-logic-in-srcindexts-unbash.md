---
# cc-sdd-sp21
title: Finish PreToolUse hook logic in src/index.ts (unbash guard + bun tests)
status: completed
type: task
priority: normal
tags:
  - verdict-approved
created_at: 2026-09-29T11:00:21Z
updated_at: 2026-09-29T11:45:43Z
---

Complete findViolation/classify/deny in src/index.ts: universal AST walk over unbash types, classify throws plain Error (drop src/error.ts), remove in-file ALLOW/DENY fixtures and debug noise (keep src/debug.ts file, remove its import; entrypoint stays commented). Tests in root tests/ via bun-test skill: unit ALLOW/DENY fixtures with fixed projectDir, deny() shape, e2e stdin driver via Bun.spawn. Verify: bun test, tsc, biome.

## Brief

- [x] Rewrite words() as universal AST walk (Word = string text+value, yield value; recurse otherwise)
- [x] classify throws plain Error (4 checks unchanged); findViolation returns e.message
- [x] Fail-open: parse throw or ast.errors non-empty => null
- [x] Clean index.ts: drop ALLOW/DENY, DENY loop, console.logs, dead consts, error.ts/debug.ts imports; delete src/error.ts; entrypoint stays commented; export deny
- [x] tests/find-violation.test.ts: ALLOW => null, DENY => string (fixed /proj), deny() shape
- [x] e2e stdin driver via Bun.spawn (allow: empty stdout; deny: JSON)
- [x] Verify: bun test, tsc, biome

## Summary of Changes

- words() rewritten as universal AST walk (Word = string text+value -> yield value; explicit descent into Word.parts). Root cause found while testing: unbash WordImpl keeps .value/.parts on the PROTOTYPE (with toJSON), so Object.values never reached substitution parts - $(cmd)/<(cmd) nested scripts were invisible until the explicit obj.parts descent.
- classify() throws plain Error (4 checks unchanged); src/error.ts deleted (domain classes dropped); src/debug.ts kept per user choice, its import removed.
- No ast.errors fail-open branch: probe showed partial ASTs still carry real paths (cat /etc/passwd with unterminated quote still yields /etc/passwd) - walking them is the conservative direction. Fail-open stays only on parse throw.
- index.ts cleaned: ALLOW/DENY fixtures moved to tests, module-level DENY loop and console.logs removed, dead consts gone, deny exported, stdin entrypoint left commented (user decision this round).
- Tests: tests/find-violation.test.ts (it.each fixtures 23 ALLOW + 34 DENY, deny() exact-shape, 2 e2e stdin tests via Bun.spawn + tests/helpers/hook-driver.ts with CLAUDE_PROJECT_DIR=/proj).
- Verified: bun test 107 pass / 0 fail; tsc --noEmit exit 0; biome 1 warning (pre-existing src/debug.ts noExplicitAny - biome-ignore comment there has a misplaced colon and does not suppress).

## Validation

- VERDICT: REJECTED - 2026-09-29, opus deep review round 1, package: ~90-vector adversarial battery; 2 blocking (F1 ${HOME operator-form} regex bypass, F2 token-embedded paths @/abs, --opt=/abs, env VAR=/abs), 2 major (F3 prototype-hidden ArithmeticCommandImpl.expression/ArithmeticForImpl accessors, F4 TMPDIR/OLDPWD/cd -), minors F5-F7, nits F8-F10; prototype-hidden class F3 same as WordImpl fix

## Report

Fix wave after opus review round 1 (REJECTED): F1 OUTSIDE_VAR regex (HOME operator spellings), F2 @-strip + =RHS split in classify (accepted prose-mention trade-off), F3 prototype-accessor walk (arithmetic), F4 var set HOME|OLDPWD|TMPDIR|TMP (no cd -), F5 walk-loop try/catch, F6 honest invariant comment, F7 test gaps (fail-open pin, >> target, non-Bash e2e, trailing slash), F8 single slash strip, F9 entrypoint comment ?. alignment, TS: Violation class + instanceof. eval/-c heuristic declined — document static-analysis boundary.

## Summary of Changes (fix waves)

Two review-driven fix waves over the original implementation. Wave 1 (opus review round 1, REJECTED F1-F10): OUTSIDE_VAR regex for HOME operator spellings + OLDPWD/TMPDIR/TMP; @-strip and =RHS split for path-embedding argument tokens (accepted trade-off: echo foo=/etc and ?a=/etc deny); prototype-accessor walk (getOwnPropertyNames of the prototype) for ArithmeticCommand/ArithmeticFor after the WordImpl precedent; walk loop try/catch fail-open; honest word-like invariant comment; six test pins; single trailing-slash strip; entrypoint comment ?. alignment; Violation class + instanceof instead of the (e as Error) cast. eval/-c substring heuristic declined; static-analysis boundary documented in findViolation comment. Wave 2 (re-review round 2, one blocker): raw-token OUTSIDE_VAR test before the = split. Final: bun test 129 pass / 0 fail, tsc exit 0, biome exit 0 (pre-existing src/debug.ts warning).

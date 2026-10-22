---
# cc-sdd-a0t9
title: 'lsp-proxy: audit minors sweep (9 items)'
status: completed
type: task
priority: normal
created_at: 2026-10-22T15:43:35Z
updated_at: 2026-10-22T15:53:16Z
---

Follow-ups from the production-quality cycle's final gate (verdict: .superpowers/sdd/2026-10-22-lsp-proxy-production-quality/final-verdict.md). Nine open audit minors: T4 merge.ts:93 value cast (guard typeof value === string); T5 proxy-server.ts:196 registerReply result cast (isRecord both); T6 merge.ts:51,143 guarded casts (delete / type predicate); C2-partial proxy.ts:106 2000ms escalation + framing slice(0,60) x4 + downstream -1 sentinel (named constants); C4 logger.ts:27 join(path, '..') -> dirname; C8 coerceResponseId speculative string branch (drop or undefined-skip); D6 itemsOf/completionOf twin (single home in merge.ts); D8 downstream 'stream:' label x2 (one reporter); unparseable-body test pin (framing.test.ts pins only non-object messages).

## Summary of Changes

All 9 items done 2026-10-22 (in-session, coordinator — subagent dispatch broken at the time): T4 isMarkdownEntry type predicate (cast gone, value type now checked); T5 registerReply isRecord-guards result+capabilities (cast gone); T6 both merge.ts guarded casts deleted (itemsOf reuse + tagCodeAction isRecord); C2-partial PREVIEW_CHARS=60 (framing x4), TimeoutMs.killEscalation=2000 (constants home), EXIT_UNKNOWN=-1 (downstream); C4 dirname(logPath); C8 coerceResponseId -> number | undefined, handleServerResponse skips non-numeric ids (edge change: numeric-string ids no longer match pendings — real servers echo numeric ids); D6 itemsOf single-homed in merge.ts (proxy-requests imports); D8 streamError helper (two sites); unparseable-body test pin added (rawFrame hoisted to module scope — also fixed describe callback over the 50-line noExcessiveLinesPerFunction cap, the rule pq-final cycle confirmed enforced). Side effect of C8+T5 edits: prepareReply inlined (single caller), pullCapable reworked to hasProvider form — both to stay under the 300-line cap at 299.

## Validation

bun test package 160/160 (159 + 1 new pin) · repo 611/611 · rtk proxy biome check 0 errors + 1 known info (noAwaitInLoops, ruled deliberate) · bun check --strict 0/86 · build-bin success · zero comments (census) · proxy-server 299/300, proxy 300/300.

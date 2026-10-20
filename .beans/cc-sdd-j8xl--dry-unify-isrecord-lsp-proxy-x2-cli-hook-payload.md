---
# cc-sdd-j8xl
title: 'DRY: unify isRecord (lsp-proxy x2 + cli-hook payload)'
status: todo
type: task
created_at: 2026-10-20T20:07:25Z
updated_at: 2026-10-20T20:07:25Z
---

Owner finding 2026-10-20: isRecord duplicated — lsp-proxy config.ts + merge.ts (strict: rejects arrays) and cli-hook src/core/payload.ts (permissive: arrays pass, rejected later by field checks — outcome-identical with strict version, tests pin it). ONE canonical strict isRecord fits all call sites. Deferred decision (owner): home = (A) new @cc-sdd/guards package [recommended, bin-builder precedent] / (B) lsp-proxy-internal only + cli-hook stays / (C) runtime export in @cc-sdd/agent-types (charter shift). Until resolved: future lsp-proxy modules (capabilities, sync-extensions per plan) keep local copies; note in their briefs.

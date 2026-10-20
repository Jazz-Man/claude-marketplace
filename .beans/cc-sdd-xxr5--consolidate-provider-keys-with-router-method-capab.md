---
# cc-sdd-xxr5
title: Consolidate PROVIDER_KEYS with router METHOD_CAPABILITY (lsp-proxy)
status: todo
type: task
created_at: 2026-10-20T20:35:11Z
updated_at: 2026-10-20T20:35:11Z
---

Task 7 review ruling (parked): capabilities.ts PROVIDER_KEYS duplicates router.ts METHOD_CAPABILITY value-set (same 8 provider names; adding a capability end-to-end edits both). Consolidate when the modules are next touched — derive one from the other or share a single const home (coordinate with isRecord unification bean cc-sdd-j8xl if that lands as a shared module). Non-urgent; queue after the lsp-proxy POC epic.

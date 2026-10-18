---
# cc-sdd-0ivz
title: "Policy coverage hardening: wrapper descent + glued-flag matching (activation gate)"
status: todo
type: task
created_at: 2026-09-29T18:14:06Z
updated_at: 2026-09-29T18:14:06Z
---

MUST be closed BEFORE the hooks security module replaces the live bash hooks (it ships dormant for now). Two Important findings from the final whole-branch review (2026-09-29): (1) wrapper-command blind spot - units view names only the wrapper; sudo/env/nohup/xargs/command/exec/nice/watch/setsid/stdbuf/timeout-wrapped mutations pass git-readonly and no-deps (probe-verified; bash ERE caught them by substring). Fix: for name in a wrapper set, treat the first non-flag/non-assignment arg as a nested command head (recurse). (2) glued-flag forms - --delete=old, -Dold, --unset=x etc. bypass exact-token membership in the flag tables (real mutations; bash ERE prefix-matched them because its flag alternations were unanchored). Fix: long-form arg.startsWith(flag+'='), short-glued prefix check per flag table. Also fold in when convenient: barrel smoke-import test (plugin consumer lands), WRAPPER.split('%s').join(reason) display fix, undrained stderr pipe in e2e helper.

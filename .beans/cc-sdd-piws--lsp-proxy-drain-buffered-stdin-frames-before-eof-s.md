---
# cc-sdd-piws
title: 'lsp-proxy: drain buffered stdin frames before EOF shutdown'
status: todo
type: task
created_at: 2026-10-21T00:20:34Z
updated_at: 2026-10-21T00:20:34Z
---

Task 11 review finding (evidence extended by reviewer): a fully-framed initialize buffered on stdin loses its response when EOF arrives before downstream startup completes — cascade shutdown preempts it (1s hold: response lost; 4s hold: passes; window is downstream-startup-bound, not ~0ms). Real clients (Claude Code) hold stdin for the session and the 13 integration scenarios never exercise early EOF, so non-blocking — but a proxy should drain buffered frames before honoring EOF. Future fix in main.ts/proxy.ts run(); queue after the lsp-proxy POC epic. Related parked note: --help flag + legible parseArgs errors (owner's 'later').

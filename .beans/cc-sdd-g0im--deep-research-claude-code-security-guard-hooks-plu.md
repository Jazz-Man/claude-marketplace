---
# cc-sdd-g0im
title: "Deep research: Claude Code security guard (hooks + plugin) under bypass permissions"
status: completed
type: task
priority: normal
created_at: 2026-10-07T18:09:25Z
updated_at: 2026-10-07T18:48:55Z
---

Research for a future security-guard plugin: PreToolUse hooks blocking Read/Write/Edit on secret paths, Bash security scanning, defense-in-depth settings, prompt-injection/exfiltration attack vectors, existing OSS projects. Context: user runs Claude Code with bypass permissions on; guard must still bind. Workflow wf_75bb4629-492 (deep-research). Deliverable: cited report in docs/.

## Summary of Changes

Deep-research workflow wf_75bb4629-492 (102 agents, 24 claims survived 3-vote verification) produced docs/claude-code-security-guard-bypass-permissions.md: what binds under bypassPermissions (PreToolUse deny/exit-2 + settings deny rules), hook mechanics, path canonicalization (CVE-2026-25724 symlink precedent), Bash text-matching limits, Seatbelt sandbox scope/defaults, placement/precedence, failure modes (timeout fail-open), and a 9-point design blueprint for the future plugin. Gaps flagged: obfuscated-exfiltration signatures, real attack-vector incidents, OSS inventory, Keychain specifics, permission-list merge semantics — unverified.

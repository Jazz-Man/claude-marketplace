---
# cc-sdd-j2af
title: Extract the built-in Explore agent prompt from the Claude Code binary
status: completed
type: task
priority: normal
created_at: 2026-11-24T14:45:53Z
updated_at: 2026-11-24T15:04:04Z
---

Owner request: pull the complete system prompt of the built-in Explore subagent out of the installed Claude Code binary (Bun-compiled bundle with embedded JavaScript). Must be done by a Sonnet subagent. Read-only on the binary; decoded prompt and raw slice saved under tmp/ in this repository (git-ignored); lossless round-trip check between raw and decoded text.

## Summary of Changes

Extracted the built-in Explore subagent system prompt from the Claude Code 2.1.325 binary (read-only). Outputs in `tmp/claude-builtin-explore/` (git-ignored): `explore-prompt.md` (deliverable), `raw-slice.txt` (raw template literal, 2080 bytes, offsets 288928702-288930781), `context.js` (40 KB window around the definition), `decoded.json`, `extract.py`, `roundtrip.py`. Round-trip re-encode is byte-identical (sha256 bba5ade5...aa00cd). Findings: prompt is the template literal returned by `function dYo()`; no second variant (second occurrence at ~140.4M is Bun bytecode constant pool, verified identical); the harness description string is the separate `whenToUseLean` field, not part of the system prompt; thoroughness level is not in the system prompt (caller-side only). Note: the bean said "must be done by a Sonnet subagent" — the teammate that ran this reports glm-5.3-flash in its env, not Sonnet.

## Verification by the lead

- `raw-slice.txt` compared with the binary itself: bytes 288928702..288930781 of `/opt/homebrew/Caskroom/claude-code/2.1.325/claude`, 2080 bytes, identical (sha256 `bba5ade5ff1a37ca…`).
- `roundtrip.py` re-run by the lead: `byte_identical: True`, `RESULT: PASS`, decoded 2078 characters.
- The extracting subagent was spawned with `model: sonnet` on the Agent call; its transcript records glm-5.3-flash on all 69 responses, which is what the `sonnet` alias resolves to on this machine. It used `strings -a -t d` on byte windows (after the owner's hint), 18 Bash calls in total.
- `tmp/claude-builtin-explore/.claude/.cc-writes` is harness bookkeeping created by the Write tool, not an extraction output.

## Rendered on this machine

The owner asked for the placeholders replaced with the real tools of the machine. Established from two independent sources that agree:

- The built-in `Explore` agent returned its own system prompt from its transcript (no tools used). On macOS both switches of the template are in the Bash position: `find` and `grep` via Bash, `Read`, `Bash`, read-only list `ls, git status, git log, git diff, find, grep, cat, head, tail`, forbidden list `mkdir, touch, rm, cp, mv, git add, git commit, npm install, pip install`. The agent's tool list held no `Glob` or `Grep`.
- Compared with the template: all 8 literal segments verbatim and in order, 7 slots resolved as above.

The system-role content has three parts: the harness persona line, the `Explore` prompt, and a teammate-communication section the harness adds in agent-teams sessions. Written to `tmp/claude-builtin-explore/explore-prompt.rendered.txt` (2476 bytes, identical to the transcript pieces) and into `explore-prompt.md`, whose prompt block is identical to that file; the template with placeholders stays in `decoded.json` and `raw-slice.txt`.

---
# cc-sdd-jbnq
title: "no-inline-scripts misses heredoc-fed interpreters (unbash 5.1.0: << delimiter rides unit args)"
status: completed
type: bug
priority: normal
created_at: 2026-10-16T11:15:14Z
updated_at: 2026-10-16T11:34:59Z
parent: cc-sdd-20zn
---

Probe 2026-10-16 (tmp/unbash5-probes/round2.ts): bash <<EOF + script body -> ALLOW across all four policies. unbash 5.1.0 emits no Redirect record for <<; the delimiter rides unit args (bash["EOF"]), defeating readsStdinScript's empty-args stdin-fed deny; the body reaches neither units nor words, so no policy sees it. The delimiter arg is indistinguishable from a file argument on unit args alone — fix likely needs the walk to surface heredocs (unbash has a HereDoc node type; owner's src/test.ts tsc error names it) or no-inline-scripts to special-case the shape. [Inference] 4.0.11 likely kept the delimiter out of args (its redirect targets were excluded from suffix), so bash <<EOF was empty-args and denied — a 5.1.0-adaptation regression; parity unverified (no-deps rule blocks installing 4.0.11).

## Summary of Changes

Closed 2026-10-16 (day-2 final round). Probe (tmp/unbash5-probes/heredoc-shape.ts): the HereDoc node DOES ride Command.suffix and the redirects accessor in 5.1.0 — collectRedirects dropped it because HereDoc has no `target` (delimiter rides `.delimiter`, wordLike {text,value,quoted}; operator "<<"|"<<-"; value is the unquoted delimiter and also rides unit args). Fix: collectRedirects emits `{operator, target: delimiter.value}` for every heredoc head (src/core/ast.ts, quirks comment updated); no-inline-scripts denies an interpreter unit heredoc-fed via target===arg match, same REASON (src/policies/no-inline-scripts.ts). Fixtures: bash/python3 heredoc DENY, cat heredoc ALLOW. RED 71/2 → GREEN 73/0. Full report: .superpowers/sdd/2026-10-15-filesystem-policy-v2/day2-final-report.md

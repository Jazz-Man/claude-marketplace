---
# cc-sdd-rns6
title: codeAction tag/origin round-trip test coverage (lsp-proxy)
status: todo
type: task
created_at: 2026-10-20T19:54:54Z
updated_at: 2026-10-20T19:54:54Z
---

Task 6 review finding: merge.ts codeAction path (tagCodeAction/originOfCodeAction/mergeTaggedArrays) has zero test coverage — neither Task 6's 11 brief tests nor Task 10's 13 planned scenarios exercise textDocument/codeAction or codeAction/resolve. Add unit tests (tag/round-trip/origin-fallback) or a Task 10-style integration scenario. Non-urgent (round-trip verified correct by reading, shared SERVER_TAG constant); queue after the lsp-proxy POC epic.

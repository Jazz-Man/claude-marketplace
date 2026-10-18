---
# cc-sdd-mbhk
title: "sdd hooks: standards audit (plugin-dev) + UserPromptExpansion matcher fix"
status: completed
type: task
priority: normal
created_at: 2026-10-05T20:23:59Z
updated_at: 2026-10-05T20:28:47Z
---

Audit plugins/sdd/hooks against Claude Code hook standards via plugin-dev validators; fix the matcher-semantics bug (letters-only matcher = EXACT match, so 'sdd' never matches 'sdd:impl'); add description + timeouts; verify live.

## Findings (plugin-dev validators + docs)

- validate-hook-schema.sh: розуміє лише settings-формат (без плагін-обгортки) - його 'Unknown event type: hooks' і jq-помилка це обмеження інструмента, не наш формат (wrapper підтверджений доками і живими тестами).
- hook-linter: 3 попередження - всі свідомі компроміси (POSIX sh без pipefail; sed замість jq - jq не в тулчейні плагіна; exit-2 deny замість JSON - обидві форми документовані).
- СПРАВЖНІЙ БАГ: UserPromptExpansion matcher 'sdd' = exact-match (letters-only семантика) - ніколи не збігався з 'sdd:impl' тощо; гейт прямого набору мовчав. Fix: '^sdd:' (regex-режим).

## Changes

- hooks.json: matcher '^sdd:', top-level description, timeouts (15s гейти з beans-запитами, 10s write-guard).
- README: нова секція 'Invocation gates' (3 хуки).
- tech.md: семантика матчерів exact-vs-regex задокументована; 'unlogged' застереження зняте.

## Validation

- claude plugin validate PASS; shellcheck+sh -n OK; battery: twins 6/6/6, census 15, checkbox-writes 0, helper-tests 25/25.
- ЖИВИЙ ТЕСТ (вирішальний): порожній скретч-проєкт, claude -p '/sdd:spec-design' -> 'UserPromptExpansion operation blocked by hook' з діагнозом sdd-phase + командою-ліками. До фіксу той самий тест не блокувався -> корінь підтверджено. Обидва шляхи виклику тепер механічно гейтовані.

## Summary of Changes

Standards audit via plugin-dev: one real bug fixed (matcher exact-vs-regex semantics - the direct-typing gate never fired), standards gaps closed (description, timeouts, README hooks section), linter warnings adjudicated as deliberate POSIX/toolchain choices and documented.

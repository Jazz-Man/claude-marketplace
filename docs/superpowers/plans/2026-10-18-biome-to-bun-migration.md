# Biome → Bun lint/fmt Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the repo's lint/format truth from Biome (`biome.json`) to Bun's native linter and formatter, both configured in the root `bunfig.toml`, with a local ESLint plugin enforcing a zero-comment policy and exports-last ordering.

**Architecture:** `[fmt]` + `[lint]` sections appended to `bunfig.toml` (categories correctness/suspicious/pedantic/style all `"error"` per the severity doctrine); one dependency-free local plugin `lint/plugin.js` (`local/no-comments`, `local/exports-last`); `biome.json` frozen byte-for-byte as the temporary `plugins/biome-lsp` IDE bridge; five commit-bounded waves — probe, formatter switch + mechanical reformat, lint config + plugin, comment sweep, docs/wiring.

**Tech Stack:** Bun 1.4.4 (`bun lint`, `bun fmt`, `bun test`), TOML config, ESLint plugin API (native in Bun, no `eslint` package).

**Spec:** `docs/superpowers/specs/2026-10-18-biome-to-bun-migration-design.md` — decisions D1–D7, parity table §4.1, plugin contract §5, sequence §6, verification §9.

## Global Constraints

- `biome.json` is byte-for-byte untouchable by agents (spec D1). `git diff -- biome.json` must stay empty through every task.
- `.zed/` is the owner's editor configuration — never modified (spec D6).
- Severity doctrine (spec D7): every configured rule is `"error"` or `"off"`. Agent-written config never contains `"warn"`/`"info"`; the fix path for noise is an owner-approved `"off"`, never a downgrade.
- Zero new dependencies (spec D5). No `bun add`, no npm ESLint plugins; the local plugin file is the only extension point. The dependency set is FIXED: the owner pre-installed `@types/eslint` (9.6.1, root devDependencies) for plugin typing — no further installs of any kind.
- The agent never writes to git. Every task ends at a stop point — the owner reviews, tests, and commits (suggested message given per task).
- Markdown is excluded from `bun fmt` (`**/*.md`) — skill texts, assets, and docs stay byte-stable (twin checks + invariant greps pin exact bytes).
- `packages/cli-hook/tests/fixtures/**` stays lint/format-ignored (mirrors the old Biome override).
- Test data is written as literal arrays — no `.push()` accumulation (owner ruling).
- Comments are forbidden in every file any task touches; the plugin's own sources are linted by the repo config (self-hosting must stay green).
- Rule messages carry no bypass instructions (deny-reason doctrine).

## Review Focus

The five failure modes below are the spec's §12, each pinned to the task whose tests exercise it:

1. **Formatter churn reaching markdown despite the exclusion** — twin checks and invariant greps break on byte drift. Pinned: Task 2 step 4 runs the full battery after `bun fmt` and asserts zero markdown files in `git status`.
2. **`id-length` exception creep** — short-name exceptions silently entering config. Pinned: Task 1 produces the exception list in the probe report; nothing enters `[lint.rules]` before the owner approves it at the stop point.
3. **pedantic+style noise burying signal** — triage deferred or done as silent omissions. Pinned: Task 1's probe report carries a per-rule table (count, sample, decision) covering every diagnostic; Task 2 lands only decisions the owner approved.
4. **Plugin self-hosting traps** — the plugin or its tests failing their own rules. Pinned: Task 3 step 6 runs `bun lint` with both local rules on and asserts the plugin and test files report nothing.
5. **`bun lint` coverage surprises** — files outside expectations (root scripts, stray dirs) getting linted or missed. Pinned: Task 1 step 5 diffs the linted-file inventory against the repo tree.

---

### Task 1: Probe pass — land candidate config, freeze decisions

**Files:**
- Modify: `bunfig.toml` (append `[fmt]`, `[lint]`, `[lint.categories]`, `[lint.rules]`)
- Create: `<plan-workspace>/probe-report.md` (the SDD plan workspace directory)

**Interfaces:**
- Consumes: spec §4 target shape, §4.1 parity table.
- Produces: the candidate bunfig sections (consumed by Tasks 2–4); the probe report with per-rule triage, `id-length` exceptions, off-list — the owner approves at the stop point.

- [ ] **Step 1: Resolve the probe rows**

Run from the repo root:

```bash
bun lint --rules | grep -E "barrel|re-export|reexport|top-level-regex|toplevel|no-namespace|no-nodejs-modules|no-process-env|jsx-sort-props|no-undef"
```

For each §4.1 "probe" row, record the resolved rule name or `ABSENT` (→ accepted loss, listed in the report):
`noBarrelFile`, `noReExportAll`, `useTopLevelRegex`, `noNamespaceImport` (off-parity name), `noProcessEnv` (`unicorn/no-process-env`), `useSortedAttributes` (`react/jsx-sort-props`), plus whether `eslint/no-undef` produces noise on `Bun` globals in this repo.

- [ ] **Step 2: Append the candidate config to `bunfig.toml`**

```toml
[fmt]
sortImports = true
ignorePatterns = ["**/*.md", "packages/cli-hook/tests/fixtures/**"]

[lint]
plugins = ["./lint/plugin.ts"]
ignorePatterns = ["packages/cli-hook/tests/fixtures/**"]

[lint.categories]
correctness = "error"
suspicious = "error"
pedantic = "error"
style = "error"

[lint.rules]
"eslint/no-console" = "off"
"eslint/no-template-curly-in-string" = "off"
"eslint/no-magic-numbers" = "off"
"eslint/no-ternary" = "error"
"eslint/curly" = ["error", "all"]
"eslint/sort-keys" = "error"
"eslint/no-unused-vars" = "error"
"eslint/max-lines-per-function" = ["error", { max = 50 }]
"eslint/max-lines" = ["error", { max = 500 }]
"eslint/id-length" = ["error", { min = 3, exceptions = [] }]
"unicorn/no-process-env" = "off"
"import/no-nodejs-modules" = "off"
"local/no-comments" = ["error", { allow = [] }]
"local/exports-last" = "error"
```

Notes: the `plugins` line references a file created in Task 3 — until then `bun lint` exits with a load error; that is expected at this stage and the inventory in Step 3 runs with the plugin line commented out (`# plugins = ["./lint/plugin.js"]`), then restored. Names from Step 1 replace or confirm the off-parity rows; absent probe rows are omitted. `id-length.exceptions` starts empty and is filled ONLY from the owner-approved list. Do NOT run `bun fmt` (the reformat is Task 2; `bun fmt --check` is red at this stop point by design).

- [ ] **Step 3: Full noise inventory**

With the plugin line commented out, run:

```bash
bun lint 2>&1 | tail -3
bun lint 2>&1 | grep -c "error:"
bun lint --max-warnings 0 2>&1 | grep -c "warn"
```

Group every diagnostic by rule. For each rule class record in `probe-report.md`: rule name, count, one representative sample, proposed decision (`fix` — code fix in Task 3; `off` — recommend disabling, owner's call; `exception` — id-length short name to allow). Flag EVERY diagnostic that is not `error` severity (D7 audit — any warn/info default must be raised or the rule turned off).

- [ ] **Step 4: Coverage inventory**

```bash
bun lint 2>&1 | grep -oE "at [^:]+" | sort -u
```

Diff that file list against the repo's `.ts/.tsx/.js/.jsx` files outside `node_modules`, gitignored paths, and fixtures. Record any surprise (files linted that should not be, or missed).

- [ ] **Step 5: Write the probe report and STOP**

`probe-report.md` sections: resolved probe rows · noise triage table · D7 audit findings · id-length exception list (every flagged short name, each with the keeping/renaming recommendation) · coverage surprises · proposed final `[lint.rules]` diff. Restore the `plugins` line.

**Stop point — owner reviews the report, rules on every `off`/exception, then commits.**
Suggested: `chore(lint): bun lint/fmt config from parity probe`

---

### Task 2: Formatter switch + mechanical reformat

**Files:**
- Modify: every non-markdown file `bun fmt` rewrites (expected: `.ts`, `.json` under `packages/`, root configs)
- Modify (only if the probe report approved value changes): `bunfig.toml` `[lint.rules]` entries for `max-lines*` and `id-length.exceptions`

**Interfaces:**
- Consumes: `[fmt]` from Task 1, owner-approved decisions from the probe report.
- Produces: a working tree where `bun fmt --check` is clean.

- [ ] **Step 1: Apply owner-approved config deltas**

Edit `[lint.rules]` per the probe-report rulings (offs, `id-length.exceptions`, `max-lines*` values). Severity doctrine holds: only `"error"`/`"off"`.

- [ ] **Step 2: Reformat**

```bash
bun fmt
```

- [ ] **Step 3: Verify the formatter gate and the suite**

```bash
bun fmt --check
bun test
```

Expected: check clean (exit 0); test suite green (same count as before the task).

- [ ] **Step 4: Prove markdown byte-stability**

```bash
git status --porcelain | grep -E "\.(md|mdx)$"
```

Expected: empty. Then run the verification battery from `CLAUDE.md` §Verification: `claude plugin validate .`, the invariant greps, and the Revision-9 twin checks (patterns and method pinned in the two design documents §10/§4-erratum that CLAUDE.md points to). Expected: all pass, identical to pre-migration.

**Stop point — owner reviews the reformat diff and commits.**
Suggested: `Switch formatter to bun fmt; mechanical reformat (md excluded)`

---

### Task 3: Local plugin + lint noise fixes

**Files:**
- Create: `lint/plugin.ts`
- Create: `lint/plugin.test.ts`
- Modify: source files carrying `fix`-class findings from the probe report (packages/*/src, packages/*/tests, root scripts)

**Interfaces:**
- Consumes: `[lint].plugins` pointing at `./lint/plugin.ts` (Task 1), the `fix`-class findings list (probe report).
- Produces: `local/no-comments` (options: additive `allow: string[]`; built-in allowlist `eslint-disable`/`eslint-enable`/`prettier-ignore`/`@ts-`/`biome-ignore`; anti-circumvention guard for its own rule names) and `local/exports-last` (inline exports on declarations only, exports last in file, no standalone export blocks).

- [ ] **Step 1: Create `lint/plugin.ts` exactly as:**

```ts
import type { Rule } from "eslint";

interface NoCommentsOptions {
  allow?: string[];
}

interface StatementLike {
  type: string;
  declaration?: unknown;
}

const SYSTEM_PREFIXES: readonly string[] = [
  "eslint-disable",
  "eslint-enable",
  "prettier-ignore",
  "@ts-",
  "biome-ignore",
];

const GUARDED_RULE_NAMES: readonly string[] = ["no-comments", "exports-last"];

function trimmedText(comment: { value: string }): string {
  return comment.value.replace(/^\*+/, "").trim();
}

function startsWithAny(text: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => text.startsWith(prefix));
}

function isExportStatement(statement: StatementLike): boolean {
  return (
    statement.type === "ExportNamedDeclaration" ||
    statement.type === "ExportDefaultDeclaration" ||
    statement.type === "ExportAllDeclaration"
  );
}

const noComments: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: { description: "Comments are not allowed in this repository" },
    schema: [
      {
        type: "object",
        properties: {
          allow: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: { forbidden: "Comments are not allowed." },
  },
  create(context) {
    const provided: NoCommentsOptions | undefined = context.options[0];
    const allowed: readonly string[] = [
      ...SYSTEM_PREFIXES,
      ...(provided?.allow ?? []),
    ];
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const text = trimmedText(comment);
          const allowedPrefix = startsWithAny(text, allowed);
          const disablesOwnRule = GUARDED_RULE_NAMES.some((name) =>
            text.includes(name),
          );
          if (!allowedPrefix || disablesOwnRule) {
            context.report({ loc: comment.loc, messageId: "forbidden" });
          }
        }
      },
    };
  },
};

const exportsLast: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: { description: "Exported declarations must come last in the file" },
    schema: [],
    messages: {
      notLast: "Exports must be the last declarations in the file.",
      notInline: "Standalone export statements are not allowed.",
    },
  },
  create(context) {
    return {
      Program(program) {
        const body = program.body;
        let lastNonExportIndex = -1;
        for (let index = 0; index < body.length; index += 1) {
          if (!isExportStatement(body[index])) {
            lastNonExportIndex = index;
          }
        }
        for (let index = 0; index < body.length; index += 1) {
          const statement = body[index];
          if (statement.type === "ExportAllDeclaration") {
            context.report({ node: statement, messageId: "notInline" });
            continue;
          }
          if (
            statement.type === "ExportNamedDeclaration" &&
            statement.declaration === null
          ) {
            context.report({ node: statement, messageId: "notInline" });
            continue;
          }
          if (isExportStatement(statement) && index < lastNonExportIndex) {
            context.report({ node: statement, messageId: "notLast" });
          }
        }
      },
    };
  },
};

export default {
  meta: { name: "local" },
  rules: { "no-comments": noComments, "exports-last": exportsLast },
};
```

Typed via the owner-installed `@types/eslint` (a bun-lint plugin IS an ESLint plugin). The file contains zero comments by construction (self-hosting) and `export default` inline at the bottom (its own `exports-last` shape). Contingency: if the TS file fails to load through `[lint].plugins`, fall back to an identical `lint/plugin.js` with the types dropped — never to comments.

- [ ] **Step 2: Create `lint/plugin.test.ts` exactly as:**

```ts
import { expect, test } from "bun:test";
import type { Rule } from "eslint";
import plugin from "./plugin";

const noComments: Rule.RuleModule = plugin.rules["no-comments"];
const exportsLast: Rule.RuleModule = plugin.rules["exports-last"];

const loc = { line: 1, column: 1 };

function runNoComments(
  comments: { type: string; value: string; loc: object }[],
  options: unknown[] = [],
): number {
  let reported = 0;
  const context = {
    options,
    report: () => {
      reported += 1;
    },
    sourceCode: { getAllComments: () => comments },
  } as unknown as Rule.RuleContext;
  noComments.create(context).Program({ type: "Program", body: [] } as never);
  return reported;
}

const SYSTEM_ALLOWED = [
  " eslint-disable-next-line eqeqeq",
  " eslint-enable",
  " prettier-ignore",
  " @ts-expect-error stale types until unbash 7",
  " biome-ignore lint/style/noMagicNumbers: legacy suppression",
];

const ALWAYS_FORBIDDEN = [
  " owner decision: allow this shape",
  " TODO: refactor",
  " adds two numbers and returns the sum",
  "* walked invariants for the AST walk",
  " 2026-10-15 ruling",
];

test("system prefixes pass", () => {
  for (const value of SYSTEM_ALLOWED) {
    expect(runNoComments([{ type: "Line", value, loc }])).toBe(0);
  }
});

test("everything else is forbidden across comment forms", () => {
  const forms = [
    ...ALWAYS_FORBIDDEN.map((value) => ({ type: "Line", value, loc })),
    ...ALWAYS_FORBIDDEN.map((value) => ({ type: "Block", value, loc })),
    ...ALWAYS_FORBIDDEN.map((value) => ({ type: "Block", value: `*${value}`, loc })),
  ];
  expect(forms.every((comment) => runNoComments([comment]) === 1)).toBe(true);
});

test("allow option admits extra prefixes only", () => {
  const options = [{ allow: ["NOTE:"] }];
  expect(
    runNoComments([{ type: "Line", value: " NOTE: keep until v2", loc }], options),
  ).toBe(0);
  expect(
    runNoComments([{ type: "Line", value: " plain note", loc }], options),
  ).toBe(1);
});

test("self-disable guard fires and options cannot weaken it", () => {
  const guarded = [
    " eslint-disable-next-line local/no-comments",
    " biome-ignore local/exports-last",
  ];
  for (const value of guarded) {
    expect(runNoComments([{ type: "Line", value, loc }])).toBe(1);
    expect(runNoComments([{ type: "Line", value, loc }], [{ allow: [value.trim()] }])).toBe(1);
  }
});

function runExportsLast(body: object[]): string[] {
  const messages: string[] = [];
  const context = {
    options: [] as unknown[],
    report: (descriptor: { messageId: string }) => {
      messages.push(descriptor.messageId);
    },
  } as unknown as Rule.RuleContext;
  exportsLast.create(context).Program({ type: "Program", body } as never);
  return messages;
}

const declaration = { type: "FunctionDeclaration" };
const inlineExport = { type: "ExportNamedDeclaration", declaration };
const specifiersOnly = { type: "ExportNamedDeclaration", declaration: null };
const exportAll = { type: "ExportAllDeclaration" };
const defaultExport = { type: "ExportDefaultDeclaration", declaration };

test("exports-last accepts inline exports at the bottom", () => {
  expect(runExportsLast([declaration, declaration, inlineExport])).toEqual([]);
  expect(runExportsLast([declaration, defaultExport])).toEqual([]);
});

test("exports-last rejects export before a non-export statement", () => {
  expect(runExportsLast([inlineExport, declaration])).toEqual(["notLast"]);
});

test("exports-last rejects standalone export forms anywhere", () => {
  expect(runExportsLast([declaration, specifiersOnly])).toEqual(["notInline"]);
  expect(runExportsLast([declaration, exportAll])).toEqual(["notInline"]);
});
```

- [ ] **Step 3: Run the plugin tests**

```bash
bun test lint/plugin.test.ts
```

Expected: all pass.

- [ ] **Step 4: Fix the `fix`-class findings**

Work the probe report's `fix` list: every code change traces to a finding; no new comments; no severity downgrades; no new offs beyond the owner-approved set.

- [ ] **Step 5: Lint state check**

```bash
bun lint --max-warnings 0 2>&1 | grep -v "no-comments" | grep -cE "error:|warn"
bun lint 2>&1 | grep -c "Comments are not allowed"
```

Expected: first command `0` — everything except comment findings is green; second command returns the comment count (consumed by Task 4). `bun test` green.

- [ ] **Step 6: Self-hosting check**

```bash
bun lint lint/plugin.ts lint/plugin.test.ts
```

Expected: zero problems in both files (no comments, id-length clean, exports-last shape clean). If `id-length` flags test-local names (e.g. `loc`), rename to longer names in the test file — never add an exception for the plugin's own files.

**Stop point — owner reviews and commits.**
Suggested: `Add local lint plugin (no-comments, exports-last); fix lint findings`

---

### Task 4: Comment sweep

**Files:**
- Modify: every file under `packages/*/src`, `packages/*/tests`, and root-level scripts that carries a `local/no-comments` finding (fixtures excluded via ignorePatterns)

**Interfaces:**
- Consumes: live `local/no-comments` findings from Task 3's config.
- Produces: a comment-free source tree (system-prefix comments are the only survivors and only where already load-bearing).

- [ ] **Step 1: Enumerate**

```bash
bun lint 2>&1 | grep "Comments are not allowed"
```

Record the full list (file:line) — the sweep's definition of done.

- [ ] **Step 2: Delete**

Remove every listed comment. The fix is deletion only: no `eslint-disable`, no rewriting into a surviving form, no moving text into a comment that happens to match the allowlist. Where a deleted comment guarded real knowledge, encode it as code (a name, a type, a test) or drop it — the spec's D3 already accepted this.

- [ ] **Step 3: Verify**

```bash
bun lint --max-warnings 0
bun test
git diff -- biome.json
```

Expected: lint fully green including `no-comments`; tests green; biome diff empty.

**Stop point — owner reviews the sweep diff and commits.**
Suggested: `Sweep: delete all comments from src and tests`

---

### Task 5: Docs, wiring, final battery

**Files:**
- Modify: `.claude/rules/code-style.md`, `.claude/rules/tech.md`, `CLAUDE.md`, `plugins/biome-lsp/README.md`
- Create: follow-up bean (retire the biome-lsp bridge when a Bun LSP exists)

**Interfaces:**
- Consumes: the shipped state of Tasks 1–4.
- Produces: docs matching shipped truth; the tracking bean; final verification evidence.

- [ ] **Step 1: `.claude/rules/code-style.md`**

Rewrite the comments section: comments are forbidden and mechanically enforced by `local/no-comments` (`bunfig.toml [lint]`, options `allow` for owner-added prefixes; `biome-ignore` permanently allowed); delete the 2026-09-29 Biome background paragraph. Point the exports-last section at `local/exports-last` instead of Biome's `useExportsLast`; keep the no-trailing-export-blocks rule text.

- [ ] **Step 2: `.claude/rules/tech.md`**

Replace every `rtk biome check` / Biome reference in the verification flow with: `bun lint --max-warnings 0` + `bun fmt --check` (both from the repo root; fixtures and `**/*.md` ignored, rationale: twin-check byte stability). Note the severity doctrine (error-or-off only) and that `biome.json` is the frozen LSP bridge config.

- [ ] **Step 3: `CLAUDE.md` §Layout and `plugins/biome-lsp/README.md`**

CLAUDE.md: `plugins/biome-lsp/` described as a temporary IDE diagnostics bridge over the frozen `biome.json`; lint/format truth is `bunfig.toml`. README: one paragraph to the same effect — read-only bridge, formatting truth is `bun fmt`, bridge retirement tracked by the follow-up bean.

- [ ] **Step 4: Follow-up bean**

```bash
beans create "Retire biome-lsp bridge and biome.json when a Bun LSP exists" -t task -d "Owner-only change (biome.json is agent-untouchable, spec D1). When Bun ships an LSP for its linter, or the bridge is no longer worth the dual-config drift, remove plugins/biome-lsp/ and biome.json per docs/superpowers/specs/2026-10-18-biome-to-bun-migration-design.md §7." -s todo
```

- [ ] **Step 5: Final battery**

```bash
bun lint --max-warnings 0
bun fmt --check
bun test
claude plugin validate .
git diff -- biome.json
git status --porcelain | grep -E "\.(md|mdx)$"
```

Expected: lint clean; fmt-check clean; tests green; validate passes; biome diff empty; no markdown in status. Plus the invariant greps + twin checks per `CLAUDE.md` §Verification (byte-identical pass). Live smokes per spec §9.6: plant a `// x` comment in a package src file → `bun lint` reports `local/no-comments`; plant `const ab = 1;`-style 2-char name → `eslint/id-length`; append `export { };`-style block → `local/exports-last`. Remove the plants afterwards.

**Stop point — owner reviews, commits (include the bean file), and the migration is done.**
Suggested: `Docs: wire verification to bun lint/fmt; freeze biome bridge`

---

## Self-review record

- Spec coverage: §2 D1–D7 → Global Constraints + tasks (D1 T2/T4/T5 gates, D2/D6 untouched-by-construction, D3 T3/T4, D4/D7 T1 config + T1 D7 audit, D5 constraint, D7 severity doctrine). §3 architecture → T1 config + T5 docs. §4 + §4.1 parity → T1 steps 1–2. §5 plugin → T3 verbatim code + tests. §6 sequence → T1–T5 in order with the spec's commit boundaries. §7 wiring → T5 steps 1–4. §8 losses → T1 probe report records ABSENT rows. §9 verification → T2 step 3–4, T3 step 5, T4 step 3, T5 step 5. §10 files map → all touched. §11 constraints → Global Constraints. §12 → Review Focus with pinned tasks.
- Placeholder scan: the only deliberately unresolved values (`id-length.exceptions`, off-list, probe-row names) are owner/probe-decided by design and each has an explicit resolution step (T1) and approval gate (T1 stop point) — no "TBD" survives execution.
- Type consistency: plugin export shape (`meta.name: "local"`, rules map of `Rule.RuleModule` typed via the owner-installed `@types/eslint`) matches the bunfig keys `local/no-comments`/`local/exports-last`; test stubs match the rule `context` contract from Bun's plugin docs.
- Review Focus: all five pinned (T2.4, T1.3/T1.5, T1.3, T3.6, T1.4).

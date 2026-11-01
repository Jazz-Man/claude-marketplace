# Native-search policy — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deny Bash `grep`/`egrep`/`fgrep`/`find` with a teaching reason, route the native Grep/Glob tools through the filesystem read rules, and wire the plugin hook so the search tools actually reach the binary.

**Architecture:** A new small policy module (`native-search.ts`) inserted into `POLICIES` before `filesystem`; tool-channel routing in `run-hook.ts` reusing `checkFilePath(path, "read")` unchanged; payload gains the `path` key; the security-guard hook matcher extends to Grep/Glob. No filesystem engine changes.

**Tech Stack:** TypeScript (Bun), `bun:test` fixture tables, mitata bench suite untouched except self-check runs.

**Spec:** `docs/superpowers/specs/2026-11-01-native-search-policy-design.md` (approved; reason text, matrix, and rg-sanction pins are normative).

## Global Constraints

- Git is read-only for agents: every task ends at a stop point — the owner reviews and commits. No staging, no commits, no branches.
- No dependency changes. No comments in product code; biome preset "all" (caps 300/50).
- Gates per task and at finish: `bun test packages/cli-hook`, `rtk proxy biome check`, `bun check --strict --all`, `bun run --cwd packages/cli-hook build-bin`.
- The deny reason string is copied VERBATIM from the spec (§Component 1).
- `rg` must stay allowed; its path arguments are sanctioned by filesystemPolicy (Task 3 pins this).
- Models: implementer sonnet, reviewer opus (campaign doctrine).

## Review Focus

1. **Fail-open on absent `path`** — Grep/Glob without `path` must allow. Probe-verified: the harness sends NO `path` key when omitted (not project root, not cwd); the allow rests on the harness contract that a path-less search runs in-project. A missing-key crash or deny is a routing defect. Test: Task 2, step 1 row 3.
2. **Matcher regression is silent and total** — a typo in `hooks.json` disables ALL gating (not just search tools); `claude plugin validate .` plus a shape read-back are the only guards. Task 4 steps.
3. **Case variants of banned units** — `GREP pattern x`, `Find .` must deny (policy lowercases unit names); egrep/fgrep must not slip through as "not grep". Task 1 fixture rows.
4. **rg is the escape valve, not a hole** — `rg pat /etc/passwd` denies via filesystem boundary; `rg pat ~/.ssh/id_rsa` denies via secrets tier; `rg pat src/` allows. Task 3.
5. **Policy order visibility** — `grep /etc/passwd` must deny with the NATIVE-SEARCH reason (not the filesystem boundary reason); a wrong POLICIES order flips this silently. Task 1, step 6.
6. **`path` key extraction must not leak into Bash routing** — payload folds `path` into `filePath`; only the tool-name dispatch decides which channel consumes it. Task 2, step 5 pins Bash still ignores it.

---

### Task 1: native-search policy (bash channel)

**Files:**
- Create: `packages/cli-hook/src/policies/native-search.ts`
- Create: `packages/cli-hook/tests/fixtures/native-search.ts`
- Create: `packages/cli-hook/tests/native-search.test.ts`
- Modify: `packages/cli-hook/src/run-hook.ts` (import + `POLICIES` insertion)

**Interfaces:**
- Produces: `export const NATIVE_SEARCH_REASON: string`, `export const nativeSearchPolicy: Policy` (consumed by run-hook Task 1 and by nothing else; Grep/Glob routing in Task 2 does NOT touch it).

- [ ] **Step 1: Write the failing fixtures + test**

`tests/fixtures/native-search.ts`:

```ts
// native-search policy fixtures: bash grep/find are banned in favor of the
// built-in Grep/Glob tools; rg stays allowed as the CLI fallback.

export const DENY: string[] = [
  "grep pattern src/",
  "grep -rn pattern .",
  "egrep pattern file",
  "fgrep pattern file",
  "find . -name '*.ts'",
  "find /workspace -type f",
  "cat x | grep y",
  "ps aux | grep node",
  "GREP pattern file",
  "Find .",
  "time grep pattern .",
  "xargs grep pattern",
];

export const ALLOW: string[] = [
  "rg pattern src/",
  "rg -t ts pattern",
  "cat file",
  "ls -la",
];
```

`tests/native-search.test.ts`:

```ts
import { describe } from "bun:test";

import { nativeSearchPolicy, NATIVE_SEARCH_REASON } from "../src/policies/native-search.ts";
import { ALLOW, DENY } from "./fixtures/native-search.ts";
import { policyTableTests } from "./helpers/policy.ts";

describe("native-search policy", () => {
  policyTableTests(nativeSearchPolicy, { allow: ALLOW, deny: DENY }, NATIVE_SEARCH_REASON);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test packages/cli-hook`
Expected: FAIL — module `../src/policies/native-search.ts` not found.

- [ ] **Step 3: Implement the policy**

`src/policies/native-search.ts`:

```ts
import { deny } from "../core/decision.ts";
import { firstUnitHit, type Policy } from "../core/policy.ts";

const BANNED = new Set(["grep", "egrep", "fgrep", "find"]);

export const NATIVE_SEARCH_REASON =
  "Bash grep/find blocked (native-search policy): use the built-in Grep and Glob tools instead — they are faster and zone-checked. ripgrep (rg) stays allowed as the CLI fallback.";

export const nativeSearchPolicy: Policy = {
  check(cmd) {
    return firstUnitHit(cmd.units, (unit) =>
      BANNED.has(unit.name.toLowerCase()) ? deny(NATIVE_SEARCH_REASON) : null,
    );
  },
  name: "native-search",
};
```

- [ ] **Step 4: Run to verify the policy tests pass**

Run: `bun test packages/cli-hook -t "native-search policy"`
Expected: PASS (16 fixture rows).

- [ ] **Step 5: Wire into POLICIES (order is normative)**

`src/run-hook.ts` — add the import and insert between `noInlineScriptsPolicy` and `filesystemPolicy`:

```ts
const POLICIES: Policy[] = [
  noDepsPolicy,
  gitReadonlyPolicy,
  noInlineScriptsPolicy,
  nativeSearchPolicy,
  filesystemPolicy,
];
```

- [ ] **Step 6: Pin the reason precedence**

Add to `tests/run-hook.test.ts` (inside `describe("runHook (unit)")`):

```ts
it("bash grep denies with the native-search reason, not the filesystem boundary reason", () => {
  const result = runHook(bashPayload("grep pattern /etc/passwd"));
  expect(decisionOf(result)).toBe("deny");
  expect(reasonOf(result)).toContain("native-search policy");
});
```

Run: `bun test packages/cli-hook`
Expected: PASS — existing `grep`-bearing fixture rows in OTHER tables must be re-checked here: if any older table row used bare `grep`/`find` expecting a different verdict/reason, move that row to the native-search DENY table (behavior change is the spec, stale rows are not).

**Stop point 1: owner reviews and commits.**

---

### Task 1b: total ban — spec amendment (owner, 2026-11-01)

The spec's Component 1 was amended after Task 1 review: the ban is TOTAL —
banned names deny in ANY token position (unit name or argument), closing
wrapper/xargs holes and REPLACING the xargs special case with a simpler scan.

**Files:**
- Modify: `packages/cli-hook/src/policies/native-search.ts`
- Modify: `packages/cli-hook/tests/fixtures/native-search.ts`
- Modify: `packages/cli-hook/tests/run-hook.test.ts` (one wrapped-form pin)

- [ ] **Step 1: Add the failing rows**

To `tests/fixtures/native-search.ts` DENY:

```ts
  "env grep pattern .",
  "nice -n 5 grep pattern",
  "nohup find . -name x",
  "timeout 10 grep pattern src/",
  "parallel grep pattern ::: files",
  "sudo grep pattern /etc/passwd",
  "xargs -I {} grep pattern",
  "xargs -d '\\n' grep pattern",
  "echo grep",
```

- [ ] **Step 2: Run to verify failures**

Run: `bun test packages/cli-hook -t "native-search policy"`
Expected: FAIL — the current check misses wrapper forms and spaced xargs flags (`echo grep` fails too under the old logic).

- [ ] **Step 3: Simplify the policy to a total token scan**

Replace the check in `src/policies/native-search.ts` (the xargs branch from Task 1 is DELETED — the token scan subsumes it):

```ts
export const nativeSearchPolicy: Policy = {
  check(cmd) {
    return firstUnitHit(cmd.units, (unit) => {
      if (BANNED.has(unit.name.toLowerCase())) {
        return deny(NATIVE_SEARCH_REASON);
      }
      return unit.args.some((arg) => BANNED.has(arg.toLowerCase()))
        ? deny(NATIVE_SEARCH_REASON)
        : null;
    });
  },
  name: "native-search",
};
```

- [ ] **Step 4: Run the full suite**

Run: `bun test packages/cli-hook`
Expected: PASS — all Task 1 rows still deny (token scan is a superset), the new wrapper/xargs/echo rows deny, `rg` rows still allow.

- [ ] **Step 5: One wrapped-form reason pin in run-hook.test.ts**

```ts
it("wrapped bash grep denies with the native-search reason", () => {
  const result = runHook(bashPayload("timeout 10 grep pattern src/"));
  expect(decisionOf(result)).toBe("deny");
  expect(reasonOf(result)).toContain("native-search policy");
});
```

Run: `bun test packages/cli-hook`
Expected: PASS.

**Stop point 1b: owner reviews and commits (may fold with stop point 1).**

---

### Task 2: Grep/Glob tool-channel routing

**Files:**
- Modify: `packages/cli-hook/src/core/payload.ts` (add `"path"` key)
- Modify: `packages/cli-hook/src/run-hook.ts` (`SEARCH_TOOLS`, `routeSearchTool`, dispatch)
- Modify: `packages/cli-hook/tests/run-hook.test.ts` (tool-channel rows)

**Interfaces:**
- Consumes: `checkFilePath(filePath, intent, context)` from `filesystem/policy.ts` (unchanged), `ParsedHookInput.filePath` (now also fed by `tool_input.path`).
- Produces: no new exports; routing behavior only.

- [ ] **Step 1: Write the failing tool-channel tests**

Add to `tests/run-hook.test.ts` (new describe):

```ts
describe("search tool channel", () => {
  it("Grep outside the zone denies with the filesystem boundary reason", () => {
    const result = runHook({
      cwd: "/proj",
      hook_event_name: "PreToolUse",
      tool_input: { path: "/etc/passwd", pattern: "x" },
      tool_name: "Grep",
    });
    expect(decisionOf(result)).toBe("deny");
  });

  it("Grep inside the zone allows", () => {
    expect(
      runHook({
        cwd: "/proj",
        hook_event_name: "PreToolUse",
        tool_input: { path: "/proj/src", pattern: "x" },
        tool_name: "Grep",
      }),
    ).toBeNull();
  });

  it("Grep without a path allows (path absent-by-omission; harness default root, in-project by contract)", () => {
    expect(
      runHook({
        cwd: "/proj",
        hook_event_name: "PreToolUse",
        tool_input: { pattern: "x" },
        tool_name: "Grep",
      }),
    ).toBeNull();
  });

  it("Glob on the macos-library tier denies", () => {
    const result = runHook(filePayload("Glob", "~/Library/Caches"));
    expect(decisionOf(result)).toBe("deny");
  });

  it("Bash payloads ignore the path field (no channel leak)", () => {
    expect(
      runHook({
        cwd: "/proj",
        hook_event_name: "PreToolUse",
        tool_input: { command: "ls -la", path: "/etc" },
        tool_name: "Bash",
      }),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failures**

Run: `bun test packages/cli-hook -t "search tool channel"`
Expected: FAIL — Grep/Glob fall through to the fail-open `return null` (deny rows fail); the no-path row already passes (fail-open) — that row is the guard against over-tightening.

- [ ] **Step 3: Payload — accept `path`**

`src/core/payload.ts`:

```ts
    filePath: stringField(data, "file_path", "notebook_path", "path"),
```

- [ ] **Step 4: Routing**

`src/run-hook.ts`:

```ts
const SEARCH_TOOLS = new Set(["Grep", "Glob"]);

function routeSearchTool(
  payload: hookPayload.ParsedHookInput,
): SyncHookJSONOutput | null {
  if (payload.filePath === undefined) {
    return null;
  }
  return checkFilePath(payload.filePath, "read", {
    cwd: payload.cwd,
    projectRoot: projectRootOf(payload),
  });
}
```

and extend the dispatch:

```ts
    if (payload.toolName === "Bash") {
      return routeBash(payload);
    }
    if (SEARCH_TOOLS.has(payload.toolName)) {
      return routeSearchTool(payload);
    }
```

- [ ] **Step 5: Run the full suite**

Run: `bun test packages/cli-hook`
Expected: PASS — including the Bash no-leak row (Task 2, step 1, row 5).

**Stop point 2: owner reviews and commits.**

---

### Task 3: rg-sanction contract pins

**Files:**
- Modify: `packages/cli-hook/tests/fixtures/filesystem.ts` (+3 rows)

- [ ] **Step 1: Add the rows**

To `DENY`:

```ts
  "rg pattern /etc/passwd",
  "rg key ~/.ssh/id_rsa",
```

To `ALLOW`:

```ts
  "rg pattern src/",
```

- [ ] **Step 2: Run**

Run: `bun test packages/cli-hook -t "filesystem policy v2"`
Expected: PASS — the sanctions already hold mechanically (`rg` is in the read-intent table); these rows pin them by contract. If any row FAILS, stop and report: the fallback is an evasion hole the spec forbids.

**Stop point 3: owner reviews and commits.**

---

### Task 4: plugin wiring

**Files:**
- Modify: `plugins/security-guard/hooks/hooks.json`

- [ ] **Step 1: Extend the matcher and description**

```json
{
  "description": "Routes Bash, file-tool, and search-tool (Grep/Glob) calls through the claude-code-cli-hook policy binary (filesystem deny/ask engine, no-deps, git-readonly, no-inline-scripts, native-search; fail-open).",
  "hooks": {
    "PreToolUse": [
      {
        "hooks": [
          {
            "command": "claude-code-cli-hook",
            "timeout": 30,
            "type": "command"
          }
        ],
        "matcher": "^(Bash|Read|Edit|Write|NotebookEdit|Grep|Glob)$"
      }
    ]
  }
}
```

- [ ] **Step 2: Validate**

Run: `claude plugin validate .`
Expected: passes clean.

- [ ] **Step 3: Shape read-back**

Run: `cat plugins/security-guard/hooks/hooks.json`
Expected: matcher exactly `^(Bash|Read|Edit|Write|NotebookEdit|Grep|Glob)$` — a single character off silently disables every gate (Review Focus 2).

**Stop point 4: owner reviews and commits; reload plugins in-session.**

---

### Task 5: full gate sweep

- [ ] **Step 1: Gates**

Run, in order:

```bash
bun test packages/cli-hook
rtk proxy biome check
bun check --strict --all
bun run --cwd packages/cli-hook build-bin
claude plugin validate .
bun packages/cli-hook/bench/equiv.ts
```

Expected: all green; `equiv.ts` prints `EQUIVALENCE: all variants match on full corpus` (its corpus is unaffected by the new policy — it exercises parseCommand variants).

- [ ] **Step 2: Report**

Implementer reports the gate table; reviewer (opus) verifies the Review Focus list point by point against the diff and the test rows.

**Stop point 5: owner reviews, commits, and closes the feature.**

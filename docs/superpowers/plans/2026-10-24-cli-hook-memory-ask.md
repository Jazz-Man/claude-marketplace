# cli-hook memory-ask — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** every mutation of Claude Code project memory (`~/.claude/projects/*/memory/**`, any file type, the directory itself) returns `permissionDecision: "ask"` from both routes of the `claude-code-cli-hook` binary; reads stay free; three Bash-intent gaps and a wrapper-set drift (sudo bypass via `time`/`parallel`) close along the way.

**Architecture:** one path predicate (`memory.ts`) + one reason helper (`reasons.ts`), called at the two existing decision points (`checkFilePath` for file tools, `scopedDecision` for Bash args/redirects). Intent refinements live in `intents.ts`; the two drifted `WRAPPERS` constants unify into `src/core/wrappers.ts`.

**Tech stack:** Bun + `bun:test`, TypeScript strict, biome preset "all" (via `rtk proxy biome check`), single-file compile (`bun build.ts` → `~/.local/bin/claude-code-cli-hook`).

**Spec:** `docs/superpowers/specs/2026-10-24-cli-hook-memory-ask-design.md` (R1-R9)

## Global Constraints

- TDD mandatory: every behavior lands as a failing test first (RED captured before the fix).
- ZERO new code comments in `packages/cli-hook/src/` — the existing near-zero density holds. Test fixtures may keep the table-grouping comment style already present in `tests/fixtures/filesystem.ts`.
- Reuse, never re-invent: `expandToken`/`HOME` (resolve.ts), `ask`/`deny` (decision.ts), `policyCheck`/`decisionOf`/`reasonOf` (tests/helpers/policy.ts), `filePayload`/`bashPayload` (tests/helpers/utils.ts), the `DENY`/`ASK`/`ALLOW` fixture-array pattern, `it.each` drives. No new helpers beside `memoryTargetOf`, `memoryReason`, and the shared `SHARED_WRAPPERS` — and each replaces or extends an existing seam.
- No dependency changes; no edits outside `packages/cli-hook` (the plugin `hooks.json` is untouched).
- Agents never touch git: after each task the implementer stops, the OWNER reviews and commits.
- Gates after every task (cwd repo root): `bun test packages/cli-hook`, `rtk proxy biome check packages/cli-hook --write` then a clean re-run, `bun check --strict`.
- Biome caps: 300 lines/file, 50 lines/function — `run-hook.test.ts` (269 lines) breaches the file cap with new blocks: new describes go to module-named sibling test files, never appended there (Task 1 ruling).

## Review Focus

Input classes the spec implies but no single task owns end-to-end; each is pinned inside a task:

1. **Relative path into memory from a cwd under `$HOME`** (e.g. cwd `~/.claude/projects/-p`, command `tee memory/x.md`) — `expandToken` joins cwd → must ask (Task 2).
2. **Trailing-slash target** (`> ~/.../memory/`) normalizes to the dir itself — must ask, dir wording (Task 1 pins via `.../memory`, Task 2 via redirect).
3. **`$HOME`/`${HOME}` token forms** — normalize through the existing `homeVarToTilde` (Task 1 matrix).
4. **Deny precedence over ask** — a command combining memory write with a deny-tier path must deny, not ask (Task 2).
5. **Reads must not start asking** after the change — `cat`/`grep`/`ls` of memory paths and the whole existing ALLOW table stay green (every task's battery).

---

### Task 1: memory predicate + file-tool route

**Files:**
- Create: `packages/cli-hook/src/policies/filesystem/memory.ts`
- Modify: `packages/cli-hook/src/policies/filesystem/reasons.ts` (add `memoryReason`)
- Modify: `packages/cli-hook/src/policies/filesystem/policy.ts` (`checkFilePath`)
- Test: `packages/cli-hook/tests/memory-filetools.test.ts` (new file — amended during Task 1: the originally pinned `run-hook.test.ts` sits at 269 lines and the mandated block would breach the 300-line biome cap; the describe moved verbatim to a module-named sibling)

**Interfaces:**
- Consumes: `HOME` from `./resolve.ts`; `ask` from `../../core/decision.ts`; `filePayload` from `tests/helpers/utils.ts`.
- Produces: `memoryTargetOf(abs: string): "dir" | "md" | "other" | null` and `memoryReason(token: string, plain: boolean): string` — both consumed by Task 2.

- [ ] **Step 1: Write the failing tests** — new describe in `run-hook.test.ts` (beside the existing file-tool units; import `memoryReason` from `../src/policies/filesystem/reasons.ts`):

```ts
describe("project memory (file tools)", () => {
  const MEM = "~/.claude/projects/-proj-x/memory";

  it.each(["Write", "Edit", "NotebookEdit"])("asks on %s into memory .md", (tool) => {
    const decision = decisionOf(runHook(filePayload(tool, `${MEM}/fact.md`)));
    expect(decision).toBe("ask");
  });

  it("asks with the plain wording for .md and the dir itself", () => {
    expect(reasonOf(runHook(filePayload("Write", `${MEM}/fact.md`)))).toBe(
      memoryReason(`${MEM}/fact.md`, true),
    );
    expect(reasonOf(runHook(filePayload("Write", `${MEM}`)))).toBe(
      memoryReason(`${MEM}`, true),
    );
  });

  it.each([`${MEM}/fact.txt`, `${MEM}/noext`, `${MEM}/note.MD`])(
    "asks with the non-md wording on %s",
    (filePath) => {
      expect(reasonOf(runHook(filePayload("Write", filePath)))).toBe(
        memoryReason(filePath, false),
      );
    },
  );

  it.each([
    `$HOME/.claude/projects/-proj-x/memory/f.md`,
    `\${HOME}/.claude/projects/-proj-x/memory/f.md`,
    `${homedir()}/.claude/projects/-proj-x/memory/f.md`,
  ])("normalizes %s", (filePath) => {
    expect(decisionOf(runHook(filePayload("Write", filePath)))).toBe("ask");
  });

  it("keeps memory reads free", () => {
    expect(runHook(filePayload("Read", `${MEM}/fact.md`))).toBeNull();
  });

  it("does not touch sibling paths under .claude/projects", () => {
    expect(runHook(filePayload("Write", `~/.claude/projects/-proj-x/transcripts/t.jsonl`))).toBeNull();
    expect(runHook(filePayload("Write", `~/.claude/projects/-proj-x/memory-backup/f.md`))).toBeNull();
  });
});
```

(`homedir` is already imported in `filesystem.test.ts`; for `run-hook.test.ts` add `import { homedir } from "node:os"` beside the existing `process` import, plus the `memoryReason` import.)

- [ ] **Step 2: Run RED** — `bun test packages/cli-hook` — every new case fails (`memoryReason` unresolved / decisions null).

- [ ] **Step 3: Implement** — `memory.ts` (native `node:path` methods throughout, per the owner's `test.ts` idiom: `relative()` for tree containment — it handles arbitrary depth, which `basename(dirname())` alone cannot — and `parse().ext` for the extension):

```ts
import { parse, relative } from "node:path";
import { HOME } from "./resolve.ts";

const PROJECTS_ROOT = `${HOME}/.claude/projects`;

export type MemoryTarget = "dir" | "md" | "other";

export function memoryTargetOf(abs: string): MemoryTarget | null {
  if (HOME === "") {
    return null;
  }
  const rel = relative(PROJECTS_ROOT, abs);
  if (rel === "" || rel.startsWith("..")) {
    return null;
  }
  const segments = rel.split("/");
  if (segments[1] !== "memory") {
    return null;
  }
  if (segments.length === 2) {
    return "dir";
  }
  return parse(abs).ext === ".md" ? "md" : "other";
}
```

`reasons.ts` — one helper beside `askReason`:

```ts
export function memoryReason(token: string, plain: boolean): string {
  return plain
    ? `Filesystem policy: "${token}" modifies project memory — confirmation required.`
    : `Filesystem policy: "${token}" modifies project memory (non-.md file — memory accepts .md only) — confirmation required.`;
}
```

`policy.ts` `checkFilePath` — after `expandToken`, before the tier lookup:

```ts
const memory = memoryTargetOf(abs);
if (memory !== null && intent === "write") {
  return ask(memoryReason(filePath, memory !== "other"));
}
```

(imports: `memoryTargetOf` from `./memory.ts`, `memoryReason` added to the reasons import).

- [ ] **Step 4: Run GREEN + battery** — `bun test packages/cli-hook` all green; biome + strict per Global Constraints.

---

### Task 2: Bash route + null-intent rule

**Files:**
- Modify: `packages/cli-hook/src/policies/filesystem/policy.ts` (`scopedDecision`)
- Create: `packages/cli-hook/tests/fixtures/memory.ts`
- Modify: `packages/cli-hook/tests/filesystem.test.ts` (import + describe)

**Interfaces:**
- Consumes: `memoryTargetOf`/`memoryReason` from Task 1; `ASK`/`ALLOW`-style fixture arrays; `policyCheck`/`decisionOf`/`reasonOf`.
- Produces: fixture exports `MEMORY_ASK: string[]`, `MEMORY_ALLOW: string[]` (Task 3 appends rows).

- [ ] **Step 1: Write the failing fixtures + describe.** `tests/fixtures/memory.ts`:

```ts
// Memory-policy fixtures: literal Bash payloads judged by the shared
// filesystem engine; the memory tree lives under the always-allowed $HOME
// zone, so every mutating row here would pass silently without the policy.

export const MEMORY_ASK: string[] = [
  "echo x > ~/.claude/projects/-p/memory/n.md",
  "echo x >> ~/.claude/projects/-p/memory/n.md",
  "rm ~/.claude/projects/-p/memory/n.md",
  "rm ~/.claude/projects/-p/memory/stray.bin",
  "mv f ~/.claude/projects/-p/memory/n.md",
  "cp ~/www/repo/f.md ~/.claude/projects/-p/memory/n.md",
  "cp f.txt ~/.claude/projects/-p/memory/f.txt",
  "tee ~/.claude/projects/-p/memory/n.md",
  "touch ~/.claude/projects/-p/memory/n.md",
  "mkdir -p ~/.claude/projects/-p/memory/sub",
  "unknowntool ~/.claude/projects/-p/memory/f.md",
];

export const MEMORY_ALLOW: string[] = [
  "cat ~/.claude/projects/-p/memory/n.md",
  "grep x ~/.claude/projects/-p/memory/n.md",
  "ls ~/.claude/projects/-p/memory",
  "cat ~/.claude/projects/-p/transcripts/t.jsonl",
  "tee ~/www/repo/build/x",
];
```

In `filesystem.test.ts`, beside the existing describes (default context cwd `/proj`, projectRoot `/proj` — the memory rows are `$HOME`-anchored so the default is fine):

```ts
describe("filesystem policy (project memory)", () => {
  it.each(MEMORY_ASK)("asks on %s", (command) => {
    expect(decisionOf(policyCheck(filesystemPolicy, command))).toBe("ask");
  });

  it.each(MEMORY_ALLOW)("allows %s", (command) => {
    expect(policyCheck(filesystemPolicy, command)).toBeNull();
  });

  it("asks with the plain wording for md and the warning wording for non-md", () => {
    expect(
      reasonOf(policyCheck(filesystemPolicy, "tee ~/.claude/projects/-p/memory/n.md n")),
    ).toBe(memoryReason("~/.claude/projects/-p/memory/n.md", true));
    expect(
      reasonOf(policyCheck(filesystemPolicy, "cp f.txt ~/.claude/projects/-p/memory/f.txt")),
    ).toBe(memoryReason("~/.claude/projects/-p/memory/f.txt", false));
  });

  it("asks on a relative memory path from a cwd inside the projects tree", () => {
    expect(
      decisionOf(
        policyCheck(filesystemPolicy, "tee memory/x.md", {
          cwd: `${homedir()}/.claude/projects/-p`,
          projectRoot: "/proj",
        }),
      ),
    ).toBe("ask");
  });

  it("deny beats ask when one command hits memory and a deny tier", () => {
    expect(
      decisionOf(
        policyCheck(
          filesystemPolicy,
          "cp ~/.ssh/id_rsa ~/.claude/projects/-p/memory/k.md",
        ),
      ),
    ).toBe("deny");
  });
});
```

- [ ] **Step 2: Run RED** — the MEMORY_ASK rows fail (today: null/allow).

- [ ] **Step 3: Implement** — `scopedDecision` in `policy.ts`, immediately after the `inAllowedZone` gate (before the HOME-whole-read ask):

```ts
if (intent !== "read") {
  const memory = memoryTargetOf(abs);
  if (memory !== null) {
    return ask(memoryReason(arg, memory !== "other"));
  }
}
```

`intent` here is `Intent | null`; the `!== "read"` guard covers write, delete, AND null (R7 — unknown binaries ask). Redirect targets already flow into `scopedDecision` via `candidateDecision`, so `>`/`>>` rows ask with no extra wiring.

- [ ] **Step 4: Run GREEN + battery.**

---

### Task 3: intent refinements — find -delete, sed/perl -i

**Files:**
- Modify: `packages/cli-hook/src/policies/filesystem/intents.ts`
- Modify: `packages/cli-hook/tests/fixtures/memory.ts` (append rows)

**Interfaces:**
- Consumes: `INTENTS` table, `intentOf(name, args)` signature (unchanged externally).
- Produces: flag-adjusted intents — `find`+`-delete` → `delete`; `sed`/`perl` short-flag cluster containing `i` → `write`; `sed`/`perl` otherwise → `read`.

- [ ] **Step 1: Extend the fixture arrays** — add the rows directly into the `MEMORY_ASK` / `MEMORY_ALLOW` literals in `tests/fixtures/memory.ts` (one literal per line, same grouping style; the tables stay declarative — no imperative appends):

`MEMORY_ASK` gains:

```ts
  "sed -i 's/a/b/' ~/.claude/projects/-p/memory/f.md",
  "perl -pi -e 's/a/b/' ~/.claude/projects/-p/memory/f.md",
  "find ~/.claude/projects/-p/memory -name '*.md' -delete",
```

`MEMORY_ALLOW` gains:

```ts
  "sed 's/a/b/' ~/.claude/projects/-p/memory/f.md",
  "find ~/.claude/projects/-p/memory -name '*.md'",
```

- [ ] **Step 2: Run RED** — the three ASK rows fail (sed/perl null-intent → they only ask via R7's null rule… note: after Task 2, `sed -i` WITHOUT the flag rule already asks because null intent asks — so the RED here is subtle: write the three rows, observe `sed -i` passes already via R7, `find -delete` fails (find is known read), `perl -pi` passes via null. To make the refinement observable, also pin the NON-memory side effect in `run-hook.test.ts`: `decisionOf(runHook(bashPayload("sed -i 's/a/b/' ~/www/repo/f.ts")))` stays null, and add a direct unit in `filesystem.test.ts` asserting `find ... -delete` OUTSIDE memory on a non-zone path denies via delete-intent zone breach: `decisionOf(policyCheck(filesystemPolicy, "find /workspace -name x -delete"))` → `"deny"`. That row is the true RED for the flag rule.)

- [ ] **Step 3: Implement** — in `intents.ts`: add `sed: "read"` and `perl: "read"` to `INTENTS`; add a flag adjustment applied to the table intent inside `intentOf` (and re-exported through `unwrapScan` results by applying it where the intent is resolved — the single choke point is `resolveToken`):

```ts
const IN_PLACE_CLUSTER = /^-[A-Za-z]*i[A-Za-z]*$/u;

function adjustForFlags(
  base: string,
  intent: Intent | null,
  args: readonly string[],
): Intent | null {
  if (base === "find" && args.includes("-delete")) {
    return "delete";
  }
  if (
    (base === "sed" || base === "perl") &&
    args.some((arg) => IN_PLACE_CLUSTER.test(arg))
  ) {
    return "write";
  }
  return intent;
}
```

Apply in `resolveToken` where `INTENTS[ast.baseName(token)]` resolves (pass the args tail), and in `intentOf`'s direct-return branch. `WRAPPERS.has(name)` unwrap path gets it via `resolveToken`. The cluster regex matches `-i`, `-pi`, `-ni` and rejects `-i.bak` (documented as out of scope; macOS `sed -i ''` is the cluster form).

- [ ] **Step 4: Run GREEN + battery.**

---

### Task 4: shared WRAPPERS + sudo pins

**Files:**
- Create: `packages/cli-hook/src/core/wrappers.ts`
- Modify: `packages/cli-hook/src/policies/filesystem/intents.ts` (consume shared set)
- Modify: `packages/cli-hook/src/policies/no-inline-scripts.ts` (consume shared set + local `find`)
- Modify: `packages/cli-hook/tests/fixtures/filesystem.ts` (DENY rows)
- Modify: `packages/cli-hook/tests/filesystem.test.ts` (reason pin)

**Interfaces:**
- Consumes: both existing `WRAPPERS` sets (removed).
- Produces: `SHARED_WRAPPERS: ReadonlySet<string>` = `env, nice, nohup, parallel, sudo, time, timeout, xargs`.

- [ ] **Step 1: Write failing tests** — append to `DENY` in `tests/fixtures/filesystem.ts` (new group at the end of the array):

```ts
  // sudo ban — directly and behind wrappers (time/parallel were a bypass)
  "sudo rm -rf /tmp/x",
  "xargs sudo rm x",
  "time sudo rm x",
  "parallel sudo rm x",
```

And a reason pin in `filesystem.test.ts`:

```ts
  it("the sudo deny fires behind time, with the sudo reason", () => {
    expect(reasonOf(policyCheck(filesystemPolicy, "time sudo rm x"))).toBe(SUDO_REASON);
  });
```

(`SUDO_REASON` imported from `../src/policies/filesystem/reasons.ts`.)

- [ ] **Step 2: Run RED** — `time sudo rm x` and `parallel sudo rm x` fail (not denied today); the other two rows pass already.

- [ ] **Step 3: Implement** — `src/core/wrappers.ts`:

```ts
export const SHARED_WRAPPERS: ReadonlySet<string> = new Set([
  "env",
  "nice",
  "nohup",
  "parallel",
  "sudo",
  "time",
  "timeout",
  "xargs",
]);
```

`intents.ts`: delete the local `WRAPPERS`, import `SHARED_WRAPPERS`, use it in `intentOf`'s branch (`name !== "sudo"` check becomes redundant — keep the simplest correct condition: `if (!SHARED_WRAPPERS.has(name))` return direct; `sudo` flows through `unwrapScan`, which already tracks the sudo token).

`no-inline-scripts.ts`: delete its local `WRAPPERS`, replace with:

```ts
const WRAPPERS = new Set([...SHARED_WRAPPERS, "find"]);
```

(its heredoc detection legitimately needs `find`; that local extension is the only intentional difference between the two sets).

- [ ] **Step 4: Run GREEN + FULL battery** — the whole package suite must be green, including every pre-existing `no-inline-scripts` and wrapper case (the union set must not change any pinned behavior beyond the two sudo rows; if any old test flips, stop and investigate — that is a behavior regression, not a test problem).

---

### Task 5: whole-repo gates + binary rebuild + live smoke

**Files:** none created/modified (verification only).

- [ ] **Step 1: Full suite from repo root** — `bun test` (repo root, all packages) — zero failures.
- [ ] **Step 2: Lint + types** — `rtk proxy biome check packages/cli-hook --write`, clean re-run; `bun check --strict`.
- [ ] **Step 3: Rebuild** — `cd packages/cli-hook && bun run build-bin` (writes `~/.local/bin/claude-code-cli-hook`; the hook execs fresh per tool call — no session restart needed).
- [ ] **Step 4: Live smoke (with the owner)** — in the live session, ask the agent to save a one-line memory: the permission prompt MUST appear with the memory reason; declining leaves the memory dir unchanged; a `Read` of `MEMORY.md` stays unprompted. Record the outcome in the bean.

---

## Self-review

- Spec coverage: R1-R2 → Tasks 1-2; R3 → Task 1 (Read pin) + MEMORY_ALLOW; R4 → sibling-path pins (both tasks); R5 → deny-beats-ask pin (Task 2); R6 → Task 3; R7 → Task 2 (`intent !== "read"` includes null; `unknowntool` row); R8 → Global Constraints (no files outside package); R9 → Task 4.
- Placeholder scan: none; every step carries its code or exact command.
- Type consistency: `memoryTargetOf` returns `"dir" | "md" | "other" | null` in both tasks; `memoryReason(token, plain: boolean)` matches both call sites; `adjustForFlags` consumes/returns `Intent | null` consistent with `intentOf`.
- Review Focus: all five rows pinned (relative-cwd Task 2, trailing-slash dir Task 1, `$HOME` forms Task 1, precedence Task 2, read-freedom every task).

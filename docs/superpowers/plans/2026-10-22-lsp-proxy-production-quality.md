# lsp-proxy Production Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the lsp-proxy POC into production-quality code — fix 1 critical + 12 important + 28 minor audit findings, establish type-safe boundaries, consolidate DRY, ensure liveness — while preserving all 70+ green tests and the live-tested behavior.

**Architecture:** Three-phase bottom-up: (1) shared infrastructure (guards/, types/, constants/, utils/), (2) type-safe boundaries (OOP config, method registry, client narrowing), (3) liveness fixes (waiter sweep, timeout, exception isolation) + architecture cleanup.

**Tech Stack:** Bun runtime, TypeScript strict mode (`bun check --strict`), biome preset "all" (zero suppressions), `vscode-languageserver-types` for protocol types, `node:util` `parseArgs`.

**Spec:** `docs/superpowers/specs/2026-10-22-lsp-proxy-production-quality-design.md` — the binding authority; decisions P1-P4.

## Global Constraints

- Spec P1-P4 bind every task; conflicts resolve against the spec.
- TDD mandatory (spec P2 implies): every implementation step is preceded by its failing test in the same task.
- The agent NEVER writes to git. Every task ends at a STOP POINT — the owner reviews and commits.
- No dependency installs. No changes to `biome.json`, `.zed/`, `plugins/`, `packages/bin-builder/`.
- Style guards: biome preset "all" (sorted keys, inline exports, helpers-first/exports-last, functions ≤ 50 lines, identifiers ≥ 2 chars, no `any`, noTernary → if/else, no bare indexed access — use destructuring + guards).
- `bun check --strict` is the type gate (0 errors required).
- Biome is currently DISABLED in the live plugin — run `rtk proxy biome check packages/lsp-proxy --write` manually after every batch of edits.
- All existing tests MUST stay green — this is a refactoring, not a rewrite. External behavior unchanged.
- Shell commands use literal absolute paths (filesystem PreToolUse guard).

## Review Focus

1. **Server crash mid-request hangs forever** — the proxy must resolve pending waiters with an error, not leave them in a permanent Promise.all → Task 7 (waiter sweep).
2. **Malformed client message kills the entire session** — one bad didOpen (missing text) currently throws deep in docstore and exits the client read loop → Task 6 (boundary narrowing) + Task 8 (exception isolation).
3. **Spawn failure leaves client hanging** — `tsc` binary not found → initialize never replies → Claude Code thinks the proxy is dead → Task 8 (initialize failure reply).
4. **isRecord drift** — the 6th copy passes `null` (doesn't exclude it) → any code using it accepts `null` as a Record → Task 1 (single shared guard) + Task 6 (replace all copies).
5. **PROVIDER_KEYS / METHOD_CAPABILITY desync** — add a method to the router, forget PROVIDER_KEYS → capability silently missing from the merged advertise → Task 5 (method registry derives capabilities).

---

### Task 1: `guards/` — shared type predicates + ConfigError

**Files:**
- Create: `packages/lsp-proxy/src/guards/index.ts`
- Create: `packages/lsp-proxy/tests/guards.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `isRecord(value): value is Record<string, unknown>`, `isNonEmptyString(value): value is string`, `isStringArray(value): value is string[]`, `isStringRecord(value): value is Record<string, string>`, `asRecord(value, context): Record<string, unknown>`, `asArray(value, context): unknown[]`, `class ConfigError extends Error`.

- [ ] **Step 1: RED — failing guards tests**

`packages/lsp-proxy/tests/guards.test.ts`:

```ts
import { describe, expect, it } from "bun:test";

import {
  asArray,
  asRecord,
  ConfigError,
  isNonEmptyString,
  isRecord,
  isStringArray,
  isStringRecord,
} from "../src/guards/index.ts";

describe("isRecord", () => {
  it("accepts plain objects", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ key: "value" })).toBe(true);
  });

  it("rejects null, arrays, primitives", () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
    expect(isRecord([1, 2])).toBe(false);
    expect(isRecord("string")).toBe(false);
    expect(isRecord(42)).toBe(false);
  });
});

describe("isNonEmptyString", () => {
  it("accepts non-empty strings", () => {
    expect(isNonEmptyString("hello")).toBe(true);
  });

  it("rejects empty strings and non-strings", () => {
    expect(isNonEmptyString("")).toBe(false);
    expect(isNonEmptyString(42)).toBe(false);
    expect(isNonEmptyString(null)).toBe(false);
    expect(isNonEmptyString(undefined)).toBe(false);
  });
});

describe("isStringArray", () => {
  it("accepts arrays of strings", () => {
    expect(isStringArray(["a", "b"])).toBe(true);
    expect(isStringArray([])).toBe(true);
  });

  it("rejects arrays with non-string elements", () => {
    expect(isStringArray(["a", 42])).toBe(false);
    expect(isStringArray([null])).toBe(false);
  });

  it("rejects non-arrays", () => {
    expect(isStringArray("string")).toBe(false);
    expect(isStringArray(null)).toBe(false);
  });
});

describe("isStringRecord", () => {
  it("accepts records with string values", () => {
    expect(isStringRecord({ key: "value" })).toBe(true);
    expect(isStringRecord({})).toBe(true);
  });

  it("rejects records with non-string values", () => {
    expect(isStringRecord({ key: 42 })).toBe(false);
    expect(isStringRecord({ key: null })).toBe(false);
  });

  it("rejects non-records", () => {
    expect(isStringRecord(null)).toBe(false);
    expect(isStringRecord([1])).toBe(false);
  });
});

describe("asRecord", () => {
  it("returns the record for valid input", () => {
    expect(asRecord({ key: 1 }, "test")).toEqual({ key: 1 });
  });

  it("throws ConfigError for non-records", () => {
    expect(() => asRecord(null, "test context")).toThrow(ConfigError);
    expect(() => asRecord(42, "test context")).toThrow("test context");
  });
});

describe("asArray", () => {
  it("returns the array for valid input", () => {
    expect(asArray([1, 2], "test")).toEqual([1, 2]);
  });

  it("throws ConfigError for non-arrays", () => {
    expect(() => asArray("string", "test context")).toThrow(ConfigError);
  });
});

describe("ConfigError", () => {
  it("carries field context", () => {
    const error = new ConfigError("servers[0].name", "string", 42);
    expect(error.field).toBe("servers[0].name");
    expect(error.expected).toBe("string");
    expect(error.actual).toBe("number");
    expect(error.message).toContain("servers[0].name");
    expect(error.message).toContain("string");
    expect(error.message).toContain("number");
  });
});
```

- [ ] **Step 2: Run RED**

Run: `cd /Users/vasilsokolik/www/cc-sdd/packages/lsp-proxy && bun test tests/guards.test.ts`
Expected: FAIL — cannot resolve `../src/guards/index.ts`.

- [ ] **Step 3: GREEN — guards implementation**

`packages/lsp-proxy/src/guards/index.ts`:

```ts
export class ConfigError extends Error {
  readonly actual: string;
  readonly expected: string;
  readonly field: string;

  constructor(field: string, expected: string, actual: string) {
    super(`config field "${field}" must be ${expected}, got ${actual}`);
    this.field = field;
    this.expected = expected;
    this.actual = actual;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

export function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

export function isStringRecord(
  value: unknown,
): value is Record<string, string> {
  if (!isRecord(value)) {
    return false;
  }
  return Object.values(value).every((item) => typeof item === "string");
}

export function asRecord(
  value: unknown,
  context: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new ConfigError(context, "an object", typeof value);
  }
  return value;
}

export function asArray(value: unknown, context: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new ConfigError(context, "an array", typeof value);
  }
  return value;
}
```

- [ ] **Step 4: GREEN run + battery**

Run: `cd /Users/vasilsokolik/www/cc-sdd/packages/lsp-proxy && bun test` → ALL suites PASS (existing 70+ plus new guards tests).
Run: `cd /Users/vasilsokolik/www/cc-sdd && rtk proxy biome check packages/lsp-proxy --write` → clean.
Run: `cd /Users/vasilsokolik/www/cc-sdd && bun check --strict` → 0 errors.

- [ ] **Step 5: STOP POINT — owner commits Task 1.**

---

### Task 2: `constants/` + `types/` — shared constants and types

**Files:**
- Create: `packages/lsp-proxy/src/constants/index.ts`
- Create: `packages/lsp-proxy/src/types/index.ts`
- Modify: `packages/lsp-proxy/src/framing.ts` — export JsonRpcMessage/JsonRpcError from types/ instead (re-export for compatibility)
- Modify: `packages/lsp-proxy/src/router.ts` — export ServerCapabilities from types/ instead (re-export for compatibility)

**Interfaces:**
- Consumes: nothing new.
- Produces: `LspErrorCode` (constants), `SyncKind` (constants), `TimeoutMs` (constants); `JsonRpcMessage` and `JsonRpcError` (types — canonical home, re-exported from framing for backward compat); `ServerCapabilities` (types — canonical home, re-exported from router).

- [ ] **Step 1: Create constants module**

`packages/lsp-proxy/src/constants/index.ts`:

```ts
export const LspErrorCode = {
  InternalError: -32603,
  MethodNotFound: -32601,
  RequestCancelled: -32800,
  ServerNotInitialized: -32002,
} as const;

export const SyncKind = {
  Incremental: 2,
} as const;

export const TimeoutMs = {
  initialize: 30_000,
  request: 15_000,
} as const;
```

- [ ] **Step 2: Create types module**

`packages/lsp-proxy/src/types/index.ts`:

```ts
export interface JsonRpcError {
  code: number;
  data?: unknown;
  message: string;
}

export interface JsonRpcMessage {
  error?: JsonRpcError;
  id?: number | string | null;
  jsonrpc: "2.0";
  method?: string;
  params?: unknown;
  result?: unknown;
}

export type ServerCapabilities = Record<string, unknown>;
```

- [ ] **Step 3: Update framing.ts to re-export from types/**

In `packages/lsp-proxy/src/framing.ts`, replace the local `JsonRpcError` and `JsonRpcMessage` interface declarations with:

```ts
import type { JsonRpcError, JsonRpcMessage } from "./types/index.ts";

export type { JsonRpcError, JsonRpcMessage };
```

(Keep the `import type` at the top with the other imports; the `export type` re-export ensures all existing importers of `JsonRpcMessage` from `./framing.ts` continue to work without changes.)

- [ ] **Step 4: Update router.ts to re-export ServerCapabilities**

In `packages/lsp-proxy/src/router.ts`, replace the local `ServerCapabilities` type declaration with:

```ts
import type { ServerCapabilities } from "./types/index.ts";

export type { ServerCapabilities };
```

- [ ] **Step 5: Verify no regressions**

Run: `cd /Users/vasilsokolik/www/cc-sdd/packages/lsp-proxy && bun test` → ALL PASS (no test changes needed — re-exports are transparent).
Run: `cd /Users/vasilsokolik/www/cc-sdd && rtk proxy biome check packages/lsp-proxy --write` → clean.
Run: `cd /Users/vasilsokolik/www/cc-sdd && bun check --strict` → 0 errors.

- [ ] **Step 6: STOP POINT — owner commits Task 2.**

---

### Task 3: `utils/` — sortByPriority + replace divergent copies

**Files:**
- Create: `packages/lsp-proxy/src/utils/index.ts`
- Create: `packages/lsp-proxy/tests/utils.test.ts`
- Modify: `packages/lsp-proxy/src/merge.ts` — replace local `ordered()` with `sortByPriority`
- Modify: `packages/lsp-proxy/src/capabilities.ts` — replace local sort with `sortByPriority`

**Interfaces:**
- Consumes: nothing new.
- Produces: `sortByPriority<T extends { server: string }>(list: T[], priority: string[]): T[]` — missing names sort LAST.

- [ ] **Step 1: RED — failing utils tests**

`packages/lsp-proxy/tests/utils.test.ts`:

```ts
import { describe, expect, it } from "bun:test";

import { sortByPriority } from "../src/utils/index.ts";

describe("sortByPriority", () => {
  it("sorts by priority order", () => {
    const items = [
      { name: "zeta", server: "zeta" },
      { name: "alpha", server: "alpha" },
    ];
    const sorted = sortByPriority(items, ["alpha", "zeta"]);
    expect(sorted.map((item) => item.server)).toEqual(["alpha", "zeta"]);
  });

  it("handles items missing from priority list (sorts last)", () => {
    const items = [
      { name: "unknown", server: "unknown" },
      { name: "known", server: "known" },
    ];
    const sorted = sortByPriority(items, ["known"]);
    expect(sorted[0]?.server).toBe("known");
    expect(sorted[1]?.server).toBe("unknown");
  });

  it("does not mutate the input array", () => {
    const items = [
      { name: "zeta", server: "zeta" },
      { name: "alpha", server: "alpha" },
    ];
    const copy = [...items];
    sortByPriority(items, ["alpha", "zeta"]);
    expect(items).toEqual(copy);
  });
});
```

- [ ] **Step 2: Run RED**

Run: `cd /Users/vasilsokolik/www/cc-sdd/packages/lsp-proxy && bun test tests/utils.test.ts`
Expected: FAIL — cannot resolve `../src/utils/index.ts`.

- [ ] **Step 3: GREEN — utils implementation**

`packages/lsp-proxy/src/utils/index.ts`:

```ts
export function sortByPriority<T extends { server: string }>(
  list: T[],
  priority: string[],
): T[] {
  return [...list].sort((left, right) => {
    const leftIndex = priority.indexOf(left.server);
    const rightIndex = priority.indexOf(right.server);
    if (leftIndex === -1 && rightIndex === -1) {
      return 0;
    }
    if (leftIndex === -1) {
      return 1;
    }
    if (rightIndex === -1) {
      return -1;
    }
    return leftIndex - rightIndex;
  });
}
```

- [ ] **Step 4: Replace merge.ts local ordered()**

In `packages/lsp-proxy/src/merge.ts`: delete the local `ordered` function and import `sortByPriority` from `./utils/index.ts`. Replace all `ordered(outcomes, priority)` calls with `sortByPriority(outcomes, priority)`. The local function used a different missing-name idiom (`(indexOf + 1 || priority.length + 1)`) — the shared version sorts missing names last explicitly, which is the same behavior but clearer.

- [ ] **Step 5: Replace capabilities.ts local sort**

In `packages/lsp-proxy/src/capabilities.ts`: replace the local sort comparator in `mergeCapabilities` with `sortByPriority(orderedInputs, priority)`. Note: the current code sorts missing names FIRST (via raw indexOf returning -1) — this is the D5 divergence. The shared version sorts them LAST (matching merge.ts semantics). This is a behavior fix, not a regression.

- [ ] **Step 6: GREEN run + battery**

Run: `cd /Users/vasilsokolik/www/cc-sdd/packages/lsp-proxy && bun test` → ALL PASS.
Run: `cd /Users/vasilsokolik/www/cc-sdd && rtk proxy biome check packages/lsp-proxy --write` → clean.
Run: `cd /Users/vasilsokolik/www/cc-sdd && bun check --strict` → 0 errors.

- [ ] **Step 7: STOP POINT — owner commits Task 3.**

---

### Task 4: OOP Config classes (ServerConfig + ProxyConfig + ConfigError integration)

**Files:**
- Create: `packages/lsp-proxy/src/config/ServerConfig.ts`
- Create: `packages/lsp-proxy/src/config/ProxyConfig.ts`
- Create: `packages/lsp-proxy/tests/config-oop.test.ts`
- Modify: `packages/lsp-proxy/src/config.ts` — becomes a thin re-export from config/ classes; delete all validation code
- Modify: all files that import from `./config.ts` — update to import from the class-based API

**Interfaces:**
- Consumes: `isRecord`, `isNonEmptyString`, `isStringArray`, `isStringRecord`, `asRecord`, `asArray`, `ConfigError` from `../guards/index.ts`.
- Produces: `class ServerConfig { readonly name: string; readonly command: string; readonly extensionToLanguage: Record<string, string>; readonly args?: string[]; readonly env?: Record<string, string>; readonly initializationOptions?: unknown; readonly settings?: unknown }`, `class ProxyConfig { readonly servers: ServerConfig[] }`. The `parseConfig` function is replaced by `new ProxyConfig(raw)` — callers switch from `parseConfig(raw)` to `new ProxyConfig(raw)` wrapped in try/catch for ConfigError.

- [ ] **Step 1: RED — failing OOP config tests**

`packages/lsp-proxy/tests/config-oop.test.ts`:

```ts
import { describe, expect, it } from "bun:test";

import { ProxyConfig } from "../src/config/ProxyConfig.ts";
import { ConfigError } from "../src/guards/index.ts";

describe("ServerConfig validation", () => {
  it("constructs from valid raw JSON", () => {
    const server = new ProxyConfig({
      servers: [
        {
          args: ["--stdio"],
          command: "vtsls",
          extensionToLanguage: { ".ts": "typescript" },
          name: "vtsls",
        },
      ],
    });
    expect(server.servers[0]?.name).toBe("vtsls");
    expect(server.servers[0]?.args).toEqual(["--stdio"]);
  });

  it("rejects empty name", () => {
    expect(() => new ProxyConfig({
      servers: [{ command: "cmd", extensionToLanguage: { ".ts": "ts" }, name: "" }],
    })).toThrow(ConfigError);
  });

  it("rejects args with non-string elements", () => {
    expect(() => new ProxyConfig({
      servers: [{
        args: [1, 2],
        command: "cmd",
        extensionToLanguage: { ".ts": "ts" },
        name: "test",
      }],
    })).toThrow(ConfigError);
    expect(() => new ProxyConfig({
      servers: [{
        args: [1, 2],
        command: "cmd",
        extensionToLanguage: { ".ts": "ts" },
        name: "test",
      }],
    })).toThrow("args");
  });

  it("rejects env with non-string values", () => {
    expect(() => new ProxyConfig({
      servers: [{
        command: "cmd",
        env: { key: 42 },
        extensionToLanguage: { ".ts": "ts" },
        name: "test",
      }],
    })).toThrow(ConfigError);
  });

  it("rejects extensionToLanguage with dotless keys", () => {
    expect(() => new ProxyConfig({
      servers: [{
        command: "cmd",
        extensionToLanguage: { ts: "typescript" },
        name: "test",
      }],
    })).toThrow("must start with '.'");
  });

  it("rejects duplicate server names", () => {
    expect(() => new ProxyConfig({
      servers: [
        { command: "a", extensionToLanguage: { ".ts": "ts" }, name: "dup" },
        { command: "b", extensionToLanguage: { ".ts": "ts" }, name: "dup" },
      ],
    })).toThrow("duplicate");
  });

  it("rejects extension mapped to conflicting languages", () => {
    expect(() => new ProxyConfig({
      servers: [
        { command: "a", extensionToLanguage: { ".ts": "typescript" }, name: "a" },
        { command: "b", extensionToLanguage: { ".ts": "javascript" }, name: "b" },
      ],
    })).toThrow("conflict");
  });

  it("allows same extension mapped to same language", () => {
    const config = new ProxyConfig({
      servers: [
        { command: "a", extensionToLanguage: { ".ts": "typescript" }, name: "a" },
        { command: "b", extensionToLanguage: { ".ts": "typescript" }, name: "b" },
      ],
    });
    expect(config.servers).toHaveLength(2);
  });

  it("rejects non-object server entry", () => {
    expect(() => new ProxyConfig({ servers: [42] })).toThrow(ConfigError);
  });

  it("rejects empty servers array", () => {
    expect(() => new ProxyConfig({ servers: [] })).toThrow("not be empty");
  });
});
```

- [ ] **Step 2: Run RED**

Run: `cd /Users/vasilsokolik/www/cc-sdd/packages/lsp-proxy && bun test tests/config-oop.test.ts`
Expected: FAIL — cannot resolve `../src/config/ProxyConfig.ts`.

- [ ] **Step 3: GREEN — ServerConfig class**

`packages/lsp-proxy/src/config/ServerConfig.ts`:

```ts
import {
  asRecord,
  ConfigError,
  isNonEmptyString,
  isRecord,
  isStringArray,
  isStringRecord,
} from "../guards/index.ts";

export class ServerConfig {
  private readonly _name: string;
  private readonly _command: string;
  private readonly _extensionToLanguage: Record<string, string>;
  private readonly _args?: string[];
  private readonly _env?: Record<string, string>;
  private readonly _initializationOptions?: unknown;
  private readonly _settings?: unknown;

  constructor(raw: unknown, context: string) {
    const record = asRecord(raw, context);
    this._name = this.validateName(record.name, context);
    this._command = this.validateCommand(record.command, context);
    this._extensionToLanguage = this.validateExtensionMap(
      record.extensionToLanguage,
      context,
    );
    this._args = this.validateArgs(record.args, context);
    this._env = this.validateEnv(record.env, context);
    this._initializationOptions = record.initializationOptions;
    this._settings = record.settings;
  }

  get name(): string {
    return this._name;
  }

  get command(): string {
    return this._command;
  }

  get extensionToLanguage(): Record<string, string> {
    return this._extensionToLanguage;
  }

  get args(): string[] | undefined {
    return this._args;
  }

  get env(): Record<string, string> | undefined {
    return this._env;
  }

  get initializationOptions(): unknown {
    return this._initializationOptions;
  }

  get settings(): unknown {
    return this._settings;
  }

  private validateName(raw: unknown, context: string): string {
    if (!isNonEmptyString(raw)) {
      throw new ConfigError(
        `${context}.name`,
        "a non-empty string",
        typeof raw,
      );
    }
    return raw;
  }

  private validateCommand(raw: unknown, context: string): string {
    if (!isNonEmptyString(raw)) {
      throw new ConfigError(
        `${context}.command`,
        "a non-empty string",
        typeof raw,
      );
    }
    return raw;
  }

  private validateExtensionMap(
    raw: unknown,
    context: string,
  ): Record<string, string> {
    if (!isRecord(raw) || Object.keys(raw).length === 0) {
      throw new ConfigError(
        `${context}.extensionToLanguage`,
        "a non-empty object",
        typeof raw,
      );
    }
    const result: Record<string, string> = {};
    for (const [extension, language] of Object.entries(raw)) {
      if (!extension.startsWith(".")) {
        throw new ConfigError(
          `${context} extension "${extension}"`,
          "starting with '.'",
          "no dot prefix",
        );
      }
      if (!isNonEmptyString(language)) {
        throw new ConfigError(
          `${context} extension "${extension}"`,
          "a non-empty language",
          typeof language,
        );
      }
      result[extension] = language;
    }
    return result;
  }

  private validateArgs(
    raw: unknown,
    context: string,
  ): string[] | undefined {
    if (raw === undefined) {
      return undefined;
    }
    if (!isStringArray(raw)) {
      throw new ConfigError(`${context}.args`, "a string array", typeof raw);
    }
    return raw;
  }

  private validateEnv(
    raw: unknown,
    context: string,
  ): Record<string, string> | undefined {
    if (raw === undefined) {
      return undefined;
    }
    if (!isStringRecord(raw)) {
      throw new ConfigError(
        `${context}.env`,
        "a string record",
        typeof raw,
      );
    }
    return raw;
  }
}
```

- [ ] **Step 4: GREEN — ProxyConfig class**

`packages/lsp-proxy/src/config/ProxyConfig.ts`:

```ts
import { asArray, asRecord, ConfigError } from "../guards/index.ts";
import { ServerConfig } from "./ServerConfig.ts";

export class ProxyConfig {
  readonly servers: ServerConfig[];

  constructor(raw: unknown) {
    const record = asRecord(raw, "config root");
    const rawServers = asArray(record.servers, "config root.servers");
    if (rawServers.length === 0) {
      throw new ConfigError(
        "config root.servers",
        "a non-empty array",
        "empty array",
      );
    }
    this.servers = rawServers.map(
      (entry, index) => new ServerConfig(entry, `servers[${index}]`),
    );
    this.checkDuplicateNames();
    this.checkExtensionConflicts();
  }

  private checkDuplicateNames(): void {
    const names = new Set<string>();
    for (const server of this.servers) {
      if (names.has(server.name)) {
        throw new ConfigError(
          `servers`,
          "unique server names",
          `duplicate "${server.name}"`,
        );
      }
      names.add(server.name);
    }
  }

  private checkExtensionConflicts(): void {
    const seen = new Map<string, string>();
    for (const server of this.servers) {
      for (const [extension, language] of Object.entries(
        server.extensionToLanguage,
      )) {
        const previous = seen.get(extension);
        if (previous !== undefined && previous !== language) {
          throw new ConfigError(
            `extension ${extension}`,
            `a single language (got "${previous}" and "${language}")`,
            "conflicting mappings",
          );
        }
        seen.set(extension, language);
      }
    }
  }
}
```

- [ ] **Step 5: Update config.ts to thin re-export + parseConfig adapter**

`packages/lsp-proxy/src/config.ts` becomes:

```ts
import { ConfigError } from "./guards/index.ts";
import { ProxyConfig as ProxyConfigClass } from "./config/ProxyConfig.ts";
import { ServerConfig as ServerConfigClass } from "./config/ServerConfig.ts";

export type ServerConfig = ServerConfigClass;
export type ProxyConfig = ProxyConfigClass;

export type ParseResult =
  | { config: ProxyConfig; errors?: undefined; ok: true }
  | { config?: undefined; errors: string[]; ok: false };

export function parseConfig(raw: unknown): ParseResult {
  try {
    return { config: new ProxyConfigClass(raw), ok: true };
  } catch (error) {
    if (error instanceof ConfigError) {
      return { errors: [error.message], ok: false };
    }
    return { errors: [String(error)], ok: false };
  }
}
```

This preserves the existing `parseConfig` API so all current callers (main.ts, sync-extensions.ts, tests) continue to work — but now they get the OOP-validated classes underneath. The `ParseResult` union is now a thin adapter over ConfigError try/catch.

- [ ] **Step 6: GREEN run + battery**

Run: `cd /Users/vasilsokolik/www/cc-sdd/packages/lsp-proxy && bun test` → ALL PASS (existing config tests validate the same rules — they test `parseConfig` which now delegates to the OOP classes; the OOP tests validate the classes directly).
Run: `cd /Users/vasilsokolik/www/cc-sdd && rtk proxy biome check packages/lsp-proxy --write` → clean.
Run: `cd /Users/vasilsokolik/www/cc-sdd && bun check --strict` → 0 errors.

- [ ] **Step 7: STOP POINT — owner commits Task 4.**

---

### Task 5: Method Registry — centralize LSP method knowledge

**Files:**
- Create: `packages/lsp-proxy/src/methods/index.ts`
- Create: `packages/lsp-proxy/tests/methods.test.ts`
- Modify: `packages/lsp-proxy/src/capabilities.ts` — PROVIDER_KEYS derived from METHODS
- Modify: `packages/lsp-proxy/src/router.ts` — METHOD_CAPABILITY derived from METHODS
- Modify: `packages/lsp-proxy/src/merge.ts` — merge dispatch reads from METHODS
- Modify: `packages/lsp-proxy/src/proxy.ts` — SINGLE_RESULT_METHODS / DOC_NOTIFICATION_METHODS derived from METHODS
- Modify: `packages/lsp-proxy/src/proxy-requests.ts` — pull-trigger set derived from METHODS

**Interfaces:**
- Consumes: nothing new.
- Produces: `type MergePolicy`, `interface MethodPolicy`, `const METHODS: Record<string, MethodPolicy>`, `const METHOD_CAPABILITIES: string[]` (derived).

- [ ] **Step 1: Create methods registry**

`packages/lsp-proxy/src/methods/index.ts`:

```ts
export type MergePolicy =
  | "array"
  | "completion"
  | "hover"
  | "firstNonNull"
  | "sequential";

export interface MethodPolicy {
  readonly capability: string;
  readonly isDocumentNotification: boolean;
  readonly isSingleResult: boolean;
  readonly merge: MergePolicy;
  readonly triggersPull: boolean;
}

const NOTIFICATION_POLICY: MethodPolicy = {
  capability: "",
  isDocumentNotification: false,
  isSingleResult: false,
  merge: "firstNonNull",
  triggersPull: false,
};

export const METHODS: Record<string, MethodPolicy> = {
  "codeAction/resolve": {
    ...NOTIFICATION_POLICY,
    capability: "codeActionProvider",
    merge: "firstNonNull",
  },
  "textDocument/codeAction": {
    ...NOTIFICATION_POLICY,
    capability: "codeActionProvider",
    merge: "array",
  },
  "textDocument/completion": {
    ...NOTIFICATION_POLICY,
    capability: "completionProvider",
    merge: "completion",
  },
  "textDocument/definition": {
    ...NOTIFICATION_POLICY,
    capability: "definitionProvider",
    merge: "array",
  },
  "textDocument/didChange": {
    ...NOTIFICATION_POLICY,
    isDocumentNotification: true,
    triggersPull: true,
  },
  "textDocument/didClose": {
    ...NOTIFICATION_POLICY,
    isDocumentNotification: true,
  },
  "textDocument/didOpen": {
    ...NOTIFICATION_POLICY,
    isDocumentNotification: true,
    triggersPull: true,
  },
  "textDocument/didSave": {
    ...NOTIFICATION_POLICY,
    isDocumentNotification: true,
  },
  "textDocument/documentSymbol": {
    ...NOTIFICATION_POLICY,
    capability: "documentSymbolProvider",
    merge: "array",
  },
  "textDocument/formatting": {
    ...NOTIFICATION_POLICY,
    capability: "documentFormattingProvider",
    isSingleResult: true,
    merge: "sequential",
  },
  "textDocument/hover": {
    ...NOTIFICATION_POLICY,
    capability: "hoverProvider",
    merge: "hover",
  },
  "textDocument/rangeFormatting": {
    ...NOTIFICATION_POLICY,
    capability: "documentRangeFormattingProvider",
    isSingleResult: true,
    merge: "sequential",
  },
  "textDocument/references": {
    ...NOTIFICATION_POLICY,
    capability: "referencesProvider",
    merge: "array",
  },
};

export const METHOD_CAPABILITIES = Object.values(METHODS)
  .filter((policy) => policy.capability !== "")
  .map((policy) => policy.capability);

export const METHOD_NAMES = Object.keys(METHODS);

export function policyFor(method: string): MethodPolicy | undefined {
  return METHODS[method];
}
```

- [ ] **Step 2: Write methods tests**

`packages/lsp-proxy/tests/methods.test.ts`:

```ts
import { describe, expect, it } from "bun:test";

import { METHOD_CAPABILITIES, METHODS, policyFor } from "../src/methods/index.ts";

describe("METHODS registry", () => {
  it("every entry has a merge policy", () => {
    for (const [method, policy] of Object.entries(METHODS)) {
      expect(policy.merge).toBeDefined();
    }
  });

  it("notifications have no capability", () => {
    expect(policyFor("textDocument/didOpen")?.capability).toBe("");
  });

  it("requests have capabilities", () => {
    expect(policyFor("textDocument/hover")?.capability).toBe("hoverProvider");
  });

  it("METHOD_CAPABILITIES is derived (no manual copy)", () => {
    expect(METHOD_CAPABILITIES).toContain("hoverProvider");
    expect(METHOD_CAPABILITIES).not.toContain("");
    const unique = new Set(METHOD_CAPABILITIES);
    expect(unique.size).toBe(METHOD_CAPABILITIES.length);
  });

  it("didOpen and didChange trigger pull", () => {
    expect(policyFor("textDocument/didOpen")?.triggersPull).toBe(true);
    expect(policyFor("textDocument/didChange")?.triggersPull).toBe(true);
    expect(policyFor("textDocument/didClose")?.triggersPull).toBe(false);
  });
});
```

- [ ] **Step 3: Update capabilities.ts — PROVIDER_KEYS from registry**

In `packages/lsp-proxy/src/capabilities.ts`:
- Delete the `PROVIDER_KEYS` array
- Add: `import { METHOD_CAPABILITIES } from "./methods/index.ts";`
- Replace all `PROVIDER_KEYS` references with `METHOD_CAPABILITIES`
- Fixes D2 + closes bean cc-sdd-xxr5

- [ ] **Step 4: Update router.ts — METHOD_CAPABILITY from registry**

In `packages/lsp-proxy/src/router.ts`:
- Delete the local `METHOD_CAPABILITY` record
- Add: `import { policyFor } from "./methods/index.ts";`
- In `serversForRequest`, replace `METHOD_CAPABILITY[method]` with `policyFor(method)?.capability` (undefined for unknown methods → same behavior: return all owners)

- [ ] **Step 5: Update proxy.ts — dispatch sets from registry**

In `packages/lsp-proxy/src/proxy.ts`:
- Delete `SINGLE_RESULT_METHODS` and `DOC_NOTIFICATION_METHODS` sets
- Add: `import { policyFor } from "./methods/index.ts";`
- Replace `SINGLE_RESULT_METHODS.has(method)` with `policyFor(method)?.isSingleResult === true`
- Replace `DOC_NOTIFICATION_METHODS.has(message.method)` with `policyFor(message.method)?.isDocumentNotification === true`

- [ ] **Step 6: Update merge.ts — merge dispatch from registry**

In `packages/lsp-proxy/src/merge.ts`:
- Delete `ARRAY_MERGE_METHODS` set
- Add: `import { policyFor } from "./methods/index.ts";`
- Replace the method-dispatch if-chain with a switch on `policyFor(method)?.merge`:
  - `"completion"` → `mergeCompletion`
  - `"hover"` → `mergeHover`
  - `"array"` → `mergePlainArrays` (with codeAction special-case: if method is `textDocument/codeAction`, use `mergeTaggedArrays`)
  - `"sequential"` / `"firstNonNull"` → `firstNonNull`

- [ ] **Step 7: GREEN run + battery**

Run: `cd /Users/vasilsokolik/www/cc-sdd/packages/lsp-proxy && bun test` → ALL PASS.
Run: `cd /Users/vasilsokolik/www/cc-sdd && rtk proxy biome check packages/lsp-proxy --write` → clean.
Run: `cd /Users/vasilsokolik/www/cc-sdd && bun check --strict` → 0 errors.

- [ ] **Step 8: STOP POINT — owner commits Task 5.**

---

### Task 6: Boundary narrowing + replace all isRecord copies

**Files:**
- Create: `packages/lsp-proxy/src/boundary.ts`
- Create: `packages/lsp-proxy/tests/boundary.test.ts`
- Modify: `packages/lsp-proxy/src/config.ts` — local isRecord → import from guards
- Modify: `packages/lsp-proxy/src/capabilities.ts` — local isRecord → import from guards
- Modify: `packages/lsp-proxy/src/merge.ts` — local isRecord → import from guards
- Modify: `packages/lsp-proxy/src/sync-extensions.ts` — local isRecord → import from guards
- Modify: `packages/lsp-proxy/src/proxy-requests.ts` — local isRecord → import from guards
- Modify: `packages/lsp-proxy/src/proxy.ts` — inline null-passing guard → shared isRecord
- Modify: `packages/lsp-proxy/src/framing.ts` — isRecord check in deliverBody

**Interfaces:**
- Consumes: `isRecord` from `./guards/index.ts`.
- Produces: `uriOf(params: unknown): string`, `textDocumentOf(params: unknown): { uri: string }`, `changesOf(params: unknown): Array<{ range?: { start: unknown; end: unknown }; text: string }>`, `cancelIdOf(params: unknown): number | string | undefined`.

- [ ] **Step 1: Create boundary module**

`packages/lsp-proxy/src/boundary.ts`:

```ts
import { isRecord } from "./guards/index.ts";

export function uriOf(params: unknown): string {
  if (!isRecord(params)) {
    return "";
  }
  const textDocument = params.textDocument;
  if (isRecord(textDocument) && typeof textDocument.uri === "string") {
    return textDocument.uri;
  }
  if (typeof params.uri === "string") {
    return params.uri;
  }
  return "";
}

export function textDocumentOf(params: unknown): { uri: string } {
  return { uri: uriOf(params) };
}

export function changesOf(
  params: unknown,
): Array<{ range?: { end: unknown; start: unknown }; text: string }> {
  if (!isRecord(params) || !Array.isArray(params.contentChanges)) {
    return [];
  }
  const changes: Array<{ range?: { end: unknown; start: unknown }; text: string }> = [];
  for (const change of params.contentChanges) {
    if (isRecord(change) && typeof change.text === "string") {
      changes.push(change as { range?: { end: unknown; start: unknown }; text: string });
    }
  }
  return changes;
}

export function cancelIdOf(params: unknown): number | string | undefined {
  if (!isRecord(params)) {
    return undefined;
  }
  const { id } = params;
  if (typeof id === "number" || typeof id === "string") {
    return id;
  }
  return undefined;
}
```

- [ ] **Step 2: Write boundary tests**

`packages/lsp-proxy/tests/boundary.test.ts`:

```ts
import { describe, expect, it } from "bun:test";

import { cancelIdOf, changesOf, textDocumentOf, uriOf } from "../src/boundary.ts";

describe("uriOf", () => {
  it("extracts uri from textDocument", () => {
    expect(uriOf({ textDocument: { uri: "file:///test.ts" } })).toBe("file:///test.ts");
  });

  it("extracts uri from top-level uri field", () => {
    expect(uriOf({ uri: "file:///other.ts" })).toBe("file:///other.ts");
  });

  it("returns empty string for malformed params", () => {
    expect(uriOf(null)).toBe("");
    expect(uriOf(42)).toBe("");
    expect(uriOf({})).toBe("");
    expect(uriOf({ textDocument: { uri: 42 } })).toBe("");
  });
});

describe("changesOf", () => {
  it("extracts valid content changes", () => {
    const changes = changesOf({
      contentChanges: [{ text: "new content" }],
    });
    expect(changes).toEqual([{ text: "new content" }]);
  });

  it("returns empty array for malformed params", () => {
    expect(changesOf(null)).toEqual([]);
    expect(changesOf({})).toEqual([]);
    expect(changesOf({ contentChanges: "not array" })).toEqual([]);
  });

  it("filters out changes without text", () => {
    const changes = changesOf({
      contentChanges: [{ text: "valid" }, { noText: true }, null],
    });
    expect(changes).toEqual([{ text: "valid" }]);
  });
});

describe("cancelIdOf", () => {
  it("extracts numeric id", () => {
    expect(cancelIdOf({ id: 42 })).toBe(42);
  });

  it("extracts string id", () => {
    expect(cancelIdOf({ id: "request-1" })).toBe("request-1");
  });

  it("returns undefined for malformed", () => {
    expect(cancelIdOf(null)).toBeUndefined();
    expect(cancelIdOf({})).toBeUndefined();
    expect(cancelIdOf({ id: true })).toBeUndefined();
  });
});
```

- [ ] **Step 3: Replace all local isRecord copies with shared import**

In each of these files, delete the local `isRecord` function and add `import { isRecord } from "./guards/index.ts";`:
- `packages/lsp-proxy/src/capabilities.ts`
- `packages/lsp-proxy/src/merge.ts`
- `packages/lsp-proxy/src/sync-extensions.ts`
- `packages/lsp-proxy/src/proxy-requests.ts`

In `packages/lsp-proxy/src/config.ts` — the old `isRecord` was deleted in Task 4; if any helper still uses it, import from guards.

In `packages/lsp-proxy/src/proxy.ts` — find the INLINE variant at handleInitialize that does NOT exclude null, and replace with the shared `isRecord` (this is the T3 fix).

- [ ] **Step 4: Add isRecord check to framing.ts deliverBody**

In `packages/lsp-proxy/src/framing.ts`, in `deliverBody`:

```ts
function deliverBody(
  body: Buffer,
  onMessage: (message: JsonRpcMessage) => void,
  report: (reason: string) => void,
): void {
  const text = textDecoder.decode(body);
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed)) {
      report(`non-object body: ${text.slice(0, 60)}`);
      return;
    }
    onMessage(parsed as JsonRpcMessage);
  } catch {
    report(`unparseable body: ${text.slice(0, 60)}`);
  }
}
```

Add `import { isRecord } from "./guards/index.ts";` to framing.ts.

- [ ] **Step 5: GREEN run + battery**

Run: `cd /Users/vasilsokolik/www/cc-sdd/packages/lsp-proxy && bun test` → ALL PASS.
Run: `cd /Users/vasilsokolik/www/cc-sdd && rtk proxy biome check packages/lsp-proxy --write` → clean.
Run: `cd /Users/vasilsokolik/www/cc-sdd && bun check --strict` → 0 errors.

- [ ] **Step 6: STOP POINT — owner commits Task 6.**

---

### Task 7: Waiter sweep + request timeout (A1 — CRITICAL)

**Files:**
- Modify: `packages/lsp-proxy/src/proxy-requests.ts` — add `failAllFor(server, reason)` method; add timeout to `askOnce`
- Modify: `packages/lsp-proxy/src/proxy-server.ts` — call `broker.failAllFor` in `handleServerExit` BEFORE respawn
- Create: `packages/lsp-proxy/tests/waiter-sweep.integration.test.ts`
- Modify: `packages/lsp-proxy/src/constants/index.ts` — add REQUEST_TIMEOUT constant

**Interfaces:**
- Consumes: `LspErrorCode.InternalError` from constants (for the sweep error code).
- Produces: `RequestBroker.failAllFor(server: string, reason: string): number` (returns count of swept waiters).

- [ ] **Step 1: Add timeout constant**

In `packages/lsp-proxy/src/constants/index.ts`, add:

```ts
export const TimeoutMs = {
  initialize: 30_000,
  request: 15_000,
} as const;
```

(If TimeoutMs already exists from Task 2, just verify `request` is present.)

- [ ] **Step 2: RED — waiter sweep integration test**

`packages/lsp-proxy/tests/waiter-sweep.integration.test.ts`:

```ts
import { expect, it } from "bun:test";
import { join } from "node:path";

import {
  boot,
  responseFor,
  stub,
} from "./helpers/proxy-harness.ts";
import { waitFor } from "./helpers/wait.ts";

const TS = { ".ts": "typescript" };

it("sweep: pending hover resolves with error when server dies mid-request", async () => {
  const proxy = await boot([
    stub("fragile", { exitOnDidOpen: true }, TS),
    stub("healthy", { hover: "alive" }, TS),
  ]);
  // Open a document (kills fragile) then immediately hover
  proxy.push({
    jsonrpc: "2.0",
    method: "textDocument/didOpen",
    params: {
      textDocument: { languageId: "typescript", text: "const x = 1;\n", uri: "file:///proj/s.ts" },
    },
  });
  proxy.push({
    id: 2,
    jsonrpc: "2.0",
    method: "textDocument/hover",
    params: { textDocument: { uri: "file:///proj/s.ts" } },
  });
  // The fragile server will die; its pending hover must resolve (not hang)
  await waitFor(() => proxy.clientMessages.some((message) => message.id === 2));
  const response = responseFor(proxy, 2);
  // Either merged from healthy only (fragile's sweep resolved as error),
  // or an error reply — but NOT a hang
  expect(response).toBeDefined();
  await proxy.stop();
}, 20_000);
```

- [ ] **Step 3: GREEN — implement failAllFor + wire to handleServerExit**

In `packages/lsp-proxy/src/proxy-requests.ts`, add to `RequestBroker`:

```ts
import { LspErrorCode, TimeoutMs } from "./constants/index.ts";

export class RequestBroker {
  // ... existing code ...

  failAllFor(server: string, reason: string): number {
    let swept = 0;
    const prefix = `${server}:`;
    for (const [key, waiter] of this.waiters) {
      if (key.startsWith(prefix)) {
        this.waiters.delete(key);
        const serverId = Number(key.slice(prefix.length));
        const entry = this.mux.lookup(server, serverId);
        if (entry !== undefined) {
          this.mux.release(entry);
        }
        waiter.resolve({
          error: {
            code: LspErrorCode.InternalError,
            message: `server ${server} died: ${reason}`,
          },
          server,
        });
        swept += 1;
      }
    }
    return swept;
  }

  private async askOnce(
    message: JsonRpcMessage,
    method: string,
    downstream: Downstream,
  ): Promise<ServerOutcome> {
    const clientId = message.id ?? 0;
    const serverId = this.mux.assign(clientId, downstream.name, method);
    const outcome = new Promise<ServerOutcome>((resolve) => {
      this.waiters.set(`${downstream.name}:${serverId}`, { resolve });
    });
    downstream.send({
      id: serverId,
      jsonrpc: "2.0",
      method,
      params: message.params,
    });
    return Promise.race([
      outcome,
      new Promise<ServerOutcome>((resolve) => {
        setTimeout(() => {
          const waiterKey = `${downstream.name}:${serverId}`;
          const pending = this.waiters.get(waiterKey);
          if (pending !== undefined) {
            this.waiters.delete(waiterKey);
            const entry = this.mux.lookup(downstream.name, serverId);
            if (entry !== undefined) {
              this.mux.release(entry);
            }
            resolve({
              error: {
                code: LspErrorCode.InternalError,
                message: `request timeout after ${String(TimeoutMs.request)}ms`,
              },
              server: downstream.name,
            });
          }
        }, TimeoutMs.request);
      }),
    ]);
  }
}
```

In `packages/lsp-proxy/src/proxy-server.ts`, in `handleServerExit`, add BEFORE the respawn logic:

```ts
const swept = this.host.broker.failAllFor(server, `exit code ${String(code)}`);
if (swept > 0) {
  this.host.log(`swept ${String(swept)} pending requests for ${server}`);
}
```

- [ ] **Step 4: GREEN run + battery**

Run: `cd /Users/vasilsokolik/www/cc-sdd/packages/lsp-proxy && bun test` → ALL PASS (existing tests unaffected — timeout is 15s, tests complete in <2s).
Run: `cd /Users/vasilsokolik/www/cc-sdd && rtk proxy biome check packages/lsp-proxy --write` → clean.
Run: `cd /Users/vasilsokolik/www/cc-sdd && bun check --strict` → 0 errors.

- [ ] **Step 5: STOP POINT — owner commits Task 7.**

---

### Task 8: Exception isolation + initialize failure reply (A2 + A5)

**Files:**
- Modify: `packages/lsp-proxy/src/proxy.ts` — try/catch per dispatch in `run()`; try/catch in `handleInitialize`
- Modify: `packages/lsp-proxy/src/downstream.ts` — try/catch per message in `readLoop()`

**Interfaces:**
- Consumes: nothing new.
- Produces: no API changes — internal robustness only.

- [ ] **Step 1: Exception isolation in client read loop**

In `packages/lsp-proxy/src/proxy.ts`, in `run()`:

```ts
async run(): Promise<void> {
  const decode = createDecoder(
    (message) => {
      try {
        this.onClientMessage(message);
      } catch (error) {
        this.log(`client message dispatch error: ${String(error)}`);
      }
    },
    (reason) => this.log(`client stream: ${reason}`),
  );
  // ... rest unchanged
}
```

The key change: `onClientMessage` is wrapped in try/catch INSIDE the decode callback, so a throw from a handler doesn't exit the for-await loop.

- [ ] **Step 2: Exception isolation in server read loop**

In `packages/lsp-proxy/src/downstream.ts`, in `readLoop()`:

```ts
private async readLoop(child: Bun.Subprocess<"pipe", "pipe", "inherit">): Promise<void> {
  const decode = createDecoder(
    (message) => {
      try {
        this.handlers.onMessage(message);
      } catch (error) {
        console.error(`[${this.name}] message dispatch error: ${String(error)}`);
      }
    },
    (reason) => console.error(`[${this.name}] stream: ${reason}`),
  );
  for await (const chunk of child.stdout) {
    decode(chunk);
  }
}
```

- [ ] **Step 3: Initialize failure reply**

In `packages/lsp-proxy/src/proxy.ts`, in `handleInitialize`:

```ts
private async handleInitialize(message: JsonRpcMessage): Promise<void> {
  // ... params extraction unchanged ...
  try {
    await Promise.all(
      this.config.servers.map((serverConfig) =>
        this.serverSide.startServer(serverConfig, forwarded),
      ),
    );
  } catch (error) {
    this.log(`initialize failed: ${String(error)}`);
    this.replyErrorTo(
      message.id ?? null,
      LspErrorCode.InternalError,
      `failed to start servers: ${String(error)}`,
    );
    return;
  }
  // ... capability merge + reply unchanged ...
}
```

Import `LspErrorCode` from `./constants/index.ts`.

- [ ] **Step 4: GREEN run + battery**

Run: `cd /Users/vasilsokolik/www/cc-sdd/packages/lsp-proxy && bun test` → ALL PASS.
Run: `cd /Users/vasilsokolik/www/cc-sdd && rtk proxy biome check packages/lsp-proxy --write` → clean.
Run: `cd /Users/vasilsokolik/www/cc-sdd && bun check --strict` → 0 errors.

- [ ] **Step 5: STOP POINT — owner commits Task 8.**

---

### Task 9: Architecture cleanup — exit, mux, dead code, exports

**Files:**
- Modify: `packages/lsp-proxy/src/proxy.ts` — `cascadeShutdown` resolves (no process.exit); version from constants
- Modify: `packages/lsp-proxy/src/main.ts` — owns process.exit + closeLog
- Modify: `packages/lsp-proxy/src/mux.ts` — fix byClient overwrite; use symbol for pseudo-id
- Modify: `packages/lsp-proxy/src/downstream.ts` — delete abort() + AbortController; guard send on liveness
- Modify: `packages/lsp-proxy/src/merge.ts` — unexport tagCodeAction (in-file only)
- Modify: `packages/lsp-proxy/src/capabilities.ts` — unexport CapabilitiesInput/CapabilitiesMerge (in-file only)
- Modify: `packages/lsp-proxy/src/proxy-requests.ts` — privatize mux/waiters; error.data passthrough

**Interfaces:**
- Consumes: `LspErrorCode` from constants.
- Produces: `RequestBroker.mux` and `.waiters` become private (breaking change for any code reaching in — none does, grep-verified).

- [ ] **Step 1: cascadeShutdown → resolve (no exit)**

In `packages/lsp-proxy/src/proxy.ts`:

```ts
async cascadeShutdown(reason: string): Promise<void> {
  if (this.phase === "stopped") {
    return;
  }
  this.phase = "stopped";
  this.log(`shutting down: ${reason}`);
  const stragglers = [...this.servers.values()];
  for (const downstream of stragglers) {
    downstream.send({
      id: this.serverSide.nextId(),
      jsonrpc: "2.0",
      method: "shutdown",
    });
    downstream.kill("SIGTERM");
  }
  this.servers.clear();
  const allExited = Promise.all(
    stragglers.map((downstream) => downstream.exited()),
  ).catch(() => -1);
  const escalation = new Promise<void>((resolve) => {
    setTimeout(() => {
      for (const downstream of stragglers) {
        downstream.kill("SIGKILL");
      }
      resolve();
    }, 2000);
  });
  await Promise.race([allExited, escalation]);
}
```

Key change: `process.exit(0)` is REMOVED — the method resolves. In `main.ts`:

```ts
// At the end of the IIFE:
await proxy.run();
// run() ends when stdin closes → cascadeShutdown was called → servers reaped
closeLog();
process.exit(0);
```

And in the catch:
```ts
})().catch(async (error: unknown) => {
  log(`fatal: ${String(error)}`);
  closeLog();
  process.exit(1);
});
```

- [ ] **Step 2: Fix mux byClient + pseudo-id**

In `packages/lsp-proxy/src/mux.ts`:
- Change `byClient` from `Map<number | string, Map<string, number>>` to `Map<number | string, Map<number, number>>` — keyed by serverId (the numeric id), not server name. This means concurrent requests to the same server from the same client each get their own entry.
- Update `release()` to delete by `entry.serverId`
- In `proxy-requests.ts`, replace pseudo-clientId `0` with a module-level `const PSEUDO_CLIENT_ID = -1` (impossible for a JSON-RPC client to send — ids are non-negative in practice, and -1 is clearly internal).

- [ ] **Step 3: Delete dead code**

In `packages/lsp-proxy/src/downstream.ts`:
- Delete the `abort()` method
- Delete `private readonly controller = new AbortController();`
- Delete `signal: this.controller.signal` from the spawn options
- Add liveness guard to `send()`:

```ts
send(message: JsonRpcMessage): void {
  const child = this.child;
  if (child === undefined || child.exitCode !== null) {
    return;
  }
  child.stdin.write(encodeFrame(message));
  child.stdin.flush();
}
```

- Clear `this.child = undefined` in the `onExit` callback.

- [ ] **Step 4: Privatize + unexport**

In `packages/lsp-proxy/src/proxy-requests.ts`:
- Change `mux = new RequestMux();` to `private readonly mux = new RequestMux();`
- Change `waiters = new Map<string, Waiter>();` to `private readonly waiters = new Map<string, Waiter>();`
- Add `failAllFor` as a public method (needed by proxy-server for A1 sweep)

In `packages/lsp-proxy/src/merge.ts`:
- Change `export function tagCodeAction` to `function tagCodeAction` (remove export, in-file only)

In `packages/lsp-proxy/src/capabilities.ts`:
- Remove `export` from `CapabilitiesInput` and `CapabilitiesMerge` interfaces (in-file only)

In `packages/lsp-proxy/src/mux.ts`:
- Remove `export` from `PendingEntry` interface (grep-verified: no external importers)

- [ ] **Step 5: Error.data passthrough (C3)**

In `packages/lsp-proxy/src/proxy-requests.ts`, in `askAllAndMerge`:

```ts
if (merged.error !== undefined) {
  this.host.replyErrorTo(
    message.id ?? null,
    merged.error.code,
    merged.error.message,
    merged.error.data,
  );
  return;
}
```

Update `RequestHost.replyErrorTo` signature to accept optional `data`:

```ts
replyErrorTo: (
  id: number | string | null,
  code: number,
  message: string,
  data?: unknown,
) => void;
```

And in `proxy.ts` `replyErrorTo`:

```ts
replyErrorTo(
  id: number | string | null,
  code: number,
  message: string,
  data?: unknown,
): void {
  const error: JsonRpcError = data !== undefined ? { code, data, message } : { code, message };
  this.write({ error, id, jsonrpc: "2.0" });
}
```

- [ ] **Step 6: GREEN run + full battery**

Run: `cd /Users/vasilsokolik/www/cc-sdd/packages/lsp-proxy && bun test` → ALL PASS.
Run: `cd /Users/vasilsokolik/www/cc-sdd && rtk proxy biome check packages/lsp-proxy --write` → clean.
Run: `cd /Users/vasilsokolik/www/cc-sdd && bun check --strict` → 0 errors.
Run: `cd /Users/vasilsokolik/www/cc-sdd/packages/lsp-proxy && bun run build-bin` → success.

- [ ] **Step 7: STOP POINT — owner commits Task 9.**

---

### Task 10: Final cleanup — C5, C6, C7, C10 + integration smoke

**Files:**
- Modify: `packages/lsp-proxy/src/proxy-server.ts` — reset deaths counter after stable interval (C5); single partition for reportsIncremental (C7, if still needed after Task 5)
- Modify: `packages/lsp-proxy/src/proxy-requests.ts` — askSequentially as plain loop, no Promise.resolve() noise (C6)
- Modify: `packages/lsp-proxy/src/downstream.ts` — inject logger (C10)
- Modify: `packages/lsp-proxy/src/logger.ts` — add version constant (D7)

**Interfaces:**
- Consumes: everything from prior tasks.
- Produces: final production-quality state; no API changes.

- [ ] **Step 1: Deaths counter with stability reset (C5)**

In `packages/lsp-proxy/src/proxy-server.ts`:

```ts
private readonly deaths = new Map<string, { count: number; timestamp: number }>();
private static readonly DEATH_RESET_MS = 60_000;

private getDeathCount(server: string): number {
  const record = this.deaths.get(server);
  if (record === undefined) {
    return 0;
  }
  if (Date.now() - record.timestamp > ServerSide.DEATH_RESET_MS) {
    this.deaths.delete(server);
    return 0;
  }
  return record.count;
}

private recordDeath(server: string): void {
  const count = this.getDeathCount(server) + 1;
  this.deaths.set(server, { count, timestamp: Date.now() });
}
```

- [ ] **Step 2: askSequentially as plain loop (C6)**

```ts
async askSequentially(
  message: JsonRpcMessage,
  method: string,
  recipients: Downstream[],
): Promise<void> {
  for (const downstream of recipients) {
    const outcome = await this.askOnce(message, method, downstream);
    if (
      outcome.error === undefined &&
      outcome.result !== null &&
      outcome.result !== undefined
    ) {
      this.host.replyTo(message.id ?? null, outcome.result);
      return;
    }
  }
  this.host.replyTo(message.id ?? null, null);
}
```

- [ ] **Step 3: Inject logger into Downstream (C10)**

In `packages/lsp-proxy/src/downstream.ts`:

```ts
export interface DownstreamOptions {
  log?: (line: string) => void;
}

export class Downstream {
  private readonly log: (line: string) => void;

  constructor(
    config: ServerConfig,
    handlers: DownstreamHandlers,
    options?: DownstreamOptions,
  ) {
    // ...
    this.log = options?.log ?? ((line) => console.error(line));
  }
}
```

Replace all `console.error` calls in Downstream with `this.log`.

In `packages/lsp-proxy/src/proxy-server.ts` where Downstream is constructed, pass `{ log: (line) => this.host.log(line) }`.

- [ ] **Step 4: Version constant (D7)**

In `packages/lsp-proxy/src/constants/index.ts`:

```ts
export const VERSION = "0.1.0";
```

In `proxy.ts` and `main.ts`, replace the hardcoded `"0.1.0"` with `import { VERSION } from "./constants/index.ts";`.

- [ ] **Step 5: Full battery + live smoke**

Run all gates:
- `cd /Users/vasilsokolik/www/cc-sdd && bun test` → ALL PASS
- `rtk proxy biome check .` → repo clean
- `bun check --strict` → 0 errors
- `cd packages/lsp-proxy && bun run build-bin` → success

Live smoke: owner reloads plugin, opens a .ts file with biome + TS errors, verifies both diagnostic sources still arrive.

- [ ] **Step 6: STOP POINT — owner commits Task 10 (final).**

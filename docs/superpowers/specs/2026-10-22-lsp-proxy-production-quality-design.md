# lsp-proxy production quality — design

Date: 2026-10-22 · Status: self-reviewed (spec review passed) · Bean: TBD
Branch: TBD (new branch from current feature/lsp-proxy state) · Package: `packages/lsp-proxy/`

## 1. Context and problem

The lsp-proxy POC (epic cc-sdd-hi1x) is functionally complete and live-tested — fan-out,
push+pull diagnostics bridge, auto-detection, all 13 tasks approved. A production-quality
audit (opus, 2026-10-22) found **41 findings: 1 critical, 12 important, 28 minor** —
the code works but is not production-ready. The full audit is at
`.superpowers/sdd/2026-10-20-lsp-proxy-poc/production-quality-audit.md`.

The three clusters:
- **Liveness** (A1/A2/A5): server death leaks pending requests forever; one bad message kills
  a stream loop; spawn failure never reaches the client.
- **Type safety** (T1/T2/T3): validation disconnected from types at every process boundary —
  blind casts, `isRecord` duplicated 5× (6th copy drifted: passes `null`), `toServerConfig`
  casts `args: [1,2]` to `string[]` without checking elements.
- **DRY** (D1-D4): `isRecord` ×5+1, `PROVIDER_KEYS` vs `METHOD_CAPABILITY`, pending-request
  lifecycle hand-rolled 4×, LSP method knowledge scattered across 6 files.

## 2. Goal

Transform the POC into production-quality code in a single cycle: fix all critical and
important findings, consolidate DRY violations, establish type-safe boundaries — while
preserving all 70+ green tests and the live-tested behavior.

## 3. Owner decisions (binding)

| # | Decision |
|---|---|
| P1 | Scope: EVERYTHING in one cycle (liveness + type safety + DRY + architecture + minors). |
| P2 | Config parsing: OOP classes with validating setters — fail-fast on first invalid field, zero casts, `ConfigError` for typed config failures. |
| P3 | Shared code organization: expanded structure — `guards/`, `types/`, `constants/`, `utils/` directories, each with `index.ts`. |
| P4 | Plan structure: single spec + single implementation plan. |

## 4. Architecture

### 4.1 Shared infrastructure (Phase 1)

```
packages/lsp-proxy/src/
├── guards/           ← type predicates with narrowing
│   └── index.ts
├── types/            ← shared type definitions
│   └── index.ts
├── constants/        ← LSP error codes, sync kinds, timeouts
│   └── index.ts
└── utils/            ← shared utilities
    └── index.ts
```

**guards/** — each predicate narrows `unknown` to a specific type:
- `isRecord(value): value is Record<string, unknown>` — excludes null, arrays
- `isNonEmptyString(value): value is string`
- `isStringArray(value): value is string[]` — validates EACH element
- `isStringRecord(value): value is Record<string, string>` — validates EACH value
- `asRecord(value, context): Record<string, unknown>` — throws ConfigError if not record
- `asArray(value, context): unknown[]` — throws ConfigError if not array

Fixes D1 (five copies + one drifted null-passing variant → one shared definition).

**types/** — shared types that multiple modules need:
- `JsonRpcMessage` moves from framing.ts (framing becomes a pure codec)
- `ServerCapabilities` moves from router.ts
- New: `LspErrorCode` type

**constants/**:
- `LspErrorCode` enum-like object: `MethodNotFound: -32601`, `InternalError: -32603`, etc
- `SyncKind`: `Incremental: 2`
- `TimeoutMs`: `initialize: 30_000`, `request: 15_000`

Fixes C1 (magic numbers), C2 (bare literals).

**utils/**:
- `sortByPriority<T>(list, priority)` — one implementation, missing-names-sort-last semantics
  (fixes D5: merge.ts and capabilities.ts had divergent missing-name behavior)
- `coerceResponseId(id)` — safe numeric-id extraction (fixes C8)

### 4.2 OOP Config (Phase 2a)

`ServerConfig` class with validating setters. Each setter narrows `unknown` to the typed
field using guards, throwing `ConfigError` (custom, not generic Error) on the first invalid
value. The constructor accepts raw JSON and calls all setters in sequence.

```ts
export class ServerConfig {
  constructor(raw: unknown) {
    const record = asRecord(raw, "servers[] entry");
    this.name = record.name;
    this.command = record.command;
    this.extensionToLanguage = record.extensionToLanguage;
    this.args = record.args;       // stringArray validates each element
    this.env = record.env;         // stringRecord validates each value
    this.initializationOptions = record.initializationOptions;
    this.settings = record.settings;
  }

  set name(raw: unknown) {
    this._name = isNonEmptyString(raw) ? raw : throwConfigError("name", raw);
  }

  set args(raw: unknown) {
    this._args = raw === undefined ? undefined : stringArray(raw, "args");
  }

  // ... each field: validate → assign, zero casts
}

export class ProxyConfig {
  readonly servers: ServerConfig[];

  constructor(raw: unknown) {
    const record = asRecord(raw, "config root");
    const rawServers = asArray(record.servers, "servers");
    if (rawServers.length === 0) throw new ConfigError("servers must not be empty");
    this.servers = rawServers.map((entry) => new ServerConfig(entry));
    this.checkExtensionConflicts();
    this.checkDuplicateNames();
  }
}
```

Fixes T1 (blind cast, args: [1,2] passes, silent field drop), D9 (duplicate shape validation),
C9 (misnomer — checkExtensionConflicts, not checkLanguageConflicts).

`ConfigError` carries structured context: `{ field: "servers[0].args[0]", expected: "string",
got: "number" }` — so error messages are actionable without a debugger.

### 4.3 Method Registry (Phase 2b)

One module declaring per-method policy — the single source of truth for how the proxy
treats each LSP method. All consumers (proxy.ts dispatcher, merge.ts, capabilities.ts,
broker pull-trigger) read from here.

```ts
export type MergePolicy = "array" | "completion" | "hover" | "firstNonNull" | "sequential";

export interface MethodPolicy {
  readonly capability: string;               // "hoverProvider" — for router + capabilities
  readonly merge: MergePolicy;               // for merge.ts
  readonly isSingleResult: boolean;          // for proxy.ts sequential-ask
  readonly isDocumentNotification: boolean;  // for proxy.ts doc-routing
  readonly triggersPull: boolean;            // for pull bridge
}

export const METHODS: Record<string, MethodPolicy> = { ... };

// Derived — no independent copies possible
export const METHOD_CAPABILITIES = Object.values(METHODS)
  .filter((policy) => policy.capability !== "")
  .map((policy) => policy.capability);
```

Fixes D2 (PROVIDER_KEYS derived, not duplicated), D4 (method knowledge centralized),
A6 (broker no longer knows which methods trigger pulls — the caller decides via registry),
A7 (dead router entry for codeAction/resolve removed).

### 4.4 Type-safe client boundary (Phase 2c)

Parse-and-narrow helpers at the proxy's client-message boundary:

```ts
// src/boundary.ts — narrowing helpers
export function uriOf(params: unknown): string;
export function textDocumentOf(params: unknown): { uri: string; languageId?: string; text?: string };
export function changesOf(params: unknown): ContentChange[];
export function cancelIdOf(params: unknown): number | string | undefined;
```

Each returns a typed value with safe fallbacks (empty string, empty array, undefined) —
malformed messages degrade gracefully instead of causing TypeErrors deep in docstore or merge.

In `framing.ts` `deliverBody`: check `isRecord(parsed)` before the cast (T2's framing.ts
finding — `JSON.parse("3")` currently yields `3` cast to `JsonRpcMessage`).

In `proxy.ts` `handleInitialize`: use shared `isRecord` (fixes T3 — null-passing variant).

Fixes T2 (cast-never-narrowed at every boundary), T3 (null passes the inline guard).

### 4.5 Liveness (Phase 3a)

**A1 — Waiter Sweep**: `RequestBroker.failAllFor(server, reason)` resolves all pending
waiters for that server with a synthetic error outcome. Called from `handleServerExit`
BEFORE respawn.

**Request Timeout**: each `broker.request` wraps the promise in `Promise.race` with a
configurable timeout (15s default). Timed-out requests resolve with a timeout error —
the client gets an answer, not a hang.

**A2 — Exception Isolation**: both read loops (client stdin in `proxy.ts` `run()`,
server stdout in `downstream.ts` `readLoop()`) wrap each message dispatch in try/catch
that logs and continues. Handler exceptions become data errors, not stream terminators.

**A5 — Initialize Failure Reply**: `handleInitialize` wraps the spawn-parallel in try/catch;
on failure, replies a JSON-RPC error to the initialize request instead of leaving the
client hanging.

### 4.6 Architecture cleanup (Phase 3b)

- **A4**: `cascadeShutdown` resolves when servers are reaped; `process.exit(0)` moves to
  `main.ts` (which also closes the log — fixes the `closeLog` gap)
- **A3**: `mux.byClient` keys by `serverId` (not server name) — concurrent requests from
  same client don't overwrite; pseudo-clientId `0` replaced with a reserved symbol
- **A8**: delete `Downstream.abort()` and its `AbortController` (zero callers, grep-verified)
- **A9**: unexport unused types (`PendingEntry`, `tagCodeAction`, `ExtensionMap`,
  `CapabilitiesInput`, `CapabilitiesMerge`); privatize `broker.mux` and `broker.waiters`
- **A10**: shrink `ProxyHost` and `RequestHost` interfaces
- **A12**: `Downstream.send` guards on child liveness; clear `child` on exit
- **C3**: forward `error.data` on error passthrough
- **C5**: reset deaths counter after stable interval (or document as lifetime cap)
- **C6**: `askSequentially` — plain loop, remove `Promise.resolve()` noise
- **C7**: single partition for `reportsIncremental` (not computed twice)
- **C10**: inject logger into Downstream (no more `console.error` bypassing the log file)

## 5. Non-goals

- No behavioral changes to the proxy's external contract (same CLI, same .lsp.json, same
  config schema, same fan-out semantics)
- No new dependencies
- No changes to plugins/ or packages/bin-builder/
- Minor items C4 (dirname), C8 (coerceResponseId NaN), C11 (stub leniency), C12 (docstore
  O(n·k)) are deferred unless trivially fixable during Phase 3

## 6. Verification

1. `bun test` — all existing tests stay green (behavior unchanged)
2. New tests: waiter-sweep on server death; request timeout; exception isolation (bad
   message doesn't kill loop); OOP config validation (args: [1,2] rejected)
3. `rtk proxy biome check .` — repo clean
4. `bun check --strict` — no type errors
5. `bun run build-bin` — binary builds
6. Live test: Claude Code reload → dual diagnostics still work

## 7. Remediation order (task dependency)

```
Phase 1: guards/ + types/ + constants/ + utils/     (foundation)
Phase 2a: OOP config classes                        (uses guards)
Phase 2b: method registry                           (uses types)
Phase 2c: boundary narrowing helpers                (uses guards)
Phase 3a: liveness (sweep, timeout, isolation, init-reply)  (uses registry + types)
Phase 3b: architecture cleanup                      (uses everything)
```

# LSP proxy POC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A stdio LSP proxy in Bun, registered once in Claude Code, fanning out to N downstream stdio LSP servers (vtsls + biome), merging results per shape, with a shared binary-builder package and a generated `.lsp.json` extension map.

**Architecture:** Modular merge-proxy (pure modules first, I/O last), eager spawn at `initialize`, parse-everything, id multiplexing, per-shape merge engine, downstream supervisor with respawn+replay. Full detail in the spec.

**Tech Stack:** Bun runtime (`Bun.stdin`/`Bun.stdout`, `Bun.spawn`, `bun:test`), hand-rolled JSON-RPC Content-Length framing, `vscode-languageserver-types` (already installed) for protocol types, `node:util` `parseArgs` for CLIs.

**Spec:** `docs/superpowers/specs/2026-10-20-lsp-proxy-poc-design.md` — the binding authority; decisions D1–D10.

## Global Constraints

- Spec D1–D10 bind every task; conflicts resolve against the spec.
- TDD mandatory (D8): every implementation step is preceded by its failing test in the same task. No impl-first steps.
- The agent never writes git. Every task ends at a STOP POINT — the owner reviews and commits. No task step contains git commands.
- No dependency installs by agents. Manifest edits appear as explicit steps; `bun install` and the lockfile are owner actions (Tasks 1 and 2 stop points).
- Untouchable: `biome.json`, `.zed/`, `plugins/biome-lsp/**` (the owner disables that plugin themselves, D2).
- Style guards (biome preset "all", verified via `rtk proxy biome check`): object literals with sorted keys, inline exports with helpers-first/exports-last file order, functions ≤ 50 lines, identifiers ≥ 2 chars, no `any`. Commands must use literal paths (the filesystem PreToolUse guard blocks unresolved shell variables and command substitution).
- Per-task verification: package `bun test`, `rtk proxy biome check <touched paths>`, `bun check` (from the package or repo root as appropriate).
- All new files land in `packages/lsp-proxy/`, `packages/bin-builder/`, and `plugins/lsp-proxy/` only.
- Runtime state dir `~/.local/state/lsp-proxy/` (pidfile registry, D11) is written by the proxy and swept by `--kill-all`; it stays inside `$HOME` (allowed zone). No custom types for Bun.spawn results — use `typeof Bun.spawn` and `Bun.Subprocess<"pipe", "pipe", "inherit">` (owner directive, verified in `node_modules/.bun/bun-types@1.4.2/.../bun.d.ts`).

## Review Focus

Failure modes the spec implies but happy-path tests would miss — each pinned to the owning task:

1. **Content-Length counts bytes, not characters** (Ukrainian/CJK diagnostics text corrupts naive `.length` framing) → framing tests with multibyte bodies (Task 2).
2. **Chunk boundaries splitting a header from its body or landing mid-multibyte-character** → framing tests slicing encoded frames at every byte offset class (Task 2).
3. **Interleaved / out-of-order responses from two servers** must map back to the right client request → mux round-trip tests (Task 5) + merged-hover integration (Task 10).
4. **Incremental `didChange` text lost before a respawn replay** → docstore sequential-change tests + respawn-replay integration (Tasks 8, 10).
5. **Second death of a server must degrade, not loop** (and all-dead keeps the proxy alive) → supervisor counters + integration crash test (Tasks 9, 10).

---

### Task 1: `packages/bin-builder/` shared package + cli-hook refactor (D9)

**Files:**
- Create: `packages/bin-builder/package.json`, `packages/bin-builder/src/index.ts`, `packages/bin-builder/tests/index.test.ts`
- Modify: `packages/cli-hook/package.json` (devDependencies), `packages/cli-hook/build.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `buildBinary(options: BuildOptions, home: string, build?: BuildLike): Promise<void>`; `deriveOutfile(binName, home): string`; `toBuildConfig(options, home)`; `class BuildFailure extends Error`; `type BuildOptions = { binName: string; entrypoints: string[]; target?: string }`. Consumers (Tasks 10, 11) import from `@cc-sdd/bin-builder`.

- [ ] **Step 1: RED — failing tests for the pure builder surface**

`packages/bin-builder/tests/index.test.ts`:

```ts
import { describe, expect, it } from "bun:test";

import {
  buildBinary,
  deriveOutfile,
  toBuildConfig,
  BuildFailure,
} from "../src/index.ts";

describe("deriveOutfile", () => {
  it("places the binary in .local/bin under the given home", () => {
    expect(deriveOutfile("lsp-proxy", "/Users/tester")).toBe(
      "/Users/tester/.local/bin/lsp-proxy",
    );
  });
});

describe("toBuildConfig", () => {
  it("maps options onto the compile config", () => {
    const config = toBuildConfig(
      { binName: "demo", entrypoints: ["./src/main.ts"] },
      "/Users/tester",
    );
    expect(config.bytecode).toBe(true);
    expect(config.minify).toBe(true);
    expect(config.sourcemap).toBe("linked");
    expect(config.entrypoints).toEqual(["./src/main.ts"]);
    expect(config.compile).toMatchObject({
      autoloadBunfig: false,
      autoloadDotenv: false,
      outfile: "/Users/tester/.local/bin/demo",
      target: "bun-darwin-arm64",
    });
  });

  it("honors an explicit target", () => {
    const config = toBuildConfig(
      { binName: "demo", entrypoints: ["./x.ts"], target: "bun-linux-x64" },
      "/Users/tester",
    );
    expect(config.compile).toMatchObject({ target: "bun-linux-x64" });
  });
});

describe("buildBinary", () => {
  it("throws BuildFailure when the injected build reports failure", async () => {
    const failing = async () => ({ logs: ["boom"], success: false });
    const attempt = buildBinary(
      { binName: "demo", entrypoints: ["./x.ts"] },
      "/Users/tester",
      failing,
    );
    expect(attempt).rejects.toBeInstanceOf(BuildFailure);
  });

  it("resolves when the injected build succeeds", async () => {
    const ok = async () => ({ logs: [], success: true });
    await expect(
      buildBinary({ binName: "demo", entrypoints: ["./x.ts"] }, "/Users/tester", ok),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `cd /Users/vasilsokolik/www/cc-sdd/packages/bin-builder && bun test`
Expected: FAIL — cannot resolve `../src/index.ts` (package does not exist yet).

- [ ] **Step 3: GREEN — the builder package**

`packages/bin-builder/package.json`:

```json
{
  "exports": {
    ".": "./src/index.ts"
  },
  "name": "@cc-sdd/bin-builder",
  "private": true,
  "type": "module"
}
```

`packages/bin-builder/src/index.ts`:

```ts
const DEFAULT_TARGET = "bun-darwin-arm64";

export type BuildLike = (config: unknown) => Promise<{
  logs: unknown[];
  success: boolean;
}>;

export type BuildOptions = {
  binName: string;
  entrypoints: string[];
  target?: string;
};

export class BuildFailure extends Error {}

export function deriveOutfile(binName: string, home: string): string {
  return `${home}/.local/bin/${binName}`;
}

export function toBuildConfig(options: BuildOptions, home: string) {
  return {
    bytecode: true,
    compile: {
      autoloadBunfig: false,
      autoloadDotenv: false,
      outfile: deriveOutfile(options.binName, home),
      target: options.target ?? DEFAULT_TARGET,
    },
    entrypoints: options.entrypoints,
    minify: true,
    sourcemap: "linked",
  };
}

export async function buildBinary(
  options: BuildOptions,
  home: string,
  build: BuildLike = (Bun.build as unknown) as BuildLike,
): Promise<void> {
  const result = await build(toBuildConfig(options, home));
  if (!result.success) {
    throw new BuildFailure(`bun build failed: ${JSON.stringify(result.logs)}`);
  }
  console.info(result);
}
```

- [ ] **Step 4: Run to verify GREEN**

Run: `cd /Users/vasilsokolik/www/cc-sdd/packages/bin-builder && bun test`
Expected: PASS (4 tests).

- [ ] **Step 5: Refactor cli-hook's build.ts to the thin wrapper**

`packages/cli-hook/build.ts` (full replacement — behavior unchanged, per D9):

```ts
import { homedir } from "node:os";
import process from "node:process";

import { buildBinary } from "@cc-sdd/bin-builder";

await buildBinary(
  { binName: "claude-code-cli-hook", entrypoints: ["./src/main.ts"] },
  homedir(),
).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
```

`packages/cli-hook/package.json` — add to `devDependencies` (keep sorted):

```json
"@cc-sdd/bin-builder": "workspace:*"
```

- [ ] **Step 6: Static verification (pre-install)**

Run: `cd /Users/vasilsokolik/www/cc-sdd && rtk proxy biome check packages/bin-builder packages/cli-hook/build.ts packages/cli-hook/package.json`
Expected: clean. (`bun check` on cli-hook comes after the workspace link exists.)

- [ ] **Step 7: STOP POINT — owner actions**

Owner runs `bun install` (links `@cc-sdd/bin-builder`), then verifies `cd packages/cli-hook && bun run build-bin` still produces `~/.local/bin/claude-code-cli-hook`. Then: post-install verification `cd /Users/vasilsokolik/www/cc-sdd && bun check` (18+ files, zero errors) and full `bun test` (446+ tests, all green). Owner commits Task 1.

---

### Task 2: lsp-proxy scaffold + `framing.ts`

**Files:**
- Create: `packages/lsp-proxy/package.json`, `packages/lsp-proxy/lsp-proxy.config.json`, `packages/lsp-proxy/src/framing.ts`, `packages/lsp-proxy/tests/framing.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type JsonRpcMessage` (jsonrpc/id?/method?/params?/result?/error?), `encodeFrame(message): Uint8Array`, `createDecoder(onMessage, onError?): (chunk: Uint8Array) => void`. Used by nearly every later task.

- [ ] **Step 1: Package scaffold**

`packages/lsp-proxy/package.json`:

```json
{
  "devDependencies": {
    "@cc-sdd/bin-builder": "workspace:*"
  },
  "name": "@cc-sdd/lsp-proxy",
  "private": true,
  "scripts": {
    "build-bin": "bun build.ts",
    "sync-extensions": "bun src/sync-extensions.ts"
  },
  "type": "module"
}
```

`packages/lsp-proxy/lsp-proxy.config.json` (the default config, spec §6.3 — bare commands, verified on PATH):

```json
{
  "servers": [
    {
      "args": ["--stdio"],
      "command": "vtsls",
      "extensionToLanguage": {
        ".cjs": "javascript",
        ".js": "javascript",
        ".jsx": "javascriptreact",
        ".mjs": "javascript",
        ".ts": "typescript",
        ".tsx": "typescriptreact"
      },
      "initializationOptions": {},
      "name": "vtsls",
      "settings": {}
    },
    {
      "args": ["lsp-proxy"],
      "command": "biome",
      "extensionToLanguage": {
        ".cjs": "javascript",
        ".css": "css",
        ".js": "javascript",
        ".json": "json",
        ".jsonc": "json",
        ".jsx": "javascriptreact",
        ".mjs": "javascript",
        ".ts": "typescript",
        ".tsx": "typescriptreact"
      },
      "initializationOptions": {},
      "name": "biome",
      "settings": {}
    }
  ]
}
```

- [ ] **Step 2: RED — failing framing tests (Review Focus 1 and 2)**

`packages/lsp-proxy/tests/framing.test.ts`:

```ts
import { describe, expect, it } from "bun:test";

import { createDecoder, encodeFrame, type JsonRpcMessage } from "../src/framing.ts";

const SAMPLE: JsonRpcMessage = {
  jsonrpc: "2.0",
  method: "textDocument/publishDiagnostics",
  params: { uri: "file:///proj/тест.ts" },
};

function collect(): {
  messages: JsonRpcMessage[];
  errors: string[];
  push: (chunk: Uint8Array) => void;
} {
  const messages: JsonRpcMessage[] = [];
  const errors: string[] = [];
  const push = createDecoder(
    (message) => messages.push(message),
    (reason) => errors.push(reason),
  );
  return { errors, messages, push };
}

describe("encodeFrame + createDecoder", () => {
  it("round-trips a multibyte message", () => {
    const received = collect();
    received.push(encodeFrame(SAMPLE));
    expect(received.messages).toEqual([SAMPLE]);
    expect(received.errors).toEqual([]);
  });

  it("delivers two messages arriving in one chunk", () => {
    const received = collect();
    const first = encodeFrame(SAMPLE);
    const second = encodeFrame({ id: 7, jsonrpc: "2.0", result: null });
    const both = new Uint8Array(first.byteLength + second.byteLength);
    both.set(first);
    both.set(second, first.byteLength);
    received.push(both);
    expect(received.messages).toHaveLength(2);
  });

  it("reassembles a frame split at every kind of boundary", () => {
    const frame = encodeFrame({
      id: 1,
      jsonrpc: "2.0",
      method: "x",
      params: "текст-з-крапками",
    });
    for (const splitAt of [1, 5, 25, frame.byteLength - 3]) {
      const received = collect();
      received.push(frame.subarray(0, splitAt));
      received.push(frame.subarray(splitAt));
      expect(received.messages).toHaveLength(1);
      expect(received.errors).toEqual([]);
    }
  });

  it("reassembles a frame fed byte by byte", () => {
    const received = collect();
    const frame = encodeFrame(SAMPLE);
    for (let index = 0; index < frame.byteLength; index += 1) {
      received.push(frame.subarray(index, index + 1));
    }
    expect(received.messages).toEqual([SAMPLE]);
  });

  it("resyncs after garbage that precedes a valid frame", () => {
    const received = collect();
    const garbage = new TextEncoder().encode("not-a-header\r\njunk\r\n\r\n");
    received.push(garbage);
    received.push(encodeFrame(SAMPLE));
    expect(received.messages).toEqual([SAMPLE]);
    expect(received.errors.length).toBeGreaterThan(0);
  });

  it("survives garbage with no valid frame behind it", () => {
    const received = collect();
    received.push(new TextEncoder().encode("total garbage"));
    expect(received.messages).toEqual([]);
    expect(received.errors.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run RED**

Run: `cd /Users/vasilsokolik/www/cc-sdd/packages/lsp-proxy && bun test`
Expected: FAIL — cannot resolve `../src/framing.ts`.

- [ ] **Step 4: GREEN — framing implementation**

`packages/lsp-proxy/src/framing.ts`:

```ts
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const HEADER_SEPARATOR = textEncoder.encode("\r\n\r\n");
const CONTENT_LENGTH_MARKER = textEncoder.encode("Content-Length:");

export type JsonRpcError = {
  code: number;
  message: string;
  data?: unknown;
};

export type JsonRpcMessage = {
  error?: JsonRpcError;
  id?: number | string | null;
  jsonrpc: "2.0";
  method?: string;
  params?: unknown;
  result?: unknown;
};

function indexOfSequence(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let start = 0; start <= haystack.byteLength - needle.byteLength; start += 1) {
    for (let offset = 0; offset < needle.byteLength; offset += 1) {
      if (haystack[start + offset] !== needle[offset]) {
        continue outer;
      }
    }
    return start;
  }
  return -1;
}

export function encodeFrame(message: JsonRpcMessage): Uint8Array {
  const body = textEncoder.encode(JSON.stringify(message));
  const header = textEncoder.encode(
    `Content-Length: ${body.byteLength}\r\n\r\n`,
  );
  const frame = new Uint8Array(header.byteLength + body.byteLength);
  frame.set(header);
  frame.set(body, header.byteLength);
  return frame;
}

export function createDecoder(
  onMessage: (message: JsonRpcMessage) => void,
  onError: (reason: string) => void = () => {},
): (chunk: Uint8Array) => void {
  let buffer = new Uint8Array(0);
  return (chunk: Uint8Array) => {
    const merged = new Uint8Array(buffer.byteLength + chunk.byteLength);
    merged.set(buffer);
    merged.set(chunk, buffer.byteLength);
    buffer = merged;
    for (;;) {
      const headerEnd = indexOfSequence(buffer, HEADER_SEPARATOR);
      if (headerEnd === -1) {
        return;
      }
      const headerText = textDecoder.decode(buffer.subarray(0, headerEnd));
      const match = /Content-Length:\s*(\d+)/i.exec(headerText);
      if (match === null) {
        onError(`malformed header: ${headerText.slice(0, 60)}`);
        const marker = indexOfSequence(buffer, CONTENT_LENGTH_MARKER);
        buffer = marker === -1 ? new Uint8Array(0) : buffer.subarray(marker);
        continue;
      }
      const bodyStart = headerEnd + HEADER_SEPARATOR.byteLength;
      const bodyEnd = bodyStart + Number(match[1]);
      if (buffer.byteLength < bodyEnd) {
        return;
      }
      const body = textDecoder.decode(buffer.subarray(bodyStart, bodyEnd));
      try {
        onMessage(JSON.parse(body) as JsonRpcMessage);
      } catch {
        onError(`unparseable body: ${body.slice(0, 60)}`);
      }
      buffer = buffer.subarray(bodyEnd);
    }
  };
}
```

- [ ] **Step 5: GREEN run + static battery**

Run: `cd /Users/vasilsokolik/www/cc-sdd/packages/lsp-proxy && bun test` → PASS (6 tests).
Run: `cd /Users/vasilsokolik/www/cc-sdd && rtk proxy biome check packages/lsp-proxy packages/bin-builder` → clean.
Run: `cd /Users/vasilsokolik/www/cc-sdd && bun check` → no type errors (lsp-proxy package now linked; if the workspace link is missing, this moves to the owner-install step below).

- [ ] **Step 6: STOP POINT — owner actions**

Owner runs `bun install` (links `@cc-sdd/lsp-proxy`, records its bin-builder devDependency), reviews, commits Task 2.

---

### Task 3: `config.ts`

**Files:**
- Create: `packages/lsp-proxy/src/config.ts`, `packages/lsp-proxy/tests/config.test.ts`

**Interfaces:**
- Consumes: none.
- Produces: `type ServerConfig`, `type ProxyConfig`, `type ParseResult = { ok: true; config: ProxyConfig } | { ok: false; errors: string[] }`, `parseConfig(raw: unknown): ParseResult`.

- [ ] **Step 1: RED — failing config tests (incl. the Review-Focus conflict rule)**

`packages/lsp-proxy/tests/config.test.ts`:

```ts
import { describe, expect, it } from "bun:test";

import { parseConfig } from "../src/config.ts";

const VALID = {
  servers: [
    {
      command: "vtsls",
      extensionToLanguage: { ".ts": "typescript" },
      name: "vtsls",
    },
  ],
};

describe("parseConfig", () => {
  it("accepts a minimal valid config and keeps optional fields", () => {
    const parsed = parseConfig({
      servers: [
        {
          args: ["--stdio"],
          command: "vtsls",
          extensionToLanguage: { ".ts": "typescript" },
          initializationOptions: { a: 1 },
          name: "vtsls",
          settings: { b: 2 },
        },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.config.servers[0].name).toBe("vtsls");
      expect(parsed.config.servers[0].args).toEqual(["--stdio"]);
    }
  });

  it("rejects non-object input", () => {
    expect(parseConfig(42).ok).toBe(false);
    expect(parseConfig("nope").ok).toBe(false);
    expect(parseConfig(null).ok).toBe(false);
  });

  it("collects every violation instead of stopping at the first", () => {
    const parsed = parseConfig({
      servers: [
        { command: "", extensionToLanguage: {}, name: "" },
        { command: "x", extensionToLanguage: { ".ts": "typescript" }, name: "a" },
        { command: "y", extensionToLanguage: { ts: "typescript" }, name: "a" },
      ],
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors.join("\n")).toContain("command");
      expect(parsed.errors.join("\n")).toContain("servers[0].name");
      expect(parsed.errors.join("\n")).toContain("duplicate");
      expect(parsed.errors.join("\n")).toContain("must start with '.'");
    }
  });

  it("rejects an extension mapped to two different languages across servers", () => {
    const parsed = parseConfig({
      servers: [
        { command: "a", extensionToLanguage: { ".ts": "typescript" }, name: "a" },
        { command: "b", extensionToLanguage: { ".ts": "javascript" }, name: "b" },
      ],
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors.join("\n")).toContain(".ts");
      expect(parsed.errors.join("\n")).toContain("typescript");
      expect(parsed.errors.join("\n")).toContain("javascript");
    }
  });

  it("allows the same extension mapped to the same language twice", () => {
    const parsed = parseConfig({
      servers: [
        { command: "a", extensionToLanguage: { ".ts": "typescript" }, name: "a" },
        { command: "b", extensionToLanguage: { ".ts": "typescript" }, name: "b" },
      ],
    });
    expect(parsed.ok).toBe(true);
  });

  it("rejects empty language values", () => {
    const parsed = parseConfig({
      servers: [
        { command: "a", extensionToLanguage: { ".ts": "" }, name: "a" },
      ],
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors.join("\n")).toContain("language");
    }
  });
});
```

- [ ] **Step 2: Run RED**

Run: `cd /Users/vasilsokolik/www/cc-sdd/packages/lsp-proxy && bun test`
Expected: FAIL — cannot resolve `../src/config.ts`.

- [ ] **Step 3: GREEN — config implementation**

`packages/lsp-proxy/src/config.ts`:

```ts
export type ExtensionMap = Record<string, string>;

export type ServerConfig = {
  args?: string[];
  command: string;
  env?: Record<string, string>;
  extensionToLanguage: ExtensionMap;
  initializationOptions?: unknown;
  name: string;
  settings?: unknown;
};

export type ProxyConfig = {
  servers: ServerConfig[];
};

export type ParseResult =
  | { config: ProxyConfig; errors?: undefined; ok: true }
  | { config?: undefined; errors: string[]; ok: false };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateServer(server: unknown, index: number, errors: string[]): ServerConfig | undefined {
  if (!isRecord(server)) {
    errors.push(`servers[${index}] must be an object`);
    return undefined;
  }
  const { args, command, env, extensionToLanguage, initializationOptions, name, settings } = server;
  let valid = true;
  if (typeof name !== "string" || name === "") {
    errors.push(`servers[${index}].name must be a non-empty string`);
    valid = false;
  }
  if (typeof command !== "string" || command === "") {
    errors.push(`servers[${index}].command must be a non-empty string`);
    valid = false;
  }
  if (!isRecord(extensionToLanguage) || Object.keys(extensionToLanguage).length === 0) {
    errors.push(`servers[${index}].extensionToLanguage must be a non-empty object`);
    valid = false;
  } else {
    for (const [extension, language] of Object.entries(extensionToLanguage)) {
      if (!extension.startsWith(".")) {
        errors.push(`servers[${index}] extension "${extension}" must start with '.'`);
        valid = false;
      }
      if (typeof language !== "string" || language === "") {
        errors.push(`servers[${index}] extension "${extension}" needs a non-empty language`);
        valid = false;
      }
    }
  }
  if (args !== undefined && !Array.isArray(args)) {
    errors.push(`servers[${index}].args must be an array`);
    valid = false;
  }
  if (env !== undefined && !isRecord(env)) {
    errors.push(`servers[${index}].env must be an object`);
    valid = false;
  }
  if (!valid) {
    return undefined;
  }
  const configured = server as {
    args?: string[];
    command: string;
    env?: Record<string, string>;
    extensionToLanguage: ExtensionMap;
    initializationOptions?: unknown;
    name: string;
    settings?: unknown;
  };
  return {
    args: configured.args,
    command: configured.command,
    env: configured.env,
    extensionToLanguage: configured.extensionToLanguage,
    initializationOptions: configured.initializationOptions,
    name: configured.name,
    settings: configured.settings,
  };
}

function checkLanguageConflicts(servers: ServerConfig[], errors: string[]): void {
  const seen = new Map<string, string>();
  for (const server of servers) {
    for (const [extension, language] of Object.entries(server.extensionToLanguage)) {
      const previous = seen.get(extension);
      if (previous === undefined) {
        seen.set(extension, language);
      } else if (previous !== language) {
        errors.push(
          `extension ${extension} is mapped to "${previous}" and "${language}" by different servers`,
        );
      }
    }
  }
}

export function parseConfig(raw: unknown): ParseResult {
  const errors: string[] = [];
  if (!isRecord(raw) || !Array.isArray(raw.servers) || raw.servers.length === 0) {
    return { errors: ["config must be an object with a non-empty servers array"], ok: false };
  }
  const servers: ServerConfig[] = [];
  const names = new Set<string>();
  for (const [index, entry] of raw.servers.entries()) {
    const server = validateServer(entry, index, errors);
    if (server === undefined) {
      continue;
    }
    if (names.has(server.name)) {
      errors.push(`duplicate server name "${server.name}"`);
      continue;
    }
    names.add(server.name);
    servers.push(server);
  }
  checkLanguageConflicts(servers, errors);
  if (errors.length > 0) {
    return { errors, ok: false };
  }
  return { config: { servers }, ok: true };
}
```

- [ ] **Step 4: GREEN run + battery**

Run: `cd /Users/vasilsokolik/www/cc-sdd/packages/lsp-proxy && bun test` → PASS (6 tests).
Run: `cd /Users/vasilsokolik/www/cc-sdd && rtk proxy biome check packages/lsp-proxy` → clean; `bun check` → clean.

- [ ] **Step 5: STOP POINT — owner commits Task 3.**

---

### Task 4: `router.ts`

**Files:**
- Create: `packages/lsp-proxy/src/router.ts`, `packages/lsp-proxy/tests/router.test.ts`

**Interfaces:**
- Consumes: `ServerConfig`, `ProxyConfig` from `./config.ts`.
- Produces: `type ServerCapabilities = Record<string, unknown>`, `METHOD_CAPABILITY: Record<string, string>`, `extensionOf(uri): string | undefined`, `serversForDocument(config, uri): ServerConfig[]`, `serversForRequest(config, capabilities, uri, method): ServerConfig[]`.

- [ ] **Step 1: RED — failing router tests**

`packages/lsp-proxy/tests/router.test.ts`:

```ts
import { describe, expect, it } from "bun:test";

import type { ProxyConfig, ServerConfig } from "../src/config.ts";
import { extensionOf, serversForDocument, serversForRequest } from "../src/router.ts";

const vtsls: ServerConfig = {
  command: "vtsls",
  extensionToLanguage: { ".ts": "typescript" },
  name: "vtsls",
};
const biome: ServerConfig = {
  command: "biome",
  extensionToLanguage: { ".css": "css", ".ts": "typescript" },
  name: "biome",
};
const config: ProxyConfig = { servers: [vtsls, biome] };

describe("extensionOf", () => {
  it("extracts the lowercase extension with the dot", () => {
    expect(extensionOf("file:///proj/Main.TS")).toBe(".ts");
    expect(extensionOf("file:///proj/x.css")).toBe(".css");
  });

  it("ignores query strings and dotfiles", () => {
    expect(extensionOf("file:///proj/x.ts?raw=1")).toBe(".ts");
    expect(extensionOf("file:///proj/.gitignore")).toBeUndefined();
  });
});

describe("serversForDocument", () => {
  it("returns only servers whose map contains the extension, in priority order", () => {
    const names = serversForDocument(config, "file:///p/a.ts").map((entry) => entry.name);
    expect(names).toEqual(["vtsls", "biome"]);
  });

  it("returns an empty array for unmatched extensions", () => {
    expect(serversForDocument(config, "file:///p/a.py")).toEqual([]);
  });
});

describe("serversForRequest", () => {
  const capabilities = new Map<string, Record<string, unknown>>([
    ["vtsls", { hoverProvider: true }],
    ["biome", { documentFormattingProvider: true }],
  ]);

  it("filters by declared capability", () => {
    const names = serversForRequest(
      config,
      capabilities,
      "file:///p/a.ts",
      "textDocument/hover",
    ).map((entry) => entry.name);
    expect(names).toEqual(["vtsls"]);
  });

  it("returns all extension owners for unknown methods", () => {
    const names = serversForRequest(
      config,
      capabilities,
      "file:///p/a.ts",
      "workspace/unknownThing",
    ).map((entry) => entry.name);
    expect(names).toEqual(["vtsls", "biome"]);
  });
});
```

- [ ] **Step 2: Run RED**

Run: `cd /Users/vasilsokolik/www/cc-sdd/packages/lsp-proxy && bun test` → FAIL (module missing).

- [ ] **Step 3: GREEN — router implementation**

`packages/lsp-proxy/src/router.ts`:

```ts
import type { ProxyConfig, ServerConfig } from "./config.ts";

export type ServerCapabilities = Record<string, unknown>;

export const METHOD_CAPABILITY: Record<string, string> = {
  "codeAction/resolve": "codeActionProvider",
  "textDocument/codeAction": "codeActionProvider",
  "textDocument/completion": "completionProvider",
  "textDocument/definition": "definitionProvider",
  "textDocument/documentSymbol": "documentSymbolProvider",
  "textDocument/formatting": "documentFormattingProvider",
  "textDocument/hover": "hoverProvider",
  "textDocument/rangeFormatting": "documentRangeFormattingProvider",
  "textDocument/references": "referencesProvider",
};

export function extensionOf(uri: string): string | undefined {
  const withoutQuery = uri.split(/[?#]/, 1)[0];
  const slash = withoutQuery.lastIndexOf("/");
  const file = slash === -1 ? withoutQuery : withoutQuery.slice(slash + 1);
  const dot = file.lastIndexOf(".");
  if (dot <= 0) {
    return undefined;
  }
  return file.slice(dot).toLowerCase();
}

export function serversForDocument(config: ProxyConfig, uri: string): ServerConfig[] {
  const extension = extensionOf(uri);
  if (extension === undefined) {
    return [];
  }
  return config.servers.filter((server) =>
    Object.hasOwn(server.extensionToLanguage, extension),
  );
}

export function serversForRequest(
  config: ProxyConfig,
  capabilities: Map<string, ServerCapabilities>,
  uri: string,
  method: string,
): ServerConfig[] {
  const owners = serversForDocument(config, uri);
  const capability = METHOD_CAPABILITY[method];
  if (capability === undefined) {
    return owners;
  }
  return owners.filter((server) => {
    const caps = capabilities.get(server.name);
    return caps !== undefined && Boolean(caps[capability]);
  });
}
```

- [ ] **Step 4: GREEN run + battery**

`bun test` → PASS (5 tests). `rtk proxy biome check packages/lsp-proxy` + `bun check` → clean.

- [ ] **Step 5: STOP POINT — owner commits Task 4.**

---

### Task 5: `mux.ts`

**Files:**
- Create: `packages/lsp-proxy/src/mux.ts`, `packages/lsp-proxy/tests/mux.test.ts`

**Interfaces:**
- Consumes: none.
- Produces: `type PendingEntry = { clientId: number | string; method: string; server: string; serverId: number; uri?: string }`, `class RequestMux { assign(...): number; lookup(server, serverId): PendingEntry | undefined; release(entry): void; clientPending(clientId): Array<{ server: string; serverId: number }> }`.

- [ ] **Step 1: RED — failing mux tests (Review Focus 3)**

`packages/lsp-proxy/tests/mux.test.ts`:

```ts
import { describe, expect, it } from "bun:test";

import { RequestMux } from "../src/mux.ts";

describe("RequestMux", () => {
  it("assigns independent per-server id sequences to one client id", () => {
    const mux = new RequestMux();
    const idHover = mux.assign(10, "vtsls", "textDocument/hover");
    const idFormat = mux.assign(10, "biome", "textDocument/formatting");
    expect(idHover).toBe(1);
    expect(idFormat).toBe(1);
    const second = mux.assign(11, "vtsls", "textDocument/hover");
    expect(second).toBe(2);
  });

  it("resolves responses in any arrival order back to the right client entry", () => {
    const mux = new RequestMux();
    const forBiome = mux.assign(10, "biome", "textDocument/hover");
    const forVtsls = mux.assign(10, "vtsls", "textDocument/hover");
    const late = mux.lookup("vtsls", forVtsls);
    const early = mux.lookup("biome", forBiome);
    expect(early?.clientId).toBe(10);
    expect(early?.server).toBe("biome");
    expect(late?.clientId).toBe(10);
    expect(late?.server).toBe("vtsls");
  });

  it("releases entries so ids can be reused without ghost lookups", () => {
    const mux = new RequestMux();
    const serverId = mux.assign(10, "vtsls", "textDocument/hover");
    const entry = mux.lookup("vtsls", serverId);
    expect(entry).toBeDefined();
    if (entry) {
      mux.release(entry);
    }
    expect(mux.lookup("vtsls", serverId)).toBeUndefined();
    expect(mux.clientPending(10)).toEqual([]);
  });

  it("tracks pending fan-out per client id for cancellations", () => {
    const mux = new RequestMux();
    mux.assign(42, "vtsls", "textDocument/completion");
    mux.assign(42, "biome", "textDocument/completion");
    const pending = mux.clientPending(42);
    expect(pending).toEqual([
      { server: "vtsls", serverId: 1 },
      { server: "biome", serverId: 1 },
    ]);
  });
});
```

- [ ] **Step 2: Run RED**

`bun test` → FAIL (module missing).

- [ ] **Step 3: GREEN — mux implementation**

`packages/lsp-proxy/src/mux.ts`:

```ts
export type PendingEntry = {
  clientId: number | string;
  method: string;
  server: string;
  serverId: number;
  uri?: string;
};

export class RequestMux {
  private readonly nextId = new Map<string, number>();
  private readonly byServer = new Map<string, Map<number, PendingEntry>>();
  private readonly byClient = new Map<number | string, Map<string, number>>();

  assign(clientId: number | string, server: string, method: string, uri?: string): number {
    const serverId = (this.nextId.get(server) ?? 0) + 1;
    this.nextId.set(server, serverId);
    const entry: PendingEntry = { clientId, method, server, serverId, ...(uri === undefined ? {} : { uri }) };
    const serverMap = this.byServer.get(server) ?? new Map<number, PendingEntry>();
    serverMap.set(serverId, entry);
    this.byServer.set(server, serverMap);
    const clientMap = this.byClient.get(clientId) ?? new Map<string, number>();
    clientMap.set(server, serverId);
    this.byClient.set(clientId, clientMap);
    return serverId;
  }

  lookup(server: string, serverId: number): PendingEntry | undefined {
    return this.byServer.get(server)?.get(serverId);
  }

  release(entry: PendingEntry): void {
    this.byServer.get(entry.server)?.delete(entry.serverId);
    this.byClient.get(entry.clientId)?.delete(entry.server);
  }

  clientPending(clientId: number | string): Array<{ server: string; serverId: number }> {
    const entries = [...(this.byClient.get(clientId)?.entries() ?? [])];
    return entries.map(([server, serverId]) => ({ server, serverId }));
  }
}
```

- [ ] **Step 4: GREEN run + battery**

`bun test` → PASS (4 tests). `rtk proxy biome check packages/lsp-proxy` + `bun check` → clean.

- [ ] **Step 5: STOP POINT — owner commits Task 5.**

---

### Task 6: `merge.ts`

**Files:**
- Create: `packages/lsp-proxy/src/merge.ts`, `packages/lsp-proxy/tests/merge.test.ts`

**Interfaces:**
- Consumes: `JsonRpcError` from `./framing.ts`.
- Produces: `type ServerOutcome = { error?: JsonRpcError; result?: unknown; server: string }`, `type MergeOutcome = { error?: JsonRpcError; result?: unknown }`, `mergeOutcomes(method, outcomes, priority): MergeOutcome`, `tagCodeAction(action: unknown, server: string): unknown`, `originOfCodeAction(action: unknown): string | undefined`.

- [ ] **Step 1: RED — failing merge tests (per spec §5.4 table)**

`packages/lsp-proxy/tests/merge.test.ts`:

```ts
import { describe, expect, it } from "bun:test";

import { mergeOutcomes, type ServerOutcome } from "../src/merge.ts";

const PRIORITY = ["vtsls", "biome"];

describe("mergeOutcomes — set arrays", () => {
  it("concatenates definition arrays across servers", () => {
    const outcomes: ServerOutcome[] = [
      { result: [{ uri: "file:///a" }], server: "vtsls" },
      { result: [{ uri: "file:///b" }, { uri: "file:///c" }], server: "biome" },
    ];
    const merged = mergeOutcomes("textDocument/definition", outcomes, PRIORITY);
    expect(merged.result).toEqual([
      { uri: "file:///a" },
      { uri: "file:///b" },
      { uri: "file:///c" },
    ]);
  });

  it("normalizes a single Location into the array", () => {
    const outcomes: ServerOutcome[] = [
      { result: { uri: "file:///a" }, server: "vtsls" },
      { result: null, server: "biome" },
    ];
    expect(mergeOutcomes("textDocument/definition", outcomes, PRIORITY).result).toEqual([
      { uri: "file:///a" },
    ]);
  });

  it("returns the first error by priority when every server errored", () => {
    const outcomes: ServerOutcome[] = [
      { error: { code: -1, message: "biome boom" }, server: "biome" },
      { error: { code: -2, message: "vtsls boom" }, server: "vtsls" },
    ];
    const merged = mergeOutcomes("textDocument/hover", outcomes, PRIORITY);
    expect(merged.error?.message).toBe("vtsls boom");
  });

  it("merges successes when some servers error", () => {
    const outcomes: ServerOutcome[] = [
      { result: { contents: { kind: "markdown", value: "hi" } }, server: "vtsls" },
      { error: { code: -1, message: "boom" }, server: "biome" },
    ];
    expect(mergeOutcomes("textDocument/hover", outcomes, PRIORITY).error).toBeUndefined();
  });
});

describe("mergeOutcomes — completion", () => {
  it("concatenates items and ORs isIncomplete", () => {
    const outcomes: ServerOutcome[] = [
      { result: { isIncomplete: true, items: [{ label: "a" }] }, server: "vtsls" },
      { result: { isIncomplete: false, items: [{ label: "b" }] }, server: "biome" },
    ];
    const merged = mergeOutcomes("textDocument/completion", outcomes, PRIORITY);
    expect(merged.result).toEqual({
      isIncomplete: true,
      items: [{ label: "a" }, { label: "b" }],
    });
  });

  it("treats a null list as empty and all-null as an empty list", () => {
    const outcomes: ServerOutcome[] = [
      { result: null, server: "vtsls" },
      { result: { isIncomplete: false, items: [{ label: "b" }] }, server: "biome" },
    ];
    expect(mergeOutcomes("textDocument/completion", outcomes, PRIORITY).result).toEqual({
      isIncomplete: false,
      items: [{ label: "b" }],
    });
  });
});

describe("mergeOutcomes — hover", () => {
  it("joins markdown contents with a blank line", () => {
    const outcomes: ServerOutcome[] = [
      { result: { contents: { kind: "markdown", value: "one" } }, server: "vtsls" },
      { result: { contents: { kind: "markdown", value: "two" } }, server: "biome" },
    ];
    expect(mergeOutcomes("textDocument/hover", outcomes, PRIORITY).result).toEqual({
      contents: { kind: "markdown", value: "one\n\ntwo" },
    });
  });

  it("falls back to the priority-first hover when contents shapes differ", () => {
    const outcomes: ServerOutcome[] = [
      { result: { contents: "plain" }, server: "biome" },
      { result: null, server: "vtsls" },
    ];
    expect(mergeOutcomes("textDocument/hover", outcomes, PRIORITY).result).toEqual({
      contents: "plain",
    });
  });
});

describe("mergeOutcomes — single-document results", () => {
  it("picks the first non-null formatting edits by priority", () => {
    const outcomes: ServerOutcome[] = [
      { result: [{ newText: "x", range: null }], server: "biome" },
      { result: null, server: "vtsls" },
    ];
    const merged = mergeOutcomes("textDocument/formatting", outcomes, PRIORITY);
    expect(merged.result).toEqual([{ newText: "x", range: null }]);
  });

  it("returns null when every server answered null", () => {
    const outcomes: ServerOutcome[] = [
      { result: null, server: "vtsls" },
      { result: null, server: "biome" },
    ];
    expect(mergeOutcomes("textDocument/formatting", outcomes, PRIORITY).result).toBeNull();
  });
});

describe("mergeOutcomes — unknown methods", () => {
  it("returns the first non-null by priority", () => {
    const outcomes: ServerOutcome[] = [
      { result: { value: "from-biome" }, server: "biome" },
      { result: null, server: "vtsls" },
    ];
    expect(mergeOutcomes("workspace/someMethod", outcomes, PRIORITY).result).toEqual({
      value: "from-biome",
    });
  });
});
```

- [ ] **Step 2: Run RED**

`bun test` → FAIL (module missing).

- [ ] **Step 3: GREEN — merge implementation**

`packages/lsp-proxy/src/merge.ts`:

```ts
import type { JsonRpcError } from "./framing.ts";

const ARRAY_MERGE_METHODS = new Set([
  "textDocument/definition",
  "textDocument/references",
  "textDocument/documentSymbol",
  "textDocument/codeAction",
]);

const PRIORITY_FIRST_METHODS = new Set([
  "textDocument/formatting",
  "textDocument/rangeFormatting",
]);

const SERVER_TAG = "__lspProxyServer";

export type ServerOutcome = {
  error?: JsonRpcError;
  result?: unknown;
  server: string;
};

export type MergeOutcome = {
  error?: JsonRpcError;
  result?: unknown;
};

export function tagCodeAction(action: unknown, server: string): unknown {
  if (typeof action !== "object" || action === null) {
    return action;
  }
  const record = action as Record<string, unknown>;
  const data = { ...(isRecord(record.data) ? record.data : {}), [SERVER_TAG]: server };
  return { ...record, data };
}

export function originOfCodeAction(action: unknown): string | undefined {
  if (!isRecord(action) || !isRecord(action.data)) {
    return undefined;
  }
  const origin = action.data[SERVER_TAG];
  return typeof origin === "string" ? origin : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(result: unknown): unknown[] {
  if (Array.isArray(result)) {
    return result;
  }
  return result === null || result === undefined ? [] : [result];
}

function ordered<T extends { server: string }>(outcomes: T[], priority: string[]): T[] {
  return [...outcomes].sort(
    (left, right) =>
      (priority.indexOf(left.server) + 1 || priority.length + 1) -
      (priority.indexOf(right.server) + 1 || priority.length + 1),
  );
}

function firstError(outcomes: ServerOutcome[], priority: string[]): JsonRpcError | undefined {
  const errored = ordered(
    outcomes.filter((outcome) => outcome.error !== undefined),
    priority,
  );
  return errored[0]?.error;
}

function mergeCompletion(outcomes: ServerOutcome[]): unknown {
  const items: unknown[] = [];
  let isIncomplete = false;
  for (const outcome of outcomes) {
    if (outcome.result === null || outcome.result === undefined) {
      continue;
    }
    if (Array.isArray(outcome.result)) {
      items.push(...outcome.result);
      continue;
    }
    if (isRecord(outcome.result) && Array.isArray(outcome.result.items)) {
      items.push(...(outcome.result.items as unknown[]));
      isIncomplete = isIncomplete || outcome.result.isIncomplete === true;
    }
  }
  return { isIncomplete, items };
}

function mergeHover(outcomes: ServerOutcome[], priority: string[]): unknown {
  const hovers = ordered(
    outcomes.filter((outcome) => outcome.result !== null && outcome.result !== undefined),
    priority,
  );
  if (hovers.length === 0) {
    return null;
  }
  const markdown = hovers.map((outcome) =>
    isRecord(outcome.result) && isRecord(outcome.result.contents)
      ? outcome.result.contents
      : undefined,
  );
  if (markdown.every((contents) => isRecord(contents) && contents.kind === "markdown")) {
    const value = markdown
      .map((contents) => (contents as { value: string }).value)
      .join("\n\n");
    return { contents: { kind: "markdown", value } };
  }
  return hovers[0].result;
}

function firstNonNull(outcomes: ServerOutcome[], priority: string[]): unknown {
  for (const outcome of ordered(outcomes, priority)) {
    if (outcome.error === undefined && outcome.result !== null && outcome.result !== undefined) {
      return outcome.result;
    }
  }
  return null;
}

export function mergeOutcomes(
  method: string,
  outcomes: ServerOutcome[],
  priority: string[],
): MergeOutcome {
  const successes = outcomes.filter(
    (outcome) => outcome.error === undefined && outcome.result !== undefined,
  );
  if (successes.length === 0) {
    const error = firstError(outcomes, priority);
    return error === undefined ? { result: null } : { error };
  }
  if (method === "textDocument/completion") {
    return { result: mergeCompletion(outcomes) };
  }
  if (method === "textDocument/hover") {
    return { result: mergeHover(outcomes, priority) };
  }
  if (ARRAY_MERGE_METHODS.has(method)) {
    const merged = successes.flatMap((outcome) => asArray(outcome.result));
    const tagged =
      method === "textDocument/codeAction"
        ? merged.map((action) => tagCodeAction(action, successes.find((outcome) => asArray(outcome.result).includes(action))?.server ?? ""))
        : merged;
    return { result: tagged };
  }
  return { result: firstNonNull(outcomes, priority) };
}
```

Note for the implementer: the codeAction tagging lookup above is O(n²) and fragile — during GREEN, if the find-based origin lookup trips correctness or lint, replace it by merging per-server: iterate `ordered(successes, priority)`, concat `asArray(outcome.result).map(action => tagCodeAction(action, outcome.server))`. The per-server form is the intended implementation; the flatMap/find form is written here only to keep the plan readable. Take the per-server form.

- [ ] **Step 4: GREEN run + battery**

`bun test` → PASS (11 tests). `rtk proxy biome check packages/lsp-proxy` + `bun check` → clean.

- [ ] **Step 5: STOP POINT — owner commits Task 6.**

---

### Task 7: `capabilities.ts`

**Files:**
- Create: `packages/lsp-proxy/src/capabilities.ts`, `packages/lsp-proxy/tests/capabilities.test.ts`

**Interfaces:**
- Consumes: `ServerCapabilities` from `./router.ts`.
- Produces: `stripPullDiagnostics(clientCapabilities: unknown): unknown`, `type CapabilitiesInput = { capabilities: ServerCapabilities; server: string }`, `type CapabilitiesMerge = { merged: ServerCapabilities; rejected: Array<{ reason: string; server: string }> }`, `mergeCapabilities(inputs: CapabilitiesInput[], priority: string[]): CapabilitiesMerge`.

- [ ] **Step 1: RED — failing capability tests (D6, D7)**

`packages/lsp-proxy/tests/capabilities.test.ts`:

```ts
import { describe, expect, it } from "bun:test";

import { mergeCapabilities, stripPullDiagnostics } from "../src/capabilities.ts";

describe("stripPullDiagnostics", () => {
  it("removes textDocument.diagnostic without mutating the original", () => {
    const original = {
      textDocument: {
        diagnostic: { dynamicRegistration: false },
        hover: { dynamicRegistration: true },
      },
    };
    const stripped = stripPullDiagnostics(original) as typeof original;
    expect(stripped.textDocument.diagnostic).toBeUndefined();
    expect(stripped.textDocument.hover).toEqual({ dynamicRegistration: true });
    expect(original.textDocument.diagnostic).toBeDefined();
  });

  it("tolerates missing textDocument", () => {
    expect(stripPullDiagnostics({})).toEqual({});
  });
});

describe("mergeCapabilities", () => {
  it("ORs provider booleans and forces incremental sync", () => {
    const merged = mergeCapabilities(
      [
        { capabilities: { hoverProvider: true, textDocumentSync: 2 }, server: "vtsls" },
        {
          capabilities: { documentFormattingProvider: true, textDocumentSync: 2 },
          server: "biome",
        },
      ],
      ["vtsls", "biome"],
    );
    expect(merged.merged).toEqual({
      documentFormattingProvider: true,
      hoverProvider: true,
      textDocumentSync: 2,
    });
    expect(merged.rejected).toEqual([]);
  });

  it("rejects a full-sync server and keeps the rest (D6)", () => {
    const merged = mergeCapabilities(
      [
        { capabilities: { textDocumentSync: 2 }, server: "vtsls" },
        { capabilities: { textDocumentSync: 1 }, server: "biome" },
      ],
      ["vtsls", "biome"],
    );
    expect(merged.rejected).toEqual([
      { reason: "textDocumentSync must be 2 (incremental), got 1", server: "biome" },
    ]);
    expect(merged.merged.textDocumentSync).toBe(2);
  });

  it("takes provider objects from the priority-first server that declares them", () => {
    const merged = mergeCapabilities(
      [
        { capabilities: { completionProvider: { triggerCharacters: ["."] }, textDocumentSync: 2 }, server: "vtsls" },
        { capabilities: { completionProvider: { triggerCharacters: [":"] }, textDocumentSync: 2 }, server: "biome" },
      ],
      ["vtsls", "biome"],
    );
    expect(merged.merged.completionProvider).toEqual({ triggerCharacters: ["."] });
  });
});
```

- [ ] **Step 2: Run RED**

`bun test` → FAIL (module missing).

- [ ] **Step 3: GREEN — capabilities implementation**

`packages/lsp-proxy/src/capabilities.ts`:

```ts
import type { ServerCapabilities } from "./router.ts";

const PROVIDER_KEYS = [
  "codeActionProvider",
  "completionProvider",
  "definitionProvider",
  "documentFormattingProvider",
  "documentRangeFormattingProvider",
  "documentSymbolProvider",
  "hoverProvider",
  "referencesProvider",
];

export type CapabilitiesInput = {
  capabilities: ServerCapabilities;
  server: string;
};

export type CapabilitiesMerge = {
  merged: ServerCapabilities;
  rejected: Array<{ reason: string; server: string }>;
};

export function stripPullDiagnostics(clientCapabilities: unknown): unknown {
  if (typeof clientCapabilities !== "object" || clientCapabilities === null) {
    return clientCapabilities;
  }
  const clone = structuredClone(clientCapabilities) as Record<string, unknown>;
  const textDocument = clone.textDocument;
  if (typeof textDocument === "object" && textDocument !== null) {
    const nested = { ...(textDocument as Record<string, unknown>) };
    delete nested.diagnostic;
    clone.textDocument = nested;
  }
  return clone;
}

export function mergeCapabilities(
  inputs: CapabilitiesInput[],
  priority: string[],
): CapabilitiesMerge {
  const orderedInputs = [...inputs].sort(
    (left, right) => priority.indexOf(left.server) - priority.indexOf(right.server),
  );
  const accepted = orderedInputs.filter((input) => {
    const sync = input.capabilities.textDocumentSync;
    return sync === 2;
  });
  const rejected = orderedInputs
    .filter((input) => input.capabilities.textDocumentSync !== 2)
    .map((input) => ({
      reason: `textDocumentSync must be 2 (incremental), got ${String(
        input.capabilities.textDocumentSync,
      )}`,
      server: input.server,
    }));
  const merged: ServerCapabilities = { textDocumentSync: 2 };
  for (const key of PROVIDER_KEYS) {
    for (const input of accepted) {
      if (input.capabilities[key] !== undefined) {
        merged[key] = input.capabilities[key];
        break;
      }
    }
  }
  return { merged, rejected };
}
```

- [ ] **Step 4: GREEN run + battery**

`bun test` → PASS (5 tests). `rtk proxy biome check packages/lsp-proxy` + `bun check` → clean.

- [ ] **Step 5: STOP POINT — owner commits Task 7.**

---

### Task 8: `docstore.ts`

**Files:**
- Create: `packages/lsp-proxy/src/docstore.ts`, `packages/lsp-proxy/tests/docstore.test.ts`

**Interfaces:**
- Consumes: none.
- Produces: `type Position = { character: number; line: number }`, `type ContentChange = { range?: { end: Position; start: Position }; text: string }`, `type DocState = { languageId: string; text: string }`, `applyChanges(text, changes): string`, `class DocumentStore { open(uri, languageId, text); change(uri, changes); close(uri); get(uri); entries(): Array<{ languageId: string; text: string; uri: string }> }`.

- [ ] **Step 1: RED — failing docstore tests (Review Focus 4)**

`packages/lsp-proxy/tests/docstore.test.ts`:

```ts
import { describe, expect, it } from "bun:test";

import { applyChanges, DocumentStore } from "../src/docstore.ts";

const LINES = "one\ntwo\nthree\n";

describe("applyChanges", () => {
  it("replaces the whole text when no range is present", () => {
    expect(applyChanges(LINES, [{ text: "fresh" }])).toBe("fresh");
  });

  it("applies a single ranged change", () => {
    const change = {
      range: { end: { character: 3, line: 1 }, start: { character: 0, line: 1 } },
      text: "TWO",
    };
    expect(applyChanges(LINES, [change])).toBe("one\nTWO\nthree\n");
  });

  it("applies an insertion as a zero-width range", () => {
    const change = {
      range: { end: { character: 0, line: 0 }, start: { character: 0, line: 0 } },
      text: "> ",
    };
    expect(applyChanges(LINES, [change])).toBe("> one\ntwo\nthree\n");
  });

  it("applies several changes in array order against the running text", () => {
    const changes = [
      {
        range: { end: { character: 3, line: 0 }, start: { character: 0, line: 0 } },
        text: "ONE",
      },
      {
        range: { end: { character: 5, line: 1 }, start: { character: 0, line: 1 } },
        text: "2",
      },
    ];
    expect(applyChanges(LINES, changes)).toBe("ONE\n2\nthree\n");
  });

  it("survives a multibyte edit", () => {
    const change = {
      range: { end: { character: 2, line: 0 }, start: { character: 0, line: 0 } },
      text: "тест",
    };
    expect(applyChanges("укр\ntext", [change])).toBe("тест\ntext");
  });
});

describe("DocumentStore", () => {
  it("tracks the final text across open and incremental changes", () => {
    const store = new DocumentStore();
    store.open("file:///p/a.ts", "typescript", "const x = 1;\n");
    store.change("file:///p/a.ts", [
      {
        range: { end: { character: 11, line: 0 }, start: { character: 11, line: 0 } },
        text: "0",
      },
    ]);
    store.change("file:///p/a.ts", [{ text: "const y = 2;\n" }]);
    expect(store.get("file:///p/a.ts")).toEqual({
      languageId: "typescript",
      text: "const y = 2;\n",
    });
    store.close("file:///p/a.ts");
    expect(store.get("file:///p/a.ts")).toBeUndefined();
  });

  it("lists every open document for respawn replay", () => {
    const store = new DocumentStore();
    store.open("file:///p/a.ts", "typescript", "a");
    store.open("file:///p/b.json", "json", "b");
    expect(store.entries().map((entry) => entry.uri)).toEqual([
      "file:///p/a.ts",
      "file:///p/b.json",
    ]);
  });
});
```

- [ ] **Step 2: Run RED**

`bun test` → FAIL (module missing).

- [ ] **Step 3: GREEN — docstore implementation**

`packages/lsp-proxy/src/docstore.ts`:

```ts
export type Position = {
  character: number;
  line: number;
};

export type ContentChange = {
  range?: { end: Position; start: Position };
  text: string;
};

export type DocState = {
  languageId: string;
  text: string;
};

type StoredDoc = DocState & { uri: string };

function offsetOf(text: string, position: Position): number {
  const lines = text.split("\n");
  const clampedLine = Math.min(position.line, lines.length - 1);
  let offset = 0;
  for (let index = 0; index < clampedLine; index += 1) {
    offset += lines[index].length + 1;
  }
  return offset + Math.min(position.character, lines[clampedLine].length);
}

function applyOne(text: string, change: ContentChange): string {
  if (change.range === undefined) {
    return change.text;
  }
  const start = offsetOf(text, change.range.start);
  const end = Math.max(start, offsetOf(text, change.range.end));
  return text.slice(0, start) + change.text + text.slice(end);
}

export function applyChanges(text: string, changes: ContentChange[]): string {
  let current = text;
  for (const change of changes) {
    current = applyOne(current, change);
  }
  return current;
}

export class DocumentStore {
  private readonly documents = new Map<string, StoredDoc>();

  open(uri: string, languageId: string, text: string): void {
    this.documents.set(uri, { languageId, text, uri });
  }

  change(uri: string, changes: ContentChange[]): void {
    const document = this.documents.get(uri);
    if (document !== undefined) {
      document.text = applyChanges(document.text, changes);
    }
  }

  close(uri: string): void {
    this.documents.delete(uri);
  }

  get(uri: string): DocState | undefined {
    const document = this.documents.get(uri);
    if (document === undefined) {
      return undefined;
    }
    return { languageId: document.languageId, text: document.text };
  }

  entries(): StoredDoc[] {
    return [...this.documents.values()];
  }
}
```

Note: `offsetOf` uses UTF-16 code units (`String.slice` semantics), matching LSP position semantics; multibyte BMP characters are safe, lone surrogates are out of scope.

- [ ] **Step 4: GREEN run + battery**

`bun test` → PASS (7 tests). `rtk proxy biome check packages/lsp-proxy` + `bun check` → clean.

- [ ] **Step 5: STOP POINT — owner commits Task 8.**

---

### Task 9: stub-server fixture + `downstream.ts`

**Files:**
- Create: `packages/lsp-proxy/tests/fixtures/stub-server.ts`, `packages/lsp-proxy/src/downstream.ts`, `packages/lsp-proxy/tests/downstream.test.ts`

**Interfaces:**
- Consumes: `encodeFrame`, `createDecoder`, `JsonRpcMessage` from `./framing.ts`; `ServerConfig` from `./config.ts`.
- Produces: `type DownstreamHandlers = { onExit: (exitCode: number | null, signalCode: number | string | null) => void; onMessage: (message: JsonRpcMessage) => void }`, `class Downstream { constructor(config, handlers, spawn?); start(): void; send(message): void; kill(signal?): void; abort(): void; get pid(): number | undefined; readonly name: string }` — spawn injection typed natively as `typeof Bun.spawn`, the child as `Bun.Subprocess<"pipe", "pipe", "inherit">` (D11: no custom process types; `onExit` callback + `AbortSignal` per server).

- [ ] **Step 1: The stub-server fixture (test infrastructure, not TDD'd itself)**

`packages/lsp-proxy/tests/fixtures/stub-server.ts` — a minimal LSP server driven by argv: `bun stub-server.ts <name> <json-options>`. Options: `{ diagnostics: [{ message, severity }], exitOnDidOpen: boolean, hover: string, formatEdits: array | null, completionItems: array, sync?: number }`.

```ts
import process from "node:process";

import {
  createDecoder,
  encodeFrame,
  type JsonRpcMessage,
} from "../../src/framing.ts";

const name = process.argv[2] ?? "stub";
const options = JSON.parse(process.argv[3] ?? "{}") as {
  askConfiguration?: boolean;
  completionItems?: unknown[];
  diagnostics?: Array<{ message: string; severity?: number }>;
  exitOnDidOpen?: boolean;
  formatEdits?: unknown[] | null;
  hover?: string;
  sync?: number;
};

const write = (message: JsonRpcMessage) => {
  process.stdout.write(encodeFrame(message));
};

const send = (id: number | string | null, result: unknown) => {
  write({ id, jsonrpc: "2.0", result });
};

const publish = (uri: string) => {
  write({
    jsonrpc: "2.0",
    method: "textDocument/publishDiagnostics",
    params: {
      diagnostics: (options.diagnostics ?? [{ message: `diag from ${name}` }]).map(
        (diagnostic, index) => ({
          message: diagnostic.message,
          range: {
            end: { character: 0, line: index },
            start: { character: 0, line: index },
          },
          severity: diagnostic.severity ?? 1,
        }),
      ),
      uri,
    },
  });
};

let nextId = 1;

let pendingConfigId: number | undefined;
let pendingConfigUri = "";

const decode = createDecoder((message) => {
  if (message.method === undefined) {
    if (message.id !== undefined && message.id === pendingConfigId) {
      pendingConfigId = undefined;
      publish(pendingConfigUri);
    }
    return;
  }
  if (message.method === "initialize") {
    send(message.id ?? null, {
      capabilities: {
        completionProvider: true,
        documentFormattingProvider: true,
        hoverProvider: true,
        textDocumentSync: options.sync ?? 2,
      },
      serverInfo: { name },
    });
    return;
  }
  if (message.method === "textDocument/didOpen") {
    const uri = (message.params as { textDocument: { uri: string } }).textDocument.uri;
    if (options.exitOnDidOpen === true) {
      process.exit(17);
    }
    if (options.askConfiguration === true) {
      pendingConfigUri = uri;
      pendingConfigId = nextId++;
      write({
        id: pendingConfigId,
        jsonrpc: "2.0",
        method: "workspace/configuration",
        params: { items: [{ section: "" }] },
      });
      return;
    }
    publish(uri);
    return;
  }
  if (message.method === "textDocument/hover") {
    send(message.id ?? null, options.hover === undefined ? null : {
      contents: { kind: "markdown", value: `${name}: ${options.hover}` },
    });
    return;
  }
  if (message.method === "textDocument/completion") {
    send(message.id ?? null, { isIncomplete: false, items: options.completionItems ?? [] });
    return;
  }
  if (message.method === "textDocument/formatting") {
    send(message.id ?? null, options.formatEdits === null ? null : (options.formatEdits ?? []));
    return;
  }
  if (message.method === "workspace/configuration") {
    send(message.id ?? null, []);
    return;
  }
  if (message.method === "shutdown") {
    send(message.id ?? null, null);
    return;
  }
  if (message.method === "exit") {
    process.exit(0);
  }
  if (message.id !== undefined && message.id !== null) {
    send(message.id, null);
  }
});

for await (const chunk of Bun.stdin.stream()) {
  decode(chunk as Uint8Array);
}
```

(The `askConfiguration` option is the `workspace/configuration` drill: on didOpen the stub sends the server→client request and publishes diagnostics only after the proxy's answer arrives — proving the proxy answered from config settings instead of stalling.)

- [ ] **Step 2: RED — failing downstream tests (real spawn round-trip)**

`packages/lsp-proxy/tests/downstream.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import type { ServerConfig } from "../src/config.ts";
import { Downstream } from "../src/downstream.ts";

const STUB = join(import.meta.dir, "fixtures", "stub-server.ts");

function stubConfig(name: string): ServerConfig {
  return {
    args: [STUB, name, "{}"],
    command: "bun",
    extensionToLanguage: { ".ts": "typescript" },
    name,
  };
}

describe("Downstream", () => {
  it("sends initialize and delivers the response message", async () => {
    const received: unknown[] = [];
    const downstream = new Downstream(stubConfig("alpha"), {
      onExit: () => {},
      onMessage: (message) => received.push(message),
    });
    downstream.start();
    downstream.send({ id: 1, jsonrpc: "2.0", method: "initialize", params: {} });
    await waitFor(() => received.length > 0);
    downstream.kill();
    expect(received[0]).toMatchObject({ id: 1, result: { capabilities: { textDocumentSync: 2 } } });
  });

  it("reports the exit code when the process dies", async () => {
    const exits: Array<number | null> = [];
    const downstream = new Downstream(stubConfig("beta"), {
      onExit: (code) => exits.push(code),
      onMessage: () => {},
    });
    downstream.start();
    downstream.kill();
    await waitFor(() => exits.length > 0);
    expect(exits.length).toBeGreaterThan(0);
  });
});

async function waitFor(condition: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  expect(condition()).toBe(true);
}
```

(Extract `waitFor` into `tests/helpers/wait.ts` and import it from both this file and Task 10's integration tests — one helper, two consumers.)

- [ ] **Step 3: Run RED**

`bun test` → FAIL (module missing).

- [ ] **Step 4: GREEN — downstream implementation**

`packages/lsp-proxy/src/downstream.ts`:

```ts
import process from "node:process";

import type { ServerConfig } from "./config.ts";
import { createDecoder, encodeFrame, type JsonRpcMessage } from "./framing.ts";

export type DownstreamHandlers = {
  onExit: (exitCode: number | null, signalCode: number | string | null) => void;
  onMessage: (message: JsonRpcMessage) => void;
};

type PipedSubprocess = Bun.Subprocess<"pipe", "pipe", "inherit">;

export class Downstream {
  readonly name: string;
  private readonly config: ServerConfig;
  private readonly handlers: DownstreamHandlers;
  private readonly spawn: typeof Bun.spawn;
  private readonly controller = new AbortController();
  private child: PipedSubprocess | undefined;

  constructor(
    config: ServerConfig,
    handlers: DownstreamHandlers,
    spawn: typeof Bun.spawn = Bun.spawn,
  ) {
    this.config = config;
    this.handlers = handlers;
    this.name = config.name;
    this.spawn = spawn;
  }

  get pid(): number | undefined {
    return this.child?.pid;
  }

  start(): void {
    const child = this.spawn({
      cmd: [this.config.command, ...(this.config.args ?? [])],
      ...(this.config.env === undefined
        ? {}
        : { env: { ...process.env, ...this.config.env } }),
      onExit: (_subprocess, exitCode, signalCode) =>
        this.handlers.onExit(exitCode, signalCode),
      signal: this.controller.signal,
      stderr: "inherit",
      stdin: "pipe",
      stdout: "pipe",
    }) as PipedSubprocess;
    this.child = child;
    void this.readLoop(child);
  }

  send(message: JsonRpcMessage): void {
    const child = this.child;
    if (child === undefined) {
      return;
    }
    child.stdin.write(encodeFrame(message));
    child.stdin.flush();
  }

  kill(signal: number | string = "SIGTERM"): void {
    this.child?.kill(signal);
  }

  abort(): void {
    this.controller.abort();
  }

  exited(): Promise<number> {
    return this.child?.exited ?? Promise.resolve(-1);
  }

  private async readLoop(child: PipedSubprocess): Promise<void> {
    const decode = createDecoder(
      (message) => this.handlers.onMessage(message),
      (reason) => console.error(`[${this.name}] stream: ${reason}`),
    );
    for await (const chunk of child.stdout) {
      decode(chunk);
    }
  }
}
```

- [ ] **Step 5: GREEN run + battery**

`bun test` → PASS (2 new tests, prior suites still green). `rtk proxy biome check packages/lsp-proxy` + `bun check` → clean.

- [ ] **Step 6: STOP POINT — owner commits Task 9.**

---

### Task 10: `proxy.ts` orchestration + integration tests

**Files:**
- Create: `packages/lsp-proxy/src/proxy.ts`, `packages/lsp-proxy/tests/proxy.integration.test.ts`, `packages/lsp-proxy/tests/helpers/wait.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–9 (`framing`, `config`, `router`, `mux`, `merge`, `capabilities`, `docstore`, `downstream`).
- Produces: `type ProxyIO = { readChunks: () => AsyncIterable<Uint8Array>; stdout: { flush(): void; write(chunk: Uint8Array): number | Promise<number> } }`, `type ProxyRegistry = { clear(): void; save(children: number[]): Promise<void> }`, `class LspProxy { constructor(config, io, log, registry?); run(): Promise<void>; cascadeShutdown(reason: string): Promise<void> }`.

- [ ] **Step 1: RED — failing integration tests (Review Focus 3, 4, 5)**

`packages/lsp-proxy/tests/helpers/wait.ts`:

```ts
import { expect } from "bun:test";

export async function waitFor(
  condition: () => boolean,
  timeoutMs = 10_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  expect(condition()).toBe(true);
}
```

`packages/lsp-proxy/tests/proxy.integration.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import process from "node:process";

import { createDecoder, encodeFrame, type JsonRpcMessage } from "../src/framing.ts";
import { waitFor } from "./helpers/wait.ts";

const MAIN = join(import.meta.dir, "..", "src", "main.ts");
const STUB = join(import.meta.dir, "fixtures", "stub-server.ts");

type ProxyHandle = {
  clientMessages: JsonRpcMessage[];
  push(message: JsonRpcMessage): void;
  pushRaw(bytes: Uint8Array): void;
  stop(): Promise<void>;
};

async function startProxy(configPath: string): Promise<ProxyHandle> {
  const spawned = Bun.spawn(["bun", MAIN, configPath], {
    cmd: ["bun", MAIN, configPath],
    stderr: "inherit",
    stdin: "pipe",
    stdout: "pipe",
  });
  const clientMessages: JsonRpcMessage[] = [];
  const decode = createDecoder((message) => clientMessages.push(message));
  void (async () => {
    for await (const chunk of spawned.stdout) {
      decode(chunk);
    }
  })();
  const push = (message: JsonRpcMessage) => {
    spawned.stdin.write(encodeFrame(message));
    spawned.stdin.flush();
  };
  return {
    clientMessages,
    push,
    pushRaw: (bytes) => {
      spawned.stdin.write(bytes);
      spawned.stdin.flush();
    },
    stop: async () => {
      spawned.stdin.end();
      await waitFor(() => spawned.exitCode !== null, 10_000).catch(() => {});
      spawned.kill("SIGKILL");
    },
  };
}

async function writeConfig(servers: unknown[]): Promise<string> {
  const path = join(
    import.meta.dir,
    `tmp-config-${process.pid}-${Math.floor(Math.random() * 1e6)}.json`,
  );
  await Bun.write(path, JSON.stringify({ servers }));
  return path;
}

const stub = (name: string, options: Record<string, unknown>, extensions: Record<string, string>) => ({
  args: [STUB, name, JSON.stringify(options)],
  command: "bun",
  extensionToLanguage: extensions,
  initializationOptions: {},
  name,
  settings: {},
});

const INITIALIZE = { capabilities: { textDocument: { diagnostic: {} } } };

describe("LspProxy integration", () => {
  it("merges capabilities from both stubs and hides pull diagnostics", async () => {
    const configPath = await writeConfig([
      stub("alpha", {}, { ".ts": "typescript" }),
      stub("beta", {}, { ".ts": "typescript" }),
    ]);
    const proxy = await startProxy(configPath);
    proxy.push({ id: 1, jsonrpc: "2.0", method: "initialize", params: INITIALIZE });
    await waitFor(() => proxy.clientMessages.some((message) => message.id === 1));
    const response = proxy.clientMessages.find((message) => message.id === 1);
    expect(response?.result).toMatchObject({
      capabilities: { completionProvider: true, hoverProvider: true, textDocumentSync: 2 },
      serverInfo: { name: "lsp-proxy" },
    });
    await proxy.stop();
  });

  it("forwards both servers' diagnostics and routes didOpen by extension", async () => {
    const configPath = await writeConfig([
      stub("alpha", {}, { ".ts": "typescript" }),
      stub("beta", {}, ".json": undefined as never),
    ]);
    await proxy.stop();
  });
});
```

The implementer writes the full scenario set from this skeleton — do not stop at two. Required scenarios (each an `it(...)` with the same startProxy/assert pattern):

1. initialize merge (above).
2. `didOpen(.ts)` → diagnostics from BOTH stubs arrive at the client (`publishDiagnostics` × 2, distinguishable by message text `diag from alpha` / `diag from beta`).
3. `didOpen(.json)` → only the stub owning `.json` publishes.
4. `hover` fan-out → merged contents contain both `alpha:` and `beta:`.
5. `completion` fan-out with `completionItems` configured on both → merged items length = sum.
6. `formatting` priority: priority-1 stub configured `formatEdits: null`, priority-2 with edits → client receives the priority-2 edits (sequential ask, spec §5.4).
7. `$/cancelRequest` for a pending hover → proxy stays alive and a later hover still answers.
8. garbage bytes then a valid frame on client stdin → proxy survives, frame processed (Review Focus 2 at the system level).
9. stub with `exitOnDidOpen: true` → respawn+replay: diagnostics arrive a second time after the crash (Review Focus 4).
10. `shutdown` → client gets null result, then `exit` notification → proxy process exits 0.
11. config stub with `sync: 1` → that server rejected (no diagnostics from it), the healthy one still works (D6).
12. stub with `askConfiguration: true` and config `settings: { flag: 1 }` → the stub's `workspace/configuration` request is answered by the proxy (not forwarded to the client), and diagnostics still arrive afterwards (§5.2 drill — vtsls behaves this way live).

- [ ] **Step 2: Run RED**

`bun test tests/proxy.integration.test.ts` → FAIL (module `../src/proxy.ts` missing, and `src/main.ts` does not exist yet — create an empty `src/main.ts` placeholder ONLY if the test runner needs the file to spawn; otherwise let it fail on proxy import).

- [ ] **Step 3: GREEN — proxy implementation**

`packages/lsp-proxy/src/proxy.ts` (decomposed into small methods to respect the 50-line function guard):

```ts
import type { ProxyConfig, ServerConfig } from "./config.ts";
import { mergeCapabilities, stripPullDiagnostics } from "./capabilities.ts";
import { DocumentStore } from "./docstore.ts";
import { Downstream } from "./downstream.ts";
import { createDecoder, encodeFrame, type JsonRpcMessage } from "./framing.ts";
import { mergeOutcomes, originOfCodeAction, type ServerOutcome } from "./merge.ts";
import { RequestMux } from "./mux.ts";
import { serversForDocument, serversForRequest, type ServerCapabilities } from "./router.ts";

const SINGLE_RESULT_METHODS = new Set([
  "textDocument/formatting",
  "textDocument/rangeFormatting",
]);

const DOC_NOTIFICATION_METHODS = new Set([
  "textDocument/didOpen",
  "textDocument/didChange",
  "textDocument/didClose",
  "textDocument/didSave",
]);

const ANSWERED_SERVER_REQUESTS = new Set([
  "client/registerCapability",
  "window/workDoneProgress/create",
]);

type Waiter = { resolve: (outcome: ServerOutcome) => void };

export type ProxyIO = {
  readChunks: () => AsyncIterable<Uint8Array>;
  stdout: { flush(): void; write(chunk: Uint8Array): number | Promise<number> };
};

export type ProxyRegistry = {
  clear(): void;
  save(children: number[]): Promise<void>;
};

type Phase = "starting" | "ready" | "stopped";

export class LspProxy {
  private readonly config: ProxyConfig;
  private readonly io: ProxyIO;
  private readonly log: (line: string) => void;
  private readonly mux = new RequestMux();
  private readonly docs = new DocumentStore();
  private readonly servers = new Map<string, Downstream>();
  private readonly capabilities = new Map<string, ServerCapabilities>();
  private readonly waiters = new Map<string, Waiter>();
  private readonly initializeWaiters = new Map<string, Waiter>();
  private readonly initializeIds = new Map<string, number>();
  private readonly deaths = new Map<string, number>();
  private clientParams: Record<string, unknown> = {};
  private phase: Phase = "starting";
  private readonly registry: ProxyRegistry | undefined;
  private nextProxyId = 1;

  constructor(
    config: ProxyConfig,
    io: ProxyIO,
    log: (line: string) => void,
    registry?: ProxyRegistry,
  ) {
    this.config = config;
    this.io = io;
    this.log = log;
    this.registry = registry;
  }

  async run(): Promise<void> {
    const decode = createDecoder(
      (message) => void this.onClientMessage(message),
      (reason) => this.log(`client stream: ${reason}`),
    );
    try {
      for await (const chunk of this.io.readChunks()) {
        decode(chunk);
      }
    } catch (error) {
      this.log(`client loop error: ${String(error)}`);
    }
    await this.cascadeShutdown("client stdin closed");
  }

  private write(message: JsonRpcMessage): void {
    this.io.stdout.write(encodeFrame(message));
    this.io.stdout.flush();
  }

  private replyTo(id: number | string | null, result: unknown): void {
    this.write({ id, jsonrpc: "2.0", result });
  }

  private replyErrorTo(id: number | string | null, code: number, message: string): void {
    this.write({ error: { code, message }, id, jsonrpc: "2.0" });
  }

  private onClientMessage(message: JsonRpcMessage): void {
    if (message.method === undefined) {
      return;
    }
    if (message.method === "initialize") {
      void this.handleInitialize(message);
      return;
    }
    if (message.method === "initialized") {
      this.broadcast(message, [...this.servers.values()]);
      return;
    }
    if (message.method === "shutdown") {
      void this.handleShutdown(message);
      return;
    }
    if (message.method === "exit") {
      void this.cascadeShutdown("exit");
      return;
    }
    if (message.method === "$/cancelRequest" && message.params !== undefined) {
      this.handleCancel(message.params as { id: number | string });
      return;
    }
    if (DOC_NOTIFICATION_METHODS.has(message.method)) {
      this.handleDocumentNotification(message);
      return;
    }
    if (message.id !== undefined && message.id !== null) {
      void this.handleClientRequest(message);
    }
  }

  private async handleInitialize(message: JsonRpcMessage): Promise<void> {
    this.clientParams = (message.params as Record<string, unknown>) ?? {};
    const forwarded = { ...this.clientParams, capabilities: stripPullDiagnostics(this.clientParams.capabilities) };
    const inits = this.config.servers.map(async (serverConfig) =>
      this.startServer(serverConfig, forwarded),
    );
    await Promise.all(inits);
    const merge = mergeCapabilities(
      [...this.capabilities.entries()].map(([server, capabilities]) => ({ capabilities, server })),
      this.config.servers.map((server) => server.name),
    );
    for (const rejected of merge.rejected) {
      this.log(`rejecting server ${rejected.server}: ${rejected.reason}`);
      await this.dropServer(rejected.server);
    }
    this.phase = "ready";
    await this.saveRegistry();
    this.replyTo(message.id ?? null, {
      capabilities: merge.merged,
      serverInfo: { name: "lsp-proxy", version: "0.1.0" },
    });
  }

  private startServer(serverConfig: ServerConfig, initParams: Record<string, unknown>): Promise<void> {
    const serverId = this.nextProxyId++;
    const downstream = new Downstream(serverConfig, {
      onExit: (code) => void this.handleServerExit(serverConfig.name, code),
      onMessage: (message) => this.onServerMessage(serverConfig.name, message),
    });
    this.servers.set(serverConfig.name, downstream);
    downstream.start();
    const promise = new Promise<void>((resolve) => {
      this.initializeWaiters.set(serverConfig.name, {
        resolve: (outcome) => {
          if (outcome.result !== undefined) {
            const caps = (outcome.result as { capabilities?: ServerCapabilities }).capabilities ?? {};
            this.capabilities.set(serverConfig.name, caps);
          }
          resolve();
        },
      });
    });
    this.initializeIds.set(serverConfig.name, serverId);
    downstream.send({
      id: serverId,
      jsonrpc: "2.0",
      method: "initialize",
      params: {
        ...initParams,
        initializationOptions: serverConfig.initializationOptions ?? {},
      },
    });
    return promise;
  }

  private handleDocumentNotification(message: JsonRpcMessage): void {
    const params = (message.params ?? {}) as {
      contentChanges?: Array<{ text: string }>;
      textDocument?: { languageId: string; text: string; uri: string };
      uri?: string;
    };
    const uri = params.textDocument?.uri ?? params.uri ?? "";
    if (message.method === "textDocument/didOpen" && params.textDocument) {
      this.docs.open(uri, params.textDocument.languageId, params.textDocument.text);
    }
    if (message.method === "textDocument/didChange") {
      this.docs.change(uri, params.contentChanges ?? []);
    }
    if (message.method === "textDocument/didClose") {
      this.docs.close(uri);
    }
    this.broadcast(message, serversForDocument(this.config, uri));
  }

  private broadcast(message: JsonRpcMessage, recipients: Downstream[]): void {
    for (const downstream of recipients) {
      const stripped = { ...message };
      delete stripped.id;
      downstream.send(stripped);
    }
  }

  private async handleClientRequest(message: JsonRpcMessage): Promise<void> {
    if (this.phase !== "ready") {
      this.replyErrorTo(message.id ?? null, -32002, "server not initialized");
      return;
    }
    const method = message.method ?? "";
    const params = (message.params ?? {}) as { textDocument?: { uri: string } };
    const uri = params.textDocument?.uri ?? "";
    if (method === "codeAction/resolve") {
      this.handleCodeActionResolve(message);
      return;
    }
    const recipients = serversForRequest(this.config, this.capabilities, uri, method);
    if (recipients.length === 0) {
      this.replyTo(message.id ?? null, null);
      return;
    }
    if (SINGLE_RESULT_METHODS.has(method)) {
      await this.askSequentially(message, method, recipients);
      return;
    }
    await this.askAllAndMerge(message, method, recipients);
  }

  private async askSequentially(
    message: JsonRpcMessage,
    method: string,
    recipients: Downstream[],
  ): Promise<void> {
    for (const downstream of recipients) {
      const outcome = await this.askOnce(message, method, downstream);
      if (outcome.error === undefined && outcome.result != null) {
        this.replyTo(message.id ?? null, outcome.result);
        return;
      }
    }
    this.replyTo(message.id ?? null, null);
  }

  private async askAllAndMerge(
    message: JsonRpcMessage,
    method: string,
    recipients: Downstream[],
  ): Promise<void> {
    const outcomes = await Promise.all(
      recipients.map((downstream) => this.askOnce(message, method, downstream)),
    );
    const merged = mergeOutcomes(
      method,
      outcomes,
      this.config.servers.map((server) => server.name),
    );
    if (merged.error !== undefined) {
      this.replyErrorTo(message.id ?? null, merged.error.code, merged.error.message);
      return;
    }
    this.replyTo(message.id ?? null, merged.result ?? null);
  }

  private async askOnce(
    message: JsonRpcMessage,
    method: string,
    downstream: Downstream,
  ): Promise<ServerOutcome> {
    const clientId = message.id ?? 0;
    const serverId = this.mux.assign(clientId, downstream.name, method);
    const promise = new Promise<ServerOutcome>((resolve) => {
      this.waiters.set(`${downstream.name}:${serverId}`, { resolve });
    });
    downstream.send({ id: serverId, jsonrpc: "2.0", method, params: message.params });
    return promise;
  }

  private handleCodeActionResolve(message: JsonRpcMessage): void {
    const origin = originOfCodeAction(message.params);
    const fallback = [...this.servers.keys()][0];
    const target = origin !== undefined && this.servers.has(origin) ? origin : fallback;
    const downstream = this.servers.get(target);
    if (downstream === undefined) {
      this.replyErrorTo(message.id ?? null, -32601, "no server for codeAction/resolve");
      return;
    }
    const serverId = this.mux.assign(message.id ?? 0, downstream.name, message.method ?? "");
    const promise = new Promise<ServerOutcome>((resolve) => {
      this.waiters.set(`${downstream.name}:${serverId}`, { resolve });
    });
    downstream.send({ id: serverId, jsonrpc: "2.0", method: message.method, params: message.params });
    void promise.then((outcome) => {
      if (outcome.error !== undefined) {
        this.replyErrorTo(message.id ?? null, outcome.error.code, outcome.error.message);
      } else {
        this.replyTo(message.id ?? null, outcome.result ?? null);
      }
    });
  }

  private handleCancel(params: { id: number | string }): void {
    for (const { server, serverId } of this.mux.clientPending(params.id)) {
      const downstream = this.servers.get(server);
      const waiterKey = `${server}:${serverId}`;
      const entry = this.mux.lookup(server, serverId);
      downstream?.send({ id: serverId, jsonrpc: "2.0", method: "$/cancelRequest" });
      const waiter = this.waiters.get(waiterKey);
      if (waiter !== undefined && entry !== undefined) {
        this.waiters.delete(waiterKey);
        waiter.resolve({ error: { code: -32800, message: "cancelled" }, server });
        this.mux.release(entry);
      }
    }
  }

  private async handleShutdown(message: JsonRpcMessage): Promise<void> {
    const replies = [...this.servers.values()].map(async (downstream) => {
      const serverId = this.nextProxyId++;
      const reply = new Promise<void>((resolve) => {
        this.initializeWaiters.set(downstream.name, { resolve: () => resolve() });
      });
      downstream.send({ id: serverId, jsonrpc: "2.0", method: "shutdown" });
      await reply;
    });
    await Promise.all(replies);
    this.phase = "stopped";
    this.replyTo(message.id ?? null, null);
  }

  private onServerMessage(server: string, message: JsonRpcMessage): void {
    if (message.method !== undefined && message.id !== undefined && message.id !== null) {
      this.handleServerRequest(server, message);
      return;
    }
    if (message.method !== undefined) {
      this.handleServerNotification(server, message);
      return;
    }
    this.handleServerResponse(server, message);
  }

  private handleServerResponse(server: string, message: JsonRpcMessage): void {
    const serverId = typeof message.id === "string" ? Number(message.id) : message.id ?? 0;
    const waiterKey = `${server}:${serverId}`;
    const waiter = this.waiters.get(waiterKey);
    if (waiter !== undefined) {
      this.waiters.delete(waiterKey);
      const entry = this.mux.lookup(server, serverId);
      if (entry !== undefined) {
        this.mux.release(entry);
      }
      waiter.resolve(this.toOutcome(message, server));
      return;
    }
    const initializeWaiter = this.initializeWaiters.get(server);
    if (initializeWaiter !== undefined && this.initializeIds.get(server) === serverId) {
      this.initializeWaiters.delete(server);
      initializeWaiter.resolve(this.toOutcome(message, server));
    }
  }

  private toOutcome(message: JsonRpcMessage, server: string): ServerOutcome {
    if (message.error !== undefined) {
      return { error: message.error, server };
    }
    return { result: message.result ?? null, server };
  }

  private handleServerNotification(server: string, message: JsonRpcMessage): void {
    const method = message.method ?? "";
    if (method === "textDocument/publishDiagnostics" || method === "textDocument/publishDiagnostics") {
      this.write(message);
      return;
    }
    if (method === "window/logMessage" || method === "window/showMessage") {
      this.log(`${server}: ${method}`);
      return;
    }
    if (method.startsWith("$/")) {
      this.log(`${server}: dropped ${method}`);
    }
  }

  private handleServerRequest(server: string, message: JsonRpcMessage): void {
    const method = message.method ?? "";
    const serverConfig = this.config.servers.find((entry) => entry.name === server);
    if (method === "workspace/configuration" && serverConfig) {
      const items = ((message.params as { items?: unknown[] })?.items ?? []) as unknown[];
      this.replyTo(message.id ?? null, items.map(() => serverConfig.settings ?? null));
      return;
    }
    if (ANSWERED_SERVER_REQUESTS.has(method)) {
      this.replyTo(message.id ?? null, null);
      return;
    }
    this.replyErrorTo(message.id ?? null, -32601, `lsp-proxy does not forward ${method}`);
  }

  private async handleServerExit(server: string, code: number | null): Promise<void> {
    if (this.phase === "stopped") {
      return;
    }
    const deaths = (this.deaths.get(server) ?? 0) + 1;
    this.deaths.set(server, deaths);
    this.capabilities.delete(server);
    await this.dropServer(server);
    if (deaths > 1) {
      this.log(`server ${server} died (${code}) a second time; giving up`);
      return;
    }
    this.log(`server ${server} died (${code}); respawning`);
    const serverConfig = this.config.servers.find((entry) => entry.name === server);
    if (serverConfig === undefined) {
      return;
    }
    const forwarded = {
      ...this.clientParams,
      capabilities: stripPullDiagnostics(this.clientParams.capabilities),
    };
    await this.startServer(serverConfig, forwarded);
    await this.replayDocuments(serverConfig);
    await this.saveRegistry();
  }

  private currentChildPids(): number[] {
    return [...this.servers.values()]
      .map((downstream) => downstream.pid)
      .filter((pid): pid is number => pid !== undefined);
  }

  private async saveRegistry(): Promise<void> {
    await this.registry?.save(this.currentChildPids());
  }

  private async replayDocuments(serverConfig: ServerConfig): Promise<void> {
    const relevant = this.docs
      .entries()
      .filter((entry) => serversForDocument(this.config, entry.uri).some((server) => server.name === serverConfig.name));
    for (const entry of relevant) {
      const downstream = this.servers.get(serverConfig.name);
      downstream?.send({
        jsonrpc: "2.0",
        method: "textDocument/didOpen",
        params: {
          textDocument: { languageId: entry.languageId, text: entry.text, uri: entry.uri },
        },
      });
    }
  }

  private async dropServer(server: string): Promise<void> {
    const downstream = this.servers.get(server);
    if (downstream !== undefined) {
      downstream.kill();
      this.servers.delete(server);
    }
  }

  async cascadeShutdown(reason: string): Promise<void> {
    if (this.phase === "stopped") {
      return;
    }
    this.phase = "stopped";
    this.log(`shutting down: ${reason}`);
    const stragglers = [...this.servers.values()];
    for (const downstream of stragglers) {
      downstream.send({ id: this.nextProxyId++, jsonrpc: "2.0", method: "shutdown" });
      downstream.kill("SIGTERM");
    }
    this.servers.clear();
    this.registry?.clear();
    void Promise.all(stragglers.map((downstream) => downstream.exited()))
      .catch(() => {})
      .then(() => process.exit(0));
    setTimeout(() => {
      for (const downstream of stragglers) {
        downstream.kill("SIGKILL");
      }
      process.exit(0);
    }, 2000);
  }
}
```

Implementation notes (binding):
- `process` import (`import process from "node:process"`) is required at the top.
- The duplicated `publishDiagnostics` condition in `handleServerNotification` is a transcription artifact — keep ONE comparison.
- `cascadeShutdown` escalation is deliberate (D11): exit fires when every child's `exited()` resolves; the 2s timer SIGKILLs stragglers and force-exits. Never call `process.exit(0)` synchronously at the top of the cascade — the SIGTERM would have no time to land.
- If `noExcessiveLinesPerFile` trips on this file, split the server-direction methods (`onServerMessage`, `handleServerResponse`, `handleServerRequest`, `handleServerExit`, `replayDocuments`) into `proxy-server.ts` exporting a small `ServerDirection` class that the orchestrator composes — same public interface.

- [ ] **Step 4: `src/main.ts` placeholder for the integration spawn**

`packages/lsp-proxy/src/main.ts` (the Task 11 stop extends it with `--kill-all` and registry wiring; the integration tests spawn it now):

```ts
import process from "node:process";

import { parseConfig } from "./config.ts";
import { LspProxy } from "./proxy.ts";

const defaultConfig = new URL("../lsp-proxy.config.json", import.meta.url);
const configArgument = process.argv[2];
const configPath = configArgument ?? defaultConfig.pathname;
const raw: unknown = await Bun.file(configPath).json();
const parsed = parseConfig(raw);
if (!parsed.ok) {
  console.error(`lsp-proxy: invalid config at ${configPath}:\n${parsed.errors.join("\n")}`);
  process.exit(1);
}
const proxy = new LspProxy(
  parsed.config,
  { readChunks: () => Bun.stdin.stream(), stdout: Bun.stdout.writer() },
  (line) => console.error(`[lsp-proxy] ${line}`),
);
process.on("SIGTERM", () => {
  void proxy.cascadeShutdown("SIGTERM");
});
await proxy.run();
```

- [ ] **Step 5: GREEN run + battery**

Run: `cd /Users/vasilsokolik/www/cc-sdd/packages/lsp-proxy && bun test` → ALL suites PASS (integration scenarios 1–11 included).
Run: `cd /Users/vasilsokolik/www/cc-sdd && rtk proxy biome check packages/lsp-proxy` → clean; `bun check` → clean.

- [ ] **Step 6: STOP POINT — owner commits Task 10.**

---

### Task 11: `pidfile.ts` registry + `--kill-all` mode (D11)

**Files:**
- Create: `packages/lsp-proxy/src/pidfile.ts`, `packages/lsp-proxy/tests/pidfile.test.ts`, `packages/lsp-proxy/tests/kill-all.integration.test.ts`
- Modify: `packages/lsp-proxy/src/main.ts` (final form: `--kill-all` branch + registry wiring)

**Interfaces:**
- Consumes: `LspProxy`, `ProxyRegistry` from `./proxy.ts` (Task 10), stub fixture (Task 9).
- Produces: `type PidRecord = { children: number[]; pid: number }`, `registryDir(home): string`, `recordPath(home, pid): string`, `isAlive(pid): boolean`, `saveRecord(home, record): Promise<void>`, `removeRecord(home, pid): void`, `loadRecords(home): Promise<PidRecord[]>`, `killAll(home): Promise<{ killed: number[]; stale: number[] }>`.

- [ ] **Step 1: RED — failing pidfile unit tests**

`packages/lsp-proxy/tests/pidfile.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

import {
  isAlive,
  killAll,
  loadRecords,
  recordPath,
  registryDir,
  saveRecord,
} from "../src/pidfile.ts";

const repoTmp = join(import.meta.dir, "..", "..", "..", "tmp");

function tempHome(): string {
  mkdirSync(repoTmp, { recursive: true });
  return mkdtempSync(join(repoTmp, "lsp-proxy-pid-"));
}

describe("pidfile registry", () => {
  it("derives the registry path under .local/state", () => {
    expect(registryDir("/Users/tester")).toBe("/Users/tester/.local/state/lsp-proxy");
    expect(recordPath("/Users/tester", 4242)).toBe(
      "/Users/tester/.local/state/lsp-proxy/4242.json",
    );
  });

  it("isAlive detects live vs missing pids", () => {
    expect(isAlive(process.pid)).toBe(true);
    expect(isAlive(999_999)).toBe(false);
  });

  it("saves and loads records round-trip, skipping invalid files", async () => {
    const home = tempHome();
    await saveRecord(home, { children: [11, 12], pid: 10 });
    await Bun.write(join(registryDir(home), "junk.json"), "not json");
    expect(await loadRecords(home)).toEqual([{ children: [11, 12], pid: 10 }]);
    rmSync(home, { recursive: true, force: true });
  });

  it("killAll terminates live pids from the registry and removes files", async () => {
    const home = tempHome();
    const spawnSleeper = () =>
      Bun.spawn(["sleep", "30"], { stderr: "ignore", stdout: "ignore" });
    const proxy = spawnSleeper();
    const child = spawnSleeper();
    await saveRecord(home, { children: [child.pid], pid: proxy.pid });
    const summary = await killAll(home);
    expect(summary.killed.sort()).toEqual([child.pid, proxy.pid].sort());
    await proxy.exited;
    await child.exited;
    expect(await loadRecords(home)).toEqual([]);
    rmSync(home, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run RED**

Run: `cd /Users/vasilsokolik/www/cc-sdd/packages/lsp-proxy && bun test`
Expected: FAIL — cannot resolve `../src/pidfile.ts`.

- [ ] **Step 3: GREEN — pidfile implementation**

`packages/lsp-proxy/src/pidfile.ts`:

```ts
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

export type PidRecord = {
  children: number[];
  pid: number;
};

export function registryDir(home: string): string {
  return join(home, ".local", "state", "lsp-proxy");
}

export function recordPath(home: string, pid: number): string {
  return join(registryDir(home), `${pid}.json`);
}

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function isPidRecord(value: unknown): value is PidRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as { children?: unknown; pid?: unknown };
  return (
    typeof candidate.pid === "number" &&
    Array.isArray(candidate.children) &&
    candidate.children.every((child) => typeof child === "number")
  );
}

export async function saveRecord(home: string, record: PidRecord): Promise<void> {
  mkdirSync(registryDir(home), { recursive: true });
  await Bun.write(recordPath(home, record.pid), `${JSON.stringify(record)}\n`);
}

export function removeRecord(home: string, pid: number): void {
  rmSync(recordPath(home, pid), { force: true });
}

export async function loadRecords(home: string): Promise<PidRecord[]> {
  const dir = registryDir(home);
  if (!existsSync(dir)) {
    return [];
  }
  const records: PidRecord[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    const parsed: unknown = await Bun.file(join(dir, entry.name)).json();
    if (isPidRecord(parsed)) {
      records.push(parsed);
    }
  }
  return records;
}

export async function killAll(
  home: string,
): Promise<{ killed: number[]; stale: number[] }> {
  const killed: number[] = [];
  const stale: number[] = [];
  for (const record of await loadRecords(home)) {
    for (const pid of [...record.children, record.pid]) {
      if (isAlive(pid)) {
        process.kill(pid, "SIGTERM");
        killed.push(pid);
      }
    }
    if (!isAlive(record.pid)) {
      stale.push(record.pid);
    }
    removeRecord(home, record.pid);
  }
  return { killed, stale };
}
```

- [ ] **Step 4: Run GREEN for the unit tests**

Run: `cd /Users/vasilsokolik/www/cc-sdd/packages/lsp-proxy && bun test tests/pidfile.test.ts` → PASS (4 tests).

- [ ] **Step 5: RED — the `--kill-all` integration test**

`packages/lsp-proxy/tests/kill-all.integration.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

import { encodeFrame } from "../src/framing.ts";
import { waitFor } from "./helpers/wait.ts";

const MAIN = join(import.meta.dir, "..", "src", "main.ts");
const STUB = join(import.meta.dir, "fixtures", "stub-server.ts");
const repoTmp = join(import.meta.dir, "..", "..", "..", "tmp");

describe("lsp-proxy --kill-all", () => {
  it("terminates a running proxy and its downstream children via the registry", async () => {
    mkdirSync(repoTmp, { recursive: true });
    const home = mkdtempSync(join(repoTmp, "lsp-proxy-e2e-"));
    const configPath = join(home, "config.json");
    const stubArgs = (name: string) => [STUB, name, "{}"];
    await Bun.write(
      configPath,
      JSON.stringify({
        servers: [
          {
            args: stubArgs("alpha"),
            command: "bun",
            extensionToLanguage: { ".ts": "typescript" },
            name: "alpha",
          },
          {
            args: stubArgs("beta"),
            command: "bun",
            extensionToLanguage: { ".ts": "typescript" },
            name: "beta",
          },
        ],
      }),
    );
    const proxy = Bun.spawn({
      cmd: ["bun", MAIN, configPath],
      env: { ...process.env, HOME: home },
      stderr: "inherit",
      stdin: "pipe",
      stdout: "pipe",
    });
    proxy.stdin.write(
      encodeFrame({
        id: 1,
        jsonrpc: "2.0",
        method: "initialize",
        params: { capabilities: {} },
      }),
    );
    proxy.stdin.flush();
    const registryPath = join(home, ".local", "state", "lsp-proxy", `${proxy.pid}.json`);
    await waitFor(() => existsSync(registryPath));
    const killer = Bun.spawn({
      cmd: ["bun", MAIN, "--kill-all"],
      env: { ...process.env, HOME: home },
      stderr: "inherit",
      stdout: "ignore",
    });
    await killer.exited;
    expect(killer.exitCode).toBe(0);
    await waitFor(() => proxy.exitCode !== null);
    rmSync(home, { recursive: true, force: true });
  });
});
```

Run: `bun test tests/kill-all.integration.test.ts` → FAIL — `--kill-all` is not a recognized flag yet and the proxy never writes the registry (main.ts has no branch/wiring).

- [ ] **Step 6: GREEN — `main.ts` final form**

`packages/lsp-proxy/src/main.ts` (full replacement of the Task 10 placeholder):

```ts
import { homedir } from "node:os";
import { parseArgs } from "node:util";
import process from "node:process";

import { parseConfig } from "./config.ts";
import { killAll, removeRecord, saveRecord } from "./pidfile.ts";
import { LspProxy } from "./proxy.ts";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  args: process.argv.slice(2),
  options: { "kill-all": { type: "boolean" } },
});

if (values["kill-all"] === true) {
  const summary = await killAll(homedir());
  const killed = summary.killed.join(", ") || "-";
  const stale = summary.stale.join(", ") || "-";
  console.error(`[lsp-proxy] kill-all: killed ${killed}; stale ${stale}`);
  process.exit(0);
}

const defaultConfig = new URL("../lsp-proxy.config.json", import.meta.url);
const configPath = positionals[0] ?? defaultConfig.pathname;
const raw: unknown = await Bun.file(configPath).json();
const parsed = parseConfig(raw);
if (!parsed.ok) {
  console.error(`lsp-proxy: invalid config at ${configPath}:\n${parsed.errors.join("\n")}`);
  process.exit(1);
}

const home = homedir();
const registry = {
  clear: () => removeRecord(home, process.pid),
  save: async (children: number[]) => {
    await saveRecord(home, { children, pid: process.pid });
  },
};
const proxy = new LspProxy(
  parsed.config,
  { readChunks: () => Bun.stdin.stream(), stdout: Bun.stdout.writer() },
  (line) => console.error(`[lsp-proxy] ${line}`),
  registry,
);
process.on("SIGTERM", () => {
  void proxy.cascadeShutdown("SIGTERM");
});
await proxy.run();
```

Run: `cd /Users/vasilsokolik/www/cc-sdd/packages/lsp-proxy && bun test` → ALL suites PASS (pidfile unit + kill-all integration + everything prior).

- [ ] **Step 7: Battery + STOP POINT**

`rtk proxy biome check packages/lsp-proxy` + `bun check` → clean. Owner commits Task 11.

---

### Task 12: `build.ts` wrapper + binary smoke

**Files:**
- Create: `packages/lsp-proxy/build.ts`

**Interfaces:**
- Consumes: `buildBinary` from `@cc-sdd/bin-builder` (Task 1).
- Produces: `~/.local/bin/lsp-proxy` standalone binary via `bun run build-bin`.

- [ ] **Step 1: The wrapper (mirrors cli-hook's, D9)**

`packages/lsp-proxy/build.ts`:

```ts
import { homedir } from "node:os";
import process from "node:process";

import { buildBinary } from "@cc-sdd/bin-builder";

await buildBinary({ binName: "lsp-proxy", entrypoints: ["./src/main.ts"] }, homedir()).catch(
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
```

- [ ] **Step 2: Build and smoke the binary**

Run: `cd /Users/vasilsokolik/www/cc-sdd/packages/lsp-proxy && bun run build-bin`
Expected: `BunBuildSuccess` logged; `~/.local/bin/lsp-proxy` exists.
Smoke (stub pair through the real binary — reuses Task 9's fixture via a temp config):

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}' | ~/.local/bin/lsp-proxy /Users/vasilsokolik/www/cc-sdd/packages/lsp-proxy/lsp-proxy.config.json
```

Expected: a framed `initialize` response with `serverInfo.name = "lsp-proxy"` on stdout (real vtsls/biome spawn; vtsls startup may take seconds — wait for EOF), exit 0 on stdin close. If vtsls or biome is unavailable in the smoke environment, substitute a two-stub temp config like Task 10's and smoke with that; report which variant ran.

- [ ] **Step 3: Battery**

`bun test` (all suites), `rtk proxy biome check packages/lsp-proxy`, `bun check` → clean.

- [ ] **Step 4: STOP POINT — owner commits Task 11.**

---

### Task 13: `sync-extensions.ts` (D10)

**Files:**
- Create: `packages/lsp-proxy/src/sync-extensions.ts`, `packages/lsp-proxy/tests/sync-extensions.test.ts`

**Interfaces:**
- Consumes: `parseConfig`, `ProxyConfig` from `./config.ts`; `node:util` `parseArgs`.
- Produces: `extensionUnion(config): Record<string, string>`, `mergeIntoLspJson(text, union): string`; CLI `bun run sync-extensions [config] [target]`.

- [ ] **Step 1: RED — failing sync tests**

`packages/lsp-proxy/tests/sync-extensions.test.ts`:

```ts
import { describe, expect, it } from "bun:test";

import type { ProxyConfig } from "../src/config.ts";
import { extensionUnion, mergeIntoLspJson } from "../src/sync-extensions.ts";

const CONFIG: ProxyConfig = {
  servers: [
    {
      command: "vtsls",
      extensionToLanguage: { ".ts": "typescript", ".tsx": "typescriptreact" },
      name: "vtsls",
    },
    {
      command: "biome",
      extensionToLanguage: { ".css": "css", ".ts": "typescript" },
      name: "biome",
    },
  ],
};

const TARGET = JSON.stringify({
  "lsp-proxy": {
    args: ["/abs/config.json"],
    command: "lsp-proxy",
    extensionToLanguage: { ".old": "oldlang" },
    maxRestarts: 3,
    transport: "stdio",
  },
});

describe("extensionUnion", () => {
  it("unions server maps", () => {
    expect(extensionUnion(CONFIG)).toEqual({
      ".css": "css",
      ".ts": "typescript",
      ".tsx": "typescriptreact",
    });
  });

  it("throws on a conflicting language for the same extension", () => {
    const conflicting: ProxyConfig = {
      servers: [
        { command: "a", extensionToLanguage: { ".ts": "typescript" }, name: "a" },
        { command: "b", extensionToLanguage: { ".ts": "javascript" }, name: "b" },
      ],
    };
    expect(() => extensionUnion(conflicting)).toThrow(".ts");
  });
});

describe("mergeIntoLspJson", () => {
  it("replaces only extensionToLanguage and preserves every other field", () => {
    const updated = mergeIntoLspJson(TARGET, extensionUnion(CONFIG));
    const parsed = JSON.parse(updated) as Record<string, unknown>;
    const entry = parsed["lsp-proxy"] as Record<string, unknown>;
    expect(entry.args).toEqual(["/abs/config.json"]);
    expect(entry.command).toBe("lsp-proxy");
    expect(entry.maxRestarts).toBe(3);
    expect(entry.transport).toBe("stdio");
    expect(entry.extensionToLanguage).toEqual({
      ".css": "css",
      ".ts": "typescript",
      ".tsx": "typescriptreact",
    });
  });

  it("is idempotent byte-for-byte and biome-formatted", () => {
    const once = mergeIntoLspJson(TARGET, extensionUnion(CONFIG));
    const twice = mergeIntoLspJson(once, extensionUnion(CONFIG));
    expect(twice).toBe(once);
    expect(once.startsWith('{\n  "lsp-proxy": {')).toBe(true);
    expect(once.endsWith("}\n}\n")).toBe(true);
  });

  it("refuses a target without the lsp-proxy entry", () => {
    expect(() => mergeIntoLspJson("{}", {})).toThrow("lsp-proxy");
  });
});
```

- [ ] **Step 2: Run RED**

`bun test` → FAIL (module missing).

- [ ] **Step 3: GREEN — sync implementation**

`packages/lsp-proxy/src/sync-extensions.ts`:

```ts
import { parseArgs } from "node:util";
import process from "node:process";

import { parseConfig, type ProxyConfig } from "./config.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sortedEntries(source: Record<string, string>): Record<string, string> {
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(source).sort()) {
    sorted[key] = source[key];
  }
  return sorted;
}

function stableStringify(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  const innerPad = "  ".repeat(indent + 1);
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    const allPrimitive = value.every((item) => typeof item !== "object" || item === null);
    if (allPrimitive) {
      return `[${value.map((item) => JSON.stringify(item)).join(", ")}]`;
    }
    const items = value.map((item) => `${innerPad}${stableStringify(item, indent + 1)}`);
    return `[\n${items.join(",\n")}\n${pad}]`;
  }
  if (isRecord(value)) {
    const keys = Object.keys(value).sort();
    if (keys.length === 0) {
      return "{}";
    }
    const items = keys.map(
      (key) => `${innerPad}${JSON.stringify(key)}: ${stableStringify(value[key], indent + 1)}`,
    );
    return `{\n${items.join(",\n")}\n${pad}}`;
  }
  return JSON.stringify(value);
}

export function extensionUnion(config: ProxyConfig): Record<string, string> {
  const union: Record<string, string> = {};
  for (const server of config.servers) {
    for (const [extension, language] of Object.entries(server.extensionToLanguage)) {
      const previous = union[extension];
      if (previous !== undefined && previous !== language) {
        throw new Error(
          `extension ${extension} maps to both "${previous}" and "${language}"`,
        );
      }
      union[extension] = language;
    }
  }
  return union;
}

export function mergeIntoLspJson(text: string, union: Record<string, string>): string {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed) || !isRecord(parsed["lsp-proxy"])) {
    throw new Error("target .lsp.json has no lsp-proxy entry");
  }
  const updated = { ...parsed, "lsp-proxy": { ...parsed["lsp-proxy"], extensionToLanguage: sortedEntries(union) } };
  return `${stableStringify(updated)}\n`;
}

const isDirectRun = process.argv[1] !== undefined && process.argv[1].endsWith("sync-extensions.ts");
if (isDirectRun) {
  const { positionals } = parseArgs({
    allowPositionals: true,
    args: process.argv.slice(2),
  });
  const defaultConfig = new URL("../../lsp-proxy.config.json", import.meta.url);
  const defaultTarget = new URL("../../../../plugins/lsp-proxy/.lsp.json", import.meta.url);
  const configPath = positionals[0] ?? defaultConfig.pathname;
  const targetPath = positionals[1] ?? defaultTarget.pathname;
  const parsedConfig = parseConfig(await Bun.file(configPath).json());
  if (!parsedConfig.ok) {
    console.error(parsedConfig.errors.join("\n"));
    process.exit(1);
  }
  try {
    const union = extensionUnion(parsedConfig.config);
    const previous = await Bun.file(targetPath).text();
    await Bun.write(targetPath, mergeIntoLspJson(previous, union));
  } catch (error) {
    console.error(String(error));
    process.exit(1);
  }
}
```

(The default-target URL assumes the repo layout; the real target only exists after Task 14 — until then the CLI errors gracefully when the default target is absent, and tests always pass explicit paths.)

- [ ] **Step 4: GREEN run + battery**

`bun test` → PASS (5 new tests). `rtk proxy biome check packages/lsp-proxy` + `bun check` → clean.

- [ ] **Step 5: STOP POINT — owner commits Task 12.**

---

### Task 14: plugin registration + full battery + acceptance handoff

**Files:**
- Create: `plugins/lsp-proxy/.claude-plugin/plugin.json`, `plugins/lsp-proxy/.lsp.json`, `plugins/lsp-proxy/hooks/hooks.json`, `plugins/lsp-proxy/README.md`
- Possibly modify: `.claude-plugin/marketplace.json` (only if it enumerates non-sdd plugins)

**Interfaces:**
- Consumes: everything above.
- Produces: the registered Claude Code plugin.

- [ ] **Step 1: Read the plugin-manifest convention, then write ours**

Read `plugins/biome-lsp/.claude-plugin/plugin.json` and mirror its shape. Expected content (adjust field-by-field to what the convention shows):

```json
{
  "name": "lsp-proxy"
}
```

- [ ] **Step 2: The minimal `.lsp.json` (D3 — transport only, map generated by D10)**

`plugins/lsp-proxy/.lsp.json` — initial content, then IMMEDIATELY regenerated by the sync command in Step 3:

```json
{
  "lsp-proxy": {
    "args": ["/Users/vasilsokolik/www/cc-sdd/packages/lsp-proxy/lsp-proxy.config.json"],
    "command": "lsp-proxy",
    "extensionToLanguage": {
      ".cjs": "javascript",
      ".css": "css",
      ".js": "javascript",
      ".json": "json",
      ".jsonc": "json",
      ".jsx": "javascriptreact",
      ".mjs": "javascript",
      ".ts": "typescript",
      ".tsx": "typescriptreact"
    },
    "maxRestarts": 3,
    "transport": "stdio"
  }
}
```

- [ ] **Step 3: Generate the map through the real command**

Run: `cd /Users/vasilsokolik/www/cc-sdd/packages/lsp-proxy && bun run sync-extensions /Users/vasilsokolik/www/cc-sdd/packages/lsp-proxy/lsp-proxy.config.json /Users/vasilsokolik/www/cc-sdd/plugins/lsp-proxy/.lsp.json`
Expected: file rewritten; content byte-identical to Step 2's (idempotence proof — the union of the two config maps equals the written map). Run it a second time: zero diff.

- [ ] **Step 4: Plugin README**

`plugins/lsp-proxy/README.md`:

```markdown
# lsp-proxy

One registered LSP for Claude Code that fans out to multiple downstream
stdio LSP servers (vtsls + biome by default) and merges their results:
diagnostics from every server, merged hover/completion/definition,
formatting by config priority.

## What it provides

- **Merged diagnostics** — findings from every downstream server arrive
  as a single server's `publishDiagnostics`.
- **Merged semantic requests** — hover contents joined, completion items
  concatenated, definition/references arrays concatenated.
- **Formatting** — first non-null answer in `lsp-proxy.config.json`
  priority order.

## Requirements

- `bun` on PATH at BUILD time only — the proxy ships as a standalone
  binary (`bun run build-bin` in `packages/lsp-proxy`), written to
  `~/.local/bin/lsp-proxy`.
- Downstream commands resolvable on PATH (verified 2026-10-20:
  `vtsls` → `~/.bun/bin/vtsls`, `biome` → `/opt/homebrew/bin/biome`).

## Maintenance

All downstream configuration — commands, extensions, initialization
options, settings — lives ONLY in
`packages/lsp-proxy/lsp-proxy.config.json` (array order = priority).
After editing it, regenerate the plugin's extension map:

    cd packages/lsp-proxy && bun run sync-extensions

The `.lsp.json` extension map is generated; never edit it by hand.
```

- [ ] **Step 5: Marketplace check**

Read `.claude-plugin/marketplace.json`. If it enumerates plugins beyond `sdd` (i.e., biome-lsp/security-guard appear), add an `lsp-proxy` entry mirroring their shape. If it carries only the `sdd` entry, make no change.

- [ ] **Step 6: SessionEnd hook (D11)**

`plugins/lsp-proxy/hooks/hooks.json` — session-end cleanup runs the built binary; `SessionEnd`'s documented purpose is exactly this, and the command is a fast no-op when the registry is empty:

```json
{
  "description": "Session-end cleanup: terminate every lsp-proxy instance and its downstream servers.",
  "hooks": {
    "SessionEnd": [
      {
        "hooks": [
          {
            "command": "lsp-proxy --kill-all",
            "timeout": 10,
            "type": "command"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 7: Full verification battery (spec §8)**

1. `cd /Users/vasilsokolik/www/cc-sdd && bun test` — full repo, all green.
2. `rtk proxy biome check .` — repo clean (52+ files).
3. `bun check` — no type errors.
4. `claude plugin validate .` — green with the new plugin present.
5. `cd /Users/vasilsokolik/www/cc-sdd/packages/cli-hook && bun run build-bin` — still produces the working cli-hook binary (D9 regression guard).
6. `bun run sync-extensions` — idempotent, `.lsp.json` matches the config union.
7. `~/.local/bin/lsp-proxy --kill-all` — with an empty registry exits 0 instantly (the populated-registry path is proven by Task 11's integration test).

- [ ] **Step 8: Acceptance handoff (owner-run, D1) — STOP POINT**

Agent states readiness; the owner performs the live acceptance:

1. Confirm the Claude Code plugins `biome-lsp` and `vtsls` are disabled (vtsls already disabled 2026-10-20); biome-lsp disable is the owner's action (D2).
2. Enable `plugins/lsp-proxy` (plugin manager or `--plugin-dir`), then `/reload-plugins`.
3. Open a `.ts` file containing one biome-detectable issue and one TypeScript type error → BOTH `<new-diagnostics>` sources must appear.
4. Hover a symbol → vtsls hover text arrives.
5. Close the session → the SessionEnd hook runs `lsp-proxy --kill-all`; verify no orphaned `vtsls`/`biome` processes remain (`pgrep -fl vtsls; pgrep -fl biome`).
6. Owner rules GO/NO-GO, updates bean cc-sdd-hi1x, commits Task 14 (plugin files + hooks + bean).

---

## Post-plan

- The epic bean cc-sdd-hi1x tracks completion; every STOP POINT includes the owner's commit.
- Acceptance findings (e.g. vtsls `workspace/configuration` sections needing real settings) loop back as fix tasks against the relevant module — never inline edits without a test.

import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

import { DocumentStore } from "../../src/docstore.ts";
import type { Downstream } from "../../src/downstream.ts";
import type { JsonRpcMessage } from "../../src/framing.ts";
import { decodeChunks, encodeFrame } from "../../src/framing.ts";
import type { RequestHost } from "../../src/proxy-requests.ts";
import { RequestBroker } from "../../src/proxy-requests.ts";
import type { ProxyHost } from "../../src/proxy-server.ts";
import { waitFor } from "./wait.ts";

const TESTS_DIR = join(import.meta.dir, "..");

export const TS = { ".ts": "typescript" };

export interface HostFixture {
  host: ProxyHost;
  logs: string[];
  servers: Map<string, Downstream>;
}

export function makeHostFixture(
  handlers: {
    dropServer?: (servers: Map<string, Downstream>, server: string) => void;
    replyTo?: (id: unknown, result: unknown) => void;
  } = {},
): HostFixture {
  const logs: string[] = [];
  const servers = new Map<string, Downstream>();
  const requestHost: RequestHost = {
    config: { servers: [] },
    log: (line) => {
      logs.push(line);
    },
    notify: () => undefined,
    replyErrorTo: () => undefined,
    replyTo: handlers.replyTo ?? (() => undefined),
    servers,
  };
  return {
    host: {
      broker: new RequestBroker(requestHost),
      clientParams: {},
      config: { servers: [] },
      docs: new DocumentStore(),
      dropServer: (server) => {
        handlers.dropServer?.(servers, server);
      },
      isStopped: () => false,
      log: (line) => {
        logs.push(line);
      },
      servers,
      write: () => undefined,
    },
    logs,
    servers,
  };
}

export function cleanupTempConfigs(): void {
  for (const entry of readdirSync(TESTS_DIR)) {
    if (entry.startsWith("tmp-config-")) {
      rmSync(join(TESTS_DIR, entry), { force: true });
    }
  }
}

const MAIN = join(import.meta.dir, "..", "..", "src", "main.ts");
const STUB = join(import.meta.dir, "..", "fixtures", "stub-server.ts");

const INITIALIZE = { capabilities: { textDocument: { diagnostic: {} } } };

export interface ProxyHandle {
  clientMessages: JsonRpcMessage[];
  exitCode: () => number | null;
  pid: () => number;
  push: (message: JsonRpcMessage) => void;
  pushRaw: (bytes: Uint8Array) => void;
  stderr: () => string;
  stop: () => Promise<void>;
}

export function startProxy(configPath: string): ProxyHandle {
  const spawned = Bun.spawn({
    cmd: ["bun", MAIN, "--config", configPath],
    stderr: "pipe",
    stdin: "pipe",
    stdout: "pipe",
  });
  const clientMessages: JsonRpcMessage[] = [];
  decodeChunks(
    spawned.stdout,
    (message) => {
      clientMessages.push(message);
    },
    () => undefined,
    () => undefined,
  ).catch(() => undefined);
  let stderrText = "";
  const drainStderr = async (): Promise<void> => {
    for await (const chunk of spawned.stderr) {
      stderrText += new TextDecoder().decode(chunk);
    }
  };
  drainStderr().catch(() => undefined);
  const push = (message: JsonRpcMessage): void => {
    spawned.stdin.write(encodeFrame(message));
    spawned.stdin.flush();
  };
  return {
    clientMessages,
    exitCode: () => spawned.exitCode,
    pid: () => spawned.pid,
    push,
    pushRaw: (bytes) => {
      spawned.stdin.write(bytes);
      spawned.stdin.flush();
    },
    stderr: () => stderrText,
    stop: async () => {
      spawned.stdin.end();
      await waitFor(() => spawned.exitCode !== null).catch(() => undefined);
      spawned.kill("SIGKILL");
    },
  };
}

export async function writeConfig(servers: unknown[]): Promise<string> {
  const path = join(
    import.meta.dir,
    "..",
    `tmp-config-${process.pid}-${Math.floor(Math.random() * 1e6)}.json`,
  );
  await Bun.write(path, JSON.stringify({ servers }));
  return path;
}

export const stub = (
  name: string,
  options: Record<string, unknown>,
  extensions: Record<string, string>,
) => ({
  args: [STUB, name, JSON.stringify(options)],
  command: "bun",
  extensionToLanguage: extensions,
  initializationOptions: {},
  name,
  settings: {},
});

export async function initializeSession(proxy: ProxyHandle): Promise<void> {
  proxy.push({
    id: 1,
    jsonrpc: "2.0",
    method: "initialize",
    params: INITIALIZE,
  });
  await waitFor(() => proxy.clientMessages.some((message) => message.id === 1));
}

export function openDocument(
  proxy: ProxyHandle,
  uri: string,
  languageId: string,
): void {
  proxy.push({
    jsonrpc: "2.0",
    method: "textDocument/didOpen",
    params: { textDocument: { languageId, text: "const x = 1;\n", uri } },
  });
}

export const publications = (proxy: ProxyHandle) =>
  proxy.clientMessages.filter(
    (message) => message.method === "textDocument/publishDiagnostics",
  );

export const diagnosticTexts = (proxy: ProxyHandle) =>
  publications(proxy)
    .map((message) =>
      JSON.stringify(
        (
          message.params as {
            diagnostics: unknown[];
          }
        ).diagnostics,
      ),
    )
    .join("\n");

export async function awaitDiagnostics(
  proxy: ProxyHandle,
  count: number,
): Promise<string> {
  await waitFor(() => publications(proxy).length >= count);
  return diagnosticTexts(proxy);
}

export const responseFor = (proxy: ProxyHandle, id: number) =>
  proxy.clientMessages.find((message) => message.id === id);

export async function request(
  proxy: ProxyHandle,
  message: JsonRpcMessage & { id: number },
  timeoutMs?: number,
): Promise<JsonRpcMessage | undefined> {
  proxy.push(message);
  await waitFor(
    () => proxy.clientMessages.some((candidate) => candidate.id === message.id),
    timeoutMs,
  );
  return responseFor(proxy, message.id);
}

export async function boot(servers: unknown[]): Promise<ProxyHandle> {
  const configPath = await writeConfig(servers);
  const proxy = startProxy(configPath);
  await initializeSession(proxy);
  return proxy;
}

export async function withProxy(
  servers: unknown[],
  run: (proxy: ProxyHandle) => void | Promise<void>,
): Promise<void> {
  const proxy = await boot(servers);
  try {
    await run(proxy);
  } finally {
    await proxy.stop();
  }
}

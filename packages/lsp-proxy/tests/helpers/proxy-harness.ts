import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

import type { JsonRpcMessage } from "../../src/framing.ts";
import { createDecoder, encodeFrame } from "../../src/framing.ts";
import { waitFor } from "./wait.ts";

const TESTS_DIR = join(import.meta.dir, "..");

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
  const decode = createDecoder((message) => {
    clientMessages.push(message);
  });
  const drain = async (
    stream: ReadableStream<Uint8Array>,
    onChunk: (chunk: Uint8Array) => void,
  ): Promise<void> => {
    for await (const chunk of stream) {
      onChunk(chunk);
    }
  };
  drain(spawned.stdout, (chunk) => {
    decode(chunk);
  }).catch(() => undefined);
  let stderrText = "";
  drain(spawned.stderr, (chunk) => {
    stderrText += new TextDecoder().decode(chunk);
  }).catch(() => undefined);
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

export const responseFor = (proxy: ProxyHandle, id: number) =>
  proxy.clientMessages.find((message) => message.id === id);

export async function boot(servers: unknown[]): Promise<ProxyHandle> {
  const configPath = await writeConfig(servers);
  const proxy = startProxy(configPath);
  await initializeSession(proxy);
  return proxy;
}

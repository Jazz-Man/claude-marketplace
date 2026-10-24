import { Buffer } from "node:buffer";
import { writeFileSync } from "node:fs";
import process from "node:process";

import {
  createDecoder,
  encodeFrame,
  HEADER_SEPARATOR,
  type JsonRpcMessage,
} from "../../src/framing.ts";

interface StubDiagnostic {
  message: string;
  severity?: number;
}

interface StubOptions {
  askConfiguration?: boolean;
  badMethodAfterInitialize?: boolean;
  completionItems?: unknown[];
  declareDiagnosticProvider?: boolean;
  diagnostics?: StubDiagnostic[];
  exitMarker?: string;
  exitOnDidOpen?: boolean;
  formatEdits?: unknown[] | null;
  hangInitialize?: boolean;
  hover?: string;
  hoverError?: { code: number; data: unknown; message: string };
  sync?: number;
}

const [name = "stub", rawOptions = "{}"] = process.argv.slice(2);
const options = JSON.parse(rawOptions) as StubOptions;

const { exitMarker } = options;
if (exitMarker !== undefined) {
  process.on("exit", () => {
    writeFileSync(exitMarker, "exited");
  });
}

process.on("SIGTERM", () => {
  process.exit(0);
});

const write = (message: JsonRpcMessage): void => {
  process.stdout.write(encodeFrame(message));
};

const send = (id: number | string | null, result: unknown): void => {
  write({ id, jsonrpc: "2.0", result });
};

const badMethodFrame = (): void => {
  const body = JSON.stringify({ id: null, jsonrpc: "2.0", method: 123 });
  process.stdout.write(
    `Content-Length: ${Buffer.byteLength(body)}${HEADER_SEPARATOR}${body}`,
  );
};

const configuredDiagnostics = (): StubDiagnostic[] =>
  options.diagnostics ?? [{ message: `diag from ${name}` }];

const buildItems = (diagnostics: StubDiagnostic[]): unknown[] =>
  diagnostics.map((diagnostic, index) => ({
    message: diagnostic.message,
    range: {
      end: { character: 0, line: index },
      start: { character: 0, line: index },
    },
    severity: diagnostic.severity ?? 1,
  }));

const publish = (uri: string): void => {
  write({
    jsonrpc: "2.0",
    method: "textDocument/publishDiagnostics",
    params: { diagnostics: buildItems(configuredDiagnostics()), uri },
  });
};

let nextId = 1;
let pendingConfigId: number | undefined;
let pendingConfigUri = "";

const resolveConfiguration = (message: JsonRpcMessage): void => {
  if (message.id !== undefined && message.id === pendingConfigId) {
    pendingConfigId = undefined;
    publish(pendingConfigUri);
  }
};

const initialize = (message: JsonRpcMessage): void => {
  if (options.hangInitialize === true) {
    return;
  }
  const capabilities: Record<string, unknown> = {
    completionProvider: true,
    documentFormattingProvider: true,
    hoverProvider: true,
    textDocumentSync: options.sync ?? 2,
  };
  if (options.declareDiagnosticProvider === true) {
    capabilities.diagnosticProvider = {
      interFileDependencies: false,
      workspaceDiagnostics: false,
    };
  }
  send(message.id ?? null, { capabilities, serverInfo: { name } });
  if (options.badMethodAfterInitialize === true) {
    badMethodFrame();
  }
};

const answerDiagnosticPull = (message: JsonRpcMessage): void => {
  send(message.id ?? null, {
    items: buildItems(configuredDiagnostics()),
    kind: "full",
  });
};

const openDocument = (message: JsonRpcMessage): void => {
  const params = message.params as { textDocument: { uri: string } };
  const { uri } = params.textDocument;
  if (options.exitOnDidOpen === true) {
    process.exit(17);
  }
  if (options.declareDiagnosticProvider === true) {
    return;
  }
  if (options.askConfiguration === true) {
    const id = nextId;
    nextId += 1;
    pendingConfigUri = uri;
    pendingConfigId = id;
    write({
      id,
      jsonrpc: "2.0",
      method: "workspace/configuration",
      params: { items: [{ section: "" }] },
    });
    return;
  }
  publish(uri);
};

const hoverDocument = (message: JsonRpcMessage): void => {
  if (options.hoverError !== undefined) {
    write({
      error: options.hoverError,
      id: message.id ?? null,
      jsonrpc: "2.0",
    });
    return;
  }
  if (options.hover === undefined) {
    send(message.id ?? null, null);
    return;
  }
  send(message.id ?? null, {
    contents: { kind: "markdown", value: `${name}: ${options.hover}` },
  });
};

const formatDocument = (message: JsonRpcMessage): void => {
  if (options.formatEdits === null) {
    send(message.id ?? null, null);
    return;
  }
  send(message.id ?? null, options.formatEdits ?? []);
};

const decode = createDecoder((message) => {
  if (message.method === undefined) {
    resolveConfiguration(message);
    return;
  }
  if (message.method === "initialize") {
    initialize(message);
    return;
  }
  if (message.method === "textDocument/didOpen") {
    openDocument(message);
    return;
  }
  if (message.method === "textDocument/hover") {
    hoverDocument(message);
    return;
  }
  if (message.method === "textDocument/diagnostic") {
    answerDiagnosticPull(message);
    return;
  }
  if (message.method === "textDocument/completion") {
    send(message.id ?? null, {
      isIncomplete: false,
      items: options.completionItems ?? [],
    });
    return;
  }
  if (message.method === "textDocument/formatting") {
    formatDocument(message);
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
  decode(chunk);
}

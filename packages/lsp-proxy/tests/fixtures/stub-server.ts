import { writeFileSync } from "node:fs";
import process from "node:process";

import {
  createDecoder,
  encodeFrame,
  type JsonRpcMessage,
} from "../../src/framing.ts";

interface StubDiagnostic {
  message: string;
  severity?: number;
}

interface StubOptions {
  askConfiguration?: boolean;
  completionItems?: unknown[];
  diagnostics?: StubDiagnostic[];
  exitMarker?: string;
  exitOnDidOpen?: boolean;
  formatEdits?: unknown[] | null;
  hover?: string;
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

const publish = (uri: string): void => {
  const diagnostics = options.diagnostics ?? [{ message: `diag from ${name}` }];
  write({
    jsonrpc: "2.0",
    method: "textDocument/publishDiagnostics",
    params: {
      diagnostics: diagnostics.map((diagnostic, index) => ({
        message: diagnostic.message,
        range: {
          end: { character: 0, line: index },
          start: { character: 0, line: index },
        },
        severity: diagnostic.severity ?? 1,
      })),
      uri,
    },
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
  send(message.id ?? null, {
    capabilities: {
      completionProvider: true,
      documentFormattingProvider: true,
      hoverProvider: true,
      textDocumentSync: options.sync ?? 2,
    },
    serverInfo: { name },
  });
};

const openDocument = (message: JsonRpcMessage): void => {
  const params = message.params as { textDocument: { uri: string } };
  const { uri } = params.textDocument;
  if (options.exitOnDidOpen === true) {
    process.exit(17);
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

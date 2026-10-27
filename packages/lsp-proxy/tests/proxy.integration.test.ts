import { afterEach, describe, expect, it } from "bun:test";
import { HEADER_SEPARATOR } from "../src/framing.ts";
import {
  awaitDiagnostics,
  cleanupTempConfigs,
  diagnosticTexts,
  initializeSession,
  openDocument,
  type ProxyHandle,
  publications,
  request,
  responseFor,
  startProxy,
  stub,
  TS,
  withProxy,
  writeConfig,
} from "./helpers/proxy-harness.ts";
import { waitFor } from "./helpers/wait.ts";

afterEach(cleanupTempConfigs);

const sampleRequest = (
  proxy: ProxyHandle,
  id: number,
  method: string,
  params?: unknown,
) => request(proxy, { id, jsonrpc: "2.0", method, params });

describe("client session", () => {
  it("initialize: merges capabilities from both stubs", async () => {
    await withProxy([stub("alpha", {}, TS), stub("beta", {}, TS)], (proxy) => {
      const response = responseFor(proxy, 1);
      expect(response?.result).toMatchObject({
        capabilities: {
          completionProvider: true,
          hoverProvider: true,
          textDocumentSync: 2,
        },
        serverInfo: { name: "lsp-proxy" },
      });
    });
  });

  it("robustness: survives garbage bytes and processes the next valid frame", async () => {
    const configPath = await writeConfig([
      stub("alpha", {}, TS),
      stub("beta", {}, TS),
    ]);
    const proxy = startProxy(configPath);
    proxy.pushRaw(
      new TextEncoder().encode(`garbage without any header${HEADER_SEPARATOR}`),
    );
    await initializeSession(proxy);
    const response = responseFor(proxy, 1);
    expect(response?.result).toMatchObject({
      capabilities: { textDocumentSync: 2 },
      serverInfo: { name: "lsp-proxy" },
    });
    await proxy.stop();
  });

  it("shutdown: replies null to shutdown and exits 0 on the exit notification", async () => {
    await withProxy(
      [stub("alpha", {}, TS), stub("beta", {}, TS)],
      async (proxy) => {
        const response = await sampleRequest(proxy, 2, "shutdown");
        expect(response?.result).toBeNull();
        proxy.push({ jsonrpc: "2.0", method: "exit" });
        await waitFor(() => proxy.exitCode() === 0);
      },
    );
  });
});

describe("document fan-out", () => {
  it("fan-out: delivers diagnostics from both stubs for a .ts document", async () => {
    await withProxy(
      [stub("alpha", {}, TS), stub("beta", {}, TS)],
      async (proxy) => {
        openDocument(proxy, "file:///proj/sample.ts", "typescript");
        const texts = await awaitDiagnostics(proxy, 2);
        expect(texts).toContain("diag from alpha");
        expect(texts).toContain("diag from beta");
      },
    );
  });

  it("routing: delivers didOpen of a .json document only to its owning stub", async () => {
    await withProxy(
      [stub("alpha", {}, TS), stub("beta", {}, { ".json": "json" })],
      async (proxy) => {
        openDocument(proxy, "file:///proj/sample.json", "json");
        await awaitDiagnostics(proxy, 1);
        expect(publications(proxy).length).toBe(1);
        const texts = diagnosticTexts(proxy);
        expect(texts).toContain("diag from beta");
        expect(texts).not.toContain("diag from alpha");
      },
    );
  });
});

describe("merged requests", () => {
  it("hover: merges contents from both stubs", async () => {
    await withProxy(
      [
        stub("alpha", { hover: "stuff" }, TS),
        stub("beta", { hover: "stuff" }, TS),
      ],
      async (proxy) => {
        const response = await sampleRequest(proxy, 2, "textDocument/hover", {
          textDocument: { uri: "file:///proj/sample.ts" },
        });
        expect(response?.result).toEqual({
          contents: { kind: "markdown", value: "alpha: stuff\n\nbeta: stuff" },
        });
      },
    );
  });

  it("completion: concatenates items from both stubs in priority order", async () => {
    await withProxy(
      [
        stub(
          "alpha",
          { completionItems: [{ label: "a1" }, { label: "a2" }] },
          TS,
        ),
        stub("beta", { completionItems: [{ label: "b1" }] }, TS),
      ],
      async (proxy) => {
        const response = await sampleRequest(
          proxy,
          2,
          "textDocument/completion",
          { textDocument: { uri: "file:///proj/sample.ts" } },
        );
        expect(response?.result).toEqual({
          isIncomplete: false,
          items: [{ label: "a1" }, { label: "a2" }, { label: "b1" }],
        });
      },
    );
  });
});

describe("sequential requests", () => {
  it("formatting: asks servers sequentially and returns the first non-null edits", async () => {
    const edits = [
      {
        range: {
          end: { character: 12, line: 0 },
          start: { character: 0, line: 0 },
        },
        text: "formatted",
      },
    ];
    await withProxy(
      [
        stub("p1", { formatEdits: null }, TS),
        stub("p2", { formatEdits: edits }, TS),
      ],
      async (proxy) => {
        const response = await sampleRequest(
          proxy,
          2,
          "textDocument/formatting",
          {
            options: { insertSpaces: true, tabSize: 4 },
            textDocument: { uri: "file:///proj/sample.ts" },
          },
        );
        expect(response?.result).toEqual(edits);
      },
    );
  });
});

describe("cancellation", () => {
  it("cancellation: survives $/cancelRequest for a hover and keeps answering", async () => {
    await withProxy(
      [
        stub("alpha", { hover: "stuff" }, TS),
        stub("beta", { hover: "stuff" }, TS),
      ],
      async (proxy) => {
        const hoverParams = { textDocument: { uri: "file:///proj/sample.ts" } };
        proxy.push({
          id: 2,
          jsonrpc: "2.0",
          method: "textDocument/hover",
          params: hoverParams,
        });
        proxy.push({
          jsonrpc: "2.0",
          method: "$/cancelRequest",
          params: { id: 2 },
        });
        await waitFor(() =>
          proxy.clientMessages.some((message) => message.id === 2),
        );
        const result = (
          await sampleRequest(proxy, 3, "textDocument/hover", hoverParams)
        )?.result;
        if (result === undefined) {
          throw new Error("no reply for the post-cancel hover");
        }
        const { value } = (result as { contents: { value: string } }).contents;
        expect(value).toContain("alpha:");
        expect(value).toContain("beta:");
      },
    );
  });
});

describe("supervision", () => {
  it("respawn: respawns a crashed server and replays open documents", async () => {
    await withProxy(
      [stub("alpha", { exitOnDidOpen: true }, TS), stub("beta", {}, TS)],
      async (proxy) => {
        openDocument(proxy, "file:///proj/sample.ts", "typescript");
        // The replayed didOpen is the only message that can kill the respawned
        // alpha a second time, so "a second time; giving up" on the supervision
        // log proves respawn + replay both happened.
        await waitFor(() =>
          proxy.stderr().includes("a second time; giving up"),
        );
        openDocument(proxy, "file:///proj/other.ts", "typescript");
        await awaitDiagnostics(proxy, 2);
        expect(publications(proxy).length).toBe(2);
        const texts = diagnosticTexts(proxy);
        expect(texts).toContain("diag from beta");
        expect(texts).not.toContain("diag from alpha");
        expect(proxy.stderr()).toContain("died (17); respawning");
      },
    );
  });
});

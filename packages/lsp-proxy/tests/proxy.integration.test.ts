import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { HEADER_SEPARATOR } from "../src/framing.ts";
import {
  boot,
  cleanupTempConfigs,
  diagnosticTexts,
  initializeSession,
  openDocument,
  publications,
  responseFor,
  startProxy,
  stub,
  writeConfig,
} from "./helpers/proxy-harness.ts";
import { waitFor } from "./helpers/wait.ts";

afterEach(cleanupTempConfigs);

const TS = { ".ts": "typescript" };

describe("client session", () => {
  it("initialize: merges capabilities from both stubs", async () => {
    const proxy = await boot([stub("alpha", {}, TS), stub("beta", {}, TS)]);
    const response = responseFor(proxy, 1);
    expect(response?.result).toMatchObject({
      capabilities: {
        completionProvider: true,
        hoverProvider: true,
        textDocumentSync: 2,
      },
      serverInfo: { name: "lsp-proxy" },
    });
    await proxy.stop();
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
    const proxy = await boot([stub("alpha", {}, TS), stub("beta", {}, TS)]);
    proxy.push({ id: 2, jsonrpc: "2.0", method: "shutdown" });
    await waitFor(() =>
      proxy.clientMessages.some((message) => message.id === 2),
    );
    const response = responseFor(proxy, 2);
    expect(response?.result).toBeNull();
    proxy.push({ jsonrpc: "2.0", method: "exit" });
    await waitFor(() => proxy.exitCode() === 0);
    await proxy.stop();
  });
});

describe("document fan-out", () => {
  it("fan-out: delivers diagnostics from both stubs for a .ts document", async () => {
    const proxy = await boot([stub("alpha", {}, TS), stub("beta", {}, TS)]);
    openDocument(proxy, "file:///proj/sample.ts", "typescript");
    await waitFor(() => publications(proxy).length >= 2);
    const texts = diagnosticTexts(proxy);
    expect(texts).toContain("diag from alpha");
    expect(texts).toContain("diag from beta");
    await proxy.stop();
  });

  it("routing: delivers didOpen of a .json document only to its owning stub", async () => {
    const proxy = await boot([
      stub("alpha", {}, TS),
      stub("beta", {}, { ".json": "json" }),
    ]);
    openDocument(proxy, "file:///proj/sample.json", "json");
    await waitFor(() => publications(proxy).length > 0);
    expect(publications(proxy).length).toBe(1);
    const texts = diagnosticTexts(proxy);
    expect(texts).toContain("diag from beta");
    expect(texts).not.toContain("diag from alpha");
    await proxy.stop();
  });
});

describe("merged requests", () => {
  it("hover: merges contents from both stubs", async () => {
    const proxy = await boot([
      stub("alpha", { hover: "stuff" }, TS),
      stub("beta", { hover: "stuff" }, TS),
    ]);
    proxy.push({
      id: 2,
      jsonrpc: "2.0",
      method: "textDocument/hover",
      params: { textDocument: { uri: "file:///proj/sample.ts" } },
    });
    await waitFor(() =>
      proxy.clientMessages.some((message) => message.id === 2),
    );
    const response = responseFor(proxy, 2);
    expect(response?.result).toEqual({
      contents: { kind: "markdown", value: "alpha: stuff\n\nbeta: stuff" },
    });
    await proxy.stop();
  });

  it("completion: concatenates items from both stubs in priority order", async () => {
    const proxy = await boot([
      stub(
        "alpha",
        { completionItems: [{ label: "a1" }, { label: "a2" }] },
        TS,
      ),
      stub("beta", { completionItems: [{ label: "b1" }] }, TS),
    ]);
    proxy.push({
      id: 2,
      jsonrpc: "2.0",
      method: "textDocument/completion",
      params: { textDocument: { uri: "file:///proj/sample.ts" } },
    });
    await waitFor(() =>
      proxy.clientMessages.some((message) => message.id === 2),
    );
    const response = responseFor(proxy, 2);
    expect(response?.result).toEqual({
      isIncomplete: false,
      items: [{ label: "a1" }, { label: "a2" }, { label: "b1" }],
    });
    await proxy.stop();
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
    const proxy = await boot([
      stub("p1", { formatEdits: null }, TS),
      stub("p2", { formatEdits: edits }, TS),
    ]);
    proxy.push({
      id: 2,
      jsonrpc: "2.0",
      method: "textDocument/formatting",
      params: {
        options: { insertSpaces: true, tabSize: 4 },
        textDocument: { uri: "file:///proj/sample.ts" },
      },
    });
    await waitFor(() =>
      proxy.clientMessages.some((message) => message.id === 2),
    );
    const response = responseFor(proxy, 2);
    expect(response?.result).toEqual(edits);
    await proxy.stop();
  });
});

describe("cancellation", () => {
  it("cancellation: survives $/cancelRequest for a hover and keeps answering", async () => {
    const proxy = await boot([
      stub("alpha", { hover: "stuff" }, TS),
      stub("beta", { hover: "stuff" }, TS),
    ]);
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
    proxy.push({
      id: 3,
      jsonrpc: "2.0",
      method: "textDocument/hover",
      params: hoverParams,
    });
    await waitFor(() =>
      proxy.clientMessages.some((message) => message.id === 3),
    );
    const result = responseFor(proxy, 3)?.result;
    if (result === undefined) {
      throw new Error("no reply for the post-cancel hover");
    }
    const { value } = (result as { contents: { value: string } }).contents;
    expect(value).toContain("alpha:");
    expect(value).toContain("beta:");
    await proxy.stop();
  });
});

describe("supervision", () => {
  it("respawn: respawns a crashed server and replays open documents", async () => {
    const proxy = await boot([
      stub("alpha", { exitOnDidOpen: true }, TS),
      stub("beta", {}, TS),
    ]);
    openDocument(proxy, "file:///proj/sample.ts", "typescript");
    // The replayed didOpen is the only message that can kill the respawned
    // alpha a second time, so "a second time; giving up" on the supervision
    // log proves respawn + replay both happened.
    await waitFor(() => proxy.stderr().includes("a second time; giving up"));
    openDocument(proxy, "file:///proj/other.ts", "typescript");
    await waitFor(() => publications(proxy).length >= 2);
    expect(publications(proxy).length).toBe(2);
    const texts = diagnosticTexts(proxy);
    expect(texts).toContain("diag from beta");
    expect(texts).not.toContain("diag from alpha");
    expect(proxy.stderr()).toContain("died (17); respawning");
    await proxy.stop();
  });

  it("D6: boots a full-sync server beside an incremental one", async () => {
    const proxy = await boot([
      stub("legacy", { sync: 1 }, TS),
      stub("good", {}, TS),
    ]);
    expect(proxy.stderr()).not.toContain("rejecting server legacy");
    openDocument(proxy, "file:///proj/sample.ts", "typescript");
    await waitFor(() => publications(proxy).length >= 2);
    const texts = diagnosticTexts(proxy);
    expect(texts).toContain("diag from good");
    expect(texts).toContain("diag from legacy");
    await proxy.stop();
  });
});

describe("configuration", () => {
  it("configuration: answers the stub's workspace/configuration without forwarding", async () => {
    const proxy = await boot([
      {
        ...stub("curious", { askConfiguration: true }, TS),
        settings: { flag: 1 },
      },
    ]);
    openDocument(proxy, "file:///proj/sample.ts", "typescript");
    await waitFor(() => publications(proxy).length > 0);
    const forwarded = proxy.clientMessages.some(
      (message) => message.method === "workspace/configuration",
    );
    expect(forwarded).toBe(false);
    const texts = diagnosticTexts(proxy);
    expect(texts).toContain("diag from curious");
    await proxy.stop();
  });
});

describe("teardown", () => {
  it("teardown: cascades SIGTERM to children, which write their exit markers", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lsp-proxy-teardown-"));
    try {
      const markerA = join(dir, "alpha.txt");
      const markerB = join(dir, "beta.txt");
      const proxy = await boot([
        stub("alpha", { exitMarker: markerA }, TS),
        stub("beta", { exitMarker: markerB }, TS),
      ]);
      // Boot proof first: the boot() initialize round-trip shows the stubs
      // finished module evaluation, so TERM reaches running servers.
      process.kill(proxy.pid(), "SIGTERM");
      await waitFor(() => proxy.exitCode() === 0);
      await waitFor(() => existsSync(markerA) && existsSync(markerB));
      expect(readFileSync(markerA, "utf8")).toBe("exited");
      expect(readFileSync(markerB, "utf8")).toBe("exited");
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });
});

import { describe, expect, it } from "bun:test";

import {
  boot,
  openDocument,
  type ProxyHandle,
  publications,
  stub,
} from "./helpers/proxy-harness.ts";
import { waitFor } from "./helpers/wait.ts";

const TS = { ".ts": "typescript" };

const CHANGE_PARAMS = {
  contentChanges: [
    {
      range: {
        end: { character: 11, line: 0 },
        start: { character: 6, line: 0 },
      },
      text: "y = 42",
    },
  ],
  textDocument: { uri: "file:///proj/sample.ts", version: 3 },
};

const echoes = (proxy: ProxyHandle) =>
  publications(proxy).map((message) => {
    const params = message.params as { diagnostics: { message: string }[] };
    return JSON.parse(params.diagnostics[0]?.message ?? "{}") as {
      method: string;
      name: string;
      params: unknown;
    };
  });

const bootEchoPair = async (): Promise<ProxyHandle> =>
  boot([
    stub("full1", { echoDocuments: true, sync: 1 }, TS),
    stub("delta", { echoDocuments: true }, TS),
  ]);

describe("full-sync adaptation", () => {
  it("didOpen: forwards the original frame to full-sync and incremental stubs alike", async () => {
    const proxy = await bootEchoPair();
    expect(proxy.stderr()).not.toContain("rejecting server full1");
    openDocument(proxy, "file:///proj/sample.ts", "typescript");
    await waitFor(() => echoes(proxy).length >= 2);
    for (const echo of echoes(proxy)) {
      expect(echo.method).toBe("textDocument/didOpen");
      expect(echo.params).toEqual({
        textDocument: {
          languageId: "typescript",
          text: "const x = 1;\n",
          uri: "file:///proj/sample.ts",
        },
      });
    }
    await proxy.stop();
  });

  it("didChange: full-sync stub gets the applied full text", async () => {
    const proxy = await bootEchoPair();
    openDocument(proxy, "file:///proj/sample.ts", "typescript");
    await waitFor(() => echoes(proxy).length >= 2);
    proxy.push({
      jsonrpc: "2.0",
      method: "textDocument/didChange",
      params: CHANGE_PARAMS,
    });
    await waitFor(() => echoes(proxy).length >= 4);
    const byName = new Map(
      echoes(proxy)
        .slice(2)
        .map((echo) => [echo.name, echo]),
    );
    expect(byName.get("full1")?.params).toEqual({
      contentChanges: [{ text: "const y = 42;\n" }],
      textDocument: { uri: "file:///proj/sample.ts", version: 3 },
    });
    await proxy.stop();
  });

  it("didChange: incremental stub gets the client delta verbatim", async () => {
    const proxy = await bootEchoPair();
    openDocument(proxy, "file:///proj/sample.ts", "typescript");
    await waitFor(() => echoes(proxy).length >= 2);
    proxy.push({
      jsonrpc: "2.0",
      method: "textDocument/didChange",
      params: CHANGE_PARAMS,
    });
    await waitFor(() => echoes(proxy).length >= 4);
    const byName = new Map(
      echoes(proxy)
        .slice(2)
        .map((echo) => [echo.name, echo]),
    );
    expect(byName.get("delta")?.params).toEqual(CHANGE_PARAMS);
    await proxy.stop();
  });
});

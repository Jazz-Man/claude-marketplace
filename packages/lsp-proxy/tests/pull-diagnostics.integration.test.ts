import { afterEach, describe, expect, it } from "bun:test";

import {
  awaitDiagnostics,
  cleanupTempConfigs,
  diagnosticTexts,
  openDocument,
  publications,
  stub,
  TS,
  withProxy,
} from "./helpers/proxy-harness.ts";

afterEach(cleanupTempConfigs);

describe("pull diagnostics", () => {
  it("pull: auto-detects diagnosticProvider and synthesizes publishDiagnostics from the pull reply", async () => {
    await withProxy(
      [
        stub(
          "puller",
          {
            declareDiagnosticProvider: true,
            diagnostics: [{ message: "pull diag", severity: 1 }],
          },
          TS,
        ),
        stub("pusher", {}, TS),
      ],
      async (proxy) => {
        openDocument(proxy, "file:///proj/sample.ts", "typescript");
        await awaitDiagnostics(proxy, 2);
        expect(publications(proxy).length).toBe(2);
        const pulled = publications(proxy).find((message) => {
          const params = message.params as {
            diagnostics: Array<{ message: string }>;
          };
          return params.diagnostics.some(
            (diagnostic) => diagnostic.message === "pull diag",
          );
        });
        expect(pulled?.params).toEqual({
          diagnostics: [
            {
              message: "pull diag",
              range: {
                end: { character: 0, line: 0 },
                start: { character: 0, line: 0 },
              },
              severity: 1,
            },
          ],
          uri: "file:///proj/sample.ts",
        });
        expect(diagnosticTexts(proxy)).toContain("diag from pusher");
      },
    );
  });
});

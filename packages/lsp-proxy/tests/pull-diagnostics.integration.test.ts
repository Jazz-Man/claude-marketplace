import { afterEach, describe, expect, it } from "bun:test";

import {
  boot,
  cleanupTempConfigs,
  diagnosticTexts,
  openDocument,
  publications,
  stub,
} from "./helpers/proxy-harness.ts";
import { waitFor } from "./helpers/wait.ts";

afterEach(cleanupTempConfigs);

const TS = { ".ts": "typescript" };

describe("pull diagnostics", () => {
  it("pull: auto-detects diagnosticProvider and synthesizes publishDiagnostics from the pull reply", async () => {
    const proxy = await boot([
      stub(
        "puller",
        {
          declareDiagnosticProvider: true,
          diagnostics: [{ message: "pull diag", severity: 1 }],
        },
        TS,
      ),
      stub("pusher", {}, TS),
    ]);
    openDocument(proxy, "file:///proj/sample.ts", "typescript");
    await waitFor(() => publications(proxy).length >= 2);
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
    await proxy.stop();
  });
});

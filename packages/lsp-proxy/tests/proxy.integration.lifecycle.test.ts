import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import {
  awaitDiagnostics,
  boot,
  cleanupTempConfigs,
  diagnosticTexts,
  openDocument,
  stub,
  TS,
  withProxy,
} from "./helpers/proxy-harness.ts";
import { waitFor } from "./helpers/wait.ts";

afterEach(cleanupTempConfigs);

describe("supervision", () => {
  it("D6: boots a full-sync server beside an incremental one", async () => {
    await withProxy(
      [stub("legacy", { sync: 1 }, TS), stub("good", {}, TS)],
      async (proxy) => {
        expect(proxy.stderr()).not.toContain("rejecting server legacy");
        openDocument(proxy, "file:///proj/sample.ts", "typescript");
        const texts = await awaitDiagnostics(proxy, 2);
        expect(texts).toContain("diag from good");
        expect(texts).toContain("diag from legacy");
      },
    );
  });
});

describe("configuration", () => {
  it("configuration: answers the stub's workspace/configuration without forwarding", async () => {
    await withProxy(
      [
        {
          ...stub("curious", { askConfiguration: true }, TS),
          settings: { flag: 1 },
        },
      ],
      async (proxy) => {
        openDocument(proxy, "file:///proj/sample.ts", "typescript");
        await awaitDiagnostics(proxy, 1);
        const forwarded = proxy.clientMessages.some(
          (message) => message.method === "workspace/configuration",
        );
        expect(forwarded).toBe(false);
        const texts = diagnosticTexts(proxy);
        expect(texts).toContain("diag from curious");
      },
    );
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

import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  awaitDiagnostics,
  boot,
  cleanupTempConfigs,
  openDocument,
  publications,
  request,
  stub,
  TS,
} from "./helpers/proxy-harness.ts";
import { waitFor } from "./helpers/wait.ts";

afterEach(cleanupTempConfigs);

const gated = {
  ...stub("gated", {}, TS),
  configFiles: ["biome.json", "biome.jsonc"],
};
const plain = stub("plain", {}, TS);

async function withRoot(
  marker: string | undefined,
  run: (root: string) => Promise<void>,
): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), "lsp-proxy-activation-"));
  if (marker !== undefined) {
    writeFileSync(join(root, marker), "{}");
  }
  try {
    await run(root);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

describe("configFiles activation", () => {
  it("never starts a server whose config files are missing from the project root", async () => {
    await withRoot(undefined, async (root) => {
      const proxy = await boot([gated, plain], root);
      try {
        await waitFor(() =>
          proxy.stderr().includes("server gated: not started"),
        );
        openDocument(proxy, "file:///proj/sample.ts", "typescript");
        const texts = await awaitDiagnostics(proxy, 1);
        expect(texts).toContain("diag from plain");
        await Bun.sleep(200);
        expect(publications(proxy)).toHaveLength(1);
        expect(proxy.stderr()).not.toContain("spawned gated");
      } finally {
        await proxy.stop();
      }
    });
  }, 20_000);

  it("starts a gated server once the root holds one of its config files", async () => {
    await withRoot("biome.jsonc", async (root) => {
      const proxy = await boot([gated, plain], root);
      try {
        openDocument(proxy, "file:///proj/sample.ts", "typescript");
        const texts = await awaitDiagnostics(proxy, 2);
        expect(texts).toContain("diag from plain");
        expect(texts).toContain("diag from gated");
      } finally {
        await proxy.stop();
      }
    });
  }, 20_000);

  it("answers the client when every server is inactive", async () => {
    await withRoot(undefined, async (root) => {
      const proxy = await boot([gated], root);
      try {
        openDocument(proxy, "file:///proj/sample.ts", "typescript");
        const response = await request(proxy, {
          id: 2,
          jsonrpc: "2.0",
          method: "textDocument/hover",
          params: { textDocument: { uri: "file:///proj/sample.ts" } },
        });
        expect(response?.result).toBeNull();
      } finally {
        await proxy.stop();
      }
    });
  }, 20_000);
});

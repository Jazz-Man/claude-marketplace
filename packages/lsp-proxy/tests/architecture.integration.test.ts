import { afterEach, describe, expect, it } from "bun:test";
import { join } from "node:path";

import {
  boot,
  cleanupTempConfigs,
  request,
  stub,
  writeConfig,
} from "./helpers/proxy-harness.ts";
import { waitFor } from "./helpers/wait.ts";

afterEach(cleanupTempConfigs);

const MAIN = join(import.meta.dir, "..", "src", "main.ts");
const TS = { ".ts": "typescript" };

describe("architecture", () => {
  it("regression pin: client stdin close exits 0", async () => {
    const configPath = await writeConfig([stub("plain", {}, TS)]);
    const spawned = Bun.spawn({
      cmd: ["bun", MAIN, "--config", configPath],
      stderr: "ignore",
      stdin: "pipe",
      stdout: "ignore",
    });
    spawned.stdin.end();
    await waitFor(() => spawned.exitCode === 0, 5000);
    expect(spawned.exitCode).toBe(0);
  }, 10_000);

  it("forwards hover error data from the server to the client", async () => {
    const proxy = await boot([
      stub(
        "errhover",
        { hoverError: { code: -32_603, data: { hint: "x" }, message: "boom" } },
        TS,
      ),
    ]);
    const response = await request(proxy, {
      id: 2,
      jsonrpc: "2.0",
      method: "textDocument/hover",
      params: { textDocument: { uri: "file:///proj/e.ts" } },
    });
    expect(response?.error?.code).toBe(-32_603);
    expect(response?.error?.message).toBe("boom");
    expect(response?.error?.data).toEqual({ hint: "x" });
    await proxy.stop();
  }, 20_000);
});

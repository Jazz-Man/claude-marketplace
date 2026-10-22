import { afterEach, describe, expect, it } from "bun:test";

import { LspErrorCode } from "../src/constants/index.ts";
import {
  boot,
  cleanupTempConfigs,
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

describe("initialize failure", () => {
  it("spawn failure: replies an internal error to the client instead of hanging", async () => {
    const configPath = await writeConfig([
      {
        command: "definitely-not-a-command",
        extensionToLanguage: TS,
        name: "broken",
      },
    ]);
    const proxy = startProxy(configPath);
    proxy.push({
      id: 1,
      jsonrpc: "2.0",
      method: "initialize",
      params: { capabilities: {} },
    });
    await waitFor(() =>
      proxy.clientMessages.some((message) => message.id === 1),
    );
    const response = responseFor(proxy, 1);
    expect(response?.error?.code).toBe(LspErrorCode.InternalError);
    expect(response?.error?.message).toContain("failed to start servers");
    await proxy.stop();
  }, 20_000);

  it("boot hang: a silent server's initialize wait times out and errors to the client", async () => {
    const configPath = await writeConfig([
      stub("silent", { hangInitialize: true }, TS),
    ]);
    const proxy = startProxy(configPath);
    proxy.push({
      id: 1,
      jsonrpc: "2.0",
      method: "initialize",
      params: { capabilities: {} },
    });
    await waitFor(
      () => proxy.clientMessages.some((message) => message.id === 1),
      35_000,
    );
    const response = responseFor(proxy, 1);
    expect(response?.error?.code).toBe(LspErrorCode.InternalError);
    expect(response?.error?.message).toContain("initialize timeout");
    await proxy.stop();
  }, 40_000);

  it("server-loop isolation: a throwing server frame does not kill the read loop", async () => {
    const proxy = await boot([
      stub("noisy", { badMethodAfterInitialize: true }, TS),
    ]);
    openDocument(proxy, "file:///proj/noisy.ts", "typescript");
    await waitFor(() => publications(proxy).length > 0);
    expect(proxy.stderr()).toContain("message dispatch error");
    await proxy.stop();
  }, 20_000);
});

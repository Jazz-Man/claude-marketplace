import { afterEach, describe, expect, it } from "bun:test";
import process from "node:process";

import { LspErrorCode } from "../src/constants/index.ts";
import {
  boot,
  cleanupTempConfigs,
  openDocument,
  type ProxyHandle,
  publications,
  responseFor,
  startProxy,
  stub,
  writeConfig,
} from "./helpers/proxy-harness.ts";
import { waitFor } from "./helpers/wait.ts";

afterEach(cleanupTempConfigs);

const TS = { ".ts": "typescript" };

const SPAWNED_LINE = /spawned (\S+) pid=(\d+)/gu;

const spawnedPids = (stderr: string, name: string): number[] => {
  const pids: number[] = [];
  for (const match of stderr.matchAll(SPAWNED_LINE)) {
    if (match[1] === name) {
      pids.push(Number(match[2]));
    }
  }
  return pids;
};

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const BROKEN = {
  command: "definitely-not-a-command",
  extensionToLanguage: TS,
  name: "broken",
};

const pushInitialize = (proxy: ProxyHandle, id: number): void => {
  proxy.push({
    id,
    jsonrpc: "2.0",
    method: "initialize",
    params: { capabilities: {} },
  });
};

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

describe("transactional boot", () => {
  it("mixed boot: drops the healthy child when a sibling fails to spawn", async () => {
    const configPath = await writeConfig([stub("healthy", {}, TS), BROKEN]);
    const proxy = startProxy(configPath);
    pushInitialize(proxy, 1);
    await waitFor(() =>
      proxy.clientMessages.some((message) => message.id === 1),
    );
    expect(responseFor(proxy, 1)?.error?.code).toBe(LspErrorCode.InternalError);
    const pid = spawnedPids(proxy.stderr(), "healthy").at(0);
    expect(pid).toBeDefined();
    if (pid === undefined) {
      throw new Error("expected one healthy spawn on stderr");
    }
    await waitFor(() => !isAlive(pid), 5000);
    await proxy.stop();
  }, 15_000);

  it("failed boot: shutdown still receives a null reply", async () => {
    const configPath = await writeConfig([BROKEN]);
    const proxy = startProxy(configPath);
    pushInitialize(proxy, 1);
    await waitFor(() =>
      proxy.clientMessages.some((message) => message.id === 1),
    );
    expect(responseFor(proxy, 1)?.error?.code).toBe(LspErrorCode.InternalError);
    proxy.push({ id: 2, jsonrpc: "2.0", method: "shutdown" });
    await waitFor(
      () => proxy.clientMessages.some((message) => message.id === 2),
      5000,
    );
    expect(responseFor(proxy, 2)?.result).toBeNull();
    await proxy.stop();
  }, 15_000);

  it("repeated boot failures: one spawn per attempt and zero survivors", async () => {
    const configPath = await writeConfig([stub("healthy", {}, TS), BROKEN]);
    const proxy = startProxy(configPath);
    pushInitialize(proxy, 1);
    await waitFor(() =>
      proxy.clientMessages.some((message) => message.id === 1),
    );
    pushInitialize(proxy, 2);
    await waitFor(() =>
      proxy.clientMessages.some((message) => message.id === 2),
    );
    const pids = spawnedPids(proxy.stderr(), "healthy");
    expect(pids).toHaveLength(2);
    await Promise.all(pids.map((pid) => waitFor(() => !isAlive(pid), 5000)));
    await proxy.stop();
  }, 20_000);
});

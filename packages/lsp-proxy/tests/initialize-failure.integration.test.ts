import { afterEach, describe, expect, it } from "bun:test";
import process from "node:process";

import { LspErrorCode } from "../src/constants/index.ts";
import type { JsonRpcMessage } from "../src/types/index.ts";
import {
  awaitDiagnostics,
  boot,
  cleanupTempConfigs,
  openDocument,
  request,
  startProxy,
  stub,
  TS,
  writeConfig,
} from "./helpers/proxy-harness.ts";
import { waitFor } from "./helpers/wait.ts";

afterEach(cleanupTempConfigs);

const SPAWNED_LINE = /spawned (?<name>\S+) pid=(?<pid>\d+)/gu;

const spawnedPids = (stderr: string, name: string): number[] => {
  const pids: number[] = [];
  for (const match of stderr.matchAll(SPAWNED_LINE)) {
    if (match.groups?.name === name) {
      pids.push(Number(match.groups?.pid));
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

const initRequest = (id: number): JsonRpcMessage & { id: number } => ({
  id,
  jsonrpc: "2.0",
  method: "initialize",
  params: { capabilities: {} },
});

const bootFailure = async (servers: unknown[], timeoutMs?: number) => {
  const configPath = await writeConfig(servers);
  const proxy = startProxy(configPath);
  const response = await request(proxy, initRequest(1), timeoutMs);
  return { proxy, response };
};

const itBootFailure = (
  title: string,
  servers: unknown[],
  fragment: string,
  timeouts: { it: number; boot?: number },
) => {
  it(
    title,
    async () => {
      const { proxy, response } = await bootFailure(servers, timeouts.boot);
      expect(response?.error?.code).toBe(LspErrorCode.InternalError);
      expect(response?.error?.message).toContain(fragment);
      await proxy.stop();
    },
    timeouts.it,
  );
};

describe("initialize failure", () => {
  itBootFailure(
    "spawn failure: replies an internal error to the client instead of hanging",
    [BROKEN],
    "failed to start servers",
    { it: 20_000 },
  );

  itBootFailure(
    "boot hang: a silent server's initialize wait times out and errors to the client",
    [stub("silent", { hangInitialize: true }, TS)],
    "initialize timeout",
    { boot: 35_000, it: 40_000 },
  );

  it("server-loop isolation: a throwing server frame does not kill the read loop", async () => {
    const proxy = await boot([
      stub("noisy", { badMethodAfterInitialize: true }, TS),
    ]);
    openDocument(proxy, "file:///proj/noisy.ts", "typescript");
    await awaitDiagnostics(proxy, 1);
    expect(proxy.stderr()).toContain("message dispatch error");
    await proxy.stop();
  }, 20_000);
});

describe("transactional boot", () => {
  it("mixed boot: drops the healthy child when a sibling fails to spawn", async () => {
    const { proxy, response } = await bootFailure([
      stub("healthy", {}, TS),
      BROKEN,
    ]);
    expect(response?.error?.code).toBe(LspErrorCode.InternalError);
    const pid = spawnedPids(proxy.stderr(), "healthy").at(0);
    expect(pid).toBeDefined();
    if (pid === undefined) {
      throw new Error("expected one healthy spawn on stderr");
    }
    await waitFor(() => !isAlive(pid), 5000);
    await proxy.stop();
  }, 15_000);

  it("failed boot: shutdown still receives a null reply", async () => {
    const { proxy, response } = await bootFailure([BROKEN]);
    expect(response?.error?.code).toBe(LspErrorCode.InternalError);
    const shutdown = await request(
      proxy,
      { id: 2, jsonrpc: "2.0", method: "shutdown" },
      5000,
    );
    expect(shutdown?.result).toBeNull();
    await proxy.stop();
  }, 15_000);

  it("repeated boot failures: one spawn per attempt and zero survivors", async () => {
    const configPath = await writeConfig([stub("healthy", {}, TS), BROKEN]);
    const proxy = startProxy(configPath);
    await request(proxy, initRequest(1));
    await request(proxy, initRequest(2));
    const pids = spawnedPids(proxy.stderr(), "healthy");
    expect(pids).toHaveLength(2);
    await Promise.all(pids.map((pid) => waitFor(() => !isAlive(pid), 5000)));
    await proxy.stop();
  }, 20_000);
});

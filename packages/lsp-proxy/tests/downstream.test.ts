import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ServerConfig } from "../src/config.ts";
import { Downstream, type DownstreamHandlers } from "../src/downstream.ts";
import { waitFor } from "./helpers/wait.ts";

const STUB = join(import.meta.dir, "fixtures", "stub-server.ts");

interface ExitRecord {
  code: number | null;
  signal: NodeJS.Signals | number | null;
}

function stubConfig(name: string, options = "{}"): ServerConfig {
  return {
    args: [STUB, name, options],
    command: "bun",
    extensionToLanguage: { ".ts": "typescript" },
    name,
  };
}

const sinks = (
  exits: ExitRecord[],
  received: unknown[],
): DownstreamHandlers => ({
  onExit: (exitCode, signalCode) =>
    exits.push({ code: exitCode, signal: signalCode }),
  onMessage: (message) => received.push(message),
});

const spawnServer = (
  config: ServerConfig,
  handlers: DownstreamHandlers,
): Downstream => {
  const downstream = new Downstream(config, handlers);
  downstream.start();
  return downstream;
};

const sendInitialize = (downstream: Downstream): void => {
  downstream.send({
    id: 1,
    jsonrpc: "2.0",
    method: "initialize",
    params: {},
  });
};

describe("Downstream", () => {
  it("sends initialize and delivers the response message", async () => {
    const received: unknown[] = [];
    const downstream = spawnServer(stubConfig("alpha"), sinks([], received));
    sendInitialize(downstream);
    await waitFor(() => received.length > 0);
    downstream.kill();
    const [first] = received;
    expect(first).toMatchObject({
      id: 1,
      result: { capabilities: { textDocumentSync: 2 } },
    });
  });

  it("exposes the child pid and reports exit through onExit", async () => {
    const exits: ExitRecord[] = [];
    const downstream = spawnServer(stubConfig("beta"), sinks(exits, []));
    expect(typeof downstream.pid).toBe("number");
    downstream.kill();
    await waitFor(() => exits.length > 0);
    const code = await downstream.exited();
    expect(code).toBeDefined();
  });

  it("writes the exit marker and exits cleanly on SIGTERM", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lsp-proxy-stub-"));
    const marker = join(dir, "marker.txt");
    const exits: ExitRecord[] = [];
    const received: unknown[] = [];
    const downstream = spawnServer(
      stubConfig("gamma", JSON.stringify({ exitMarker: marker })),
      sinks(exits, received),
    );
    // The stub registers its SIGTERM handler during module evaluation; the
    // initialize round-trip proves evaluation finished, so TERM reaches a
    // running server instead of one still booting.
    sendInitialize(downstream);
    await waitFor(() => received.length > 0);
    downstream.kill("SIGTERM");
    await waitFor(() => exits.length > 0);
    const [firstExit] = exits;
    expect(firstExit).toEqual({ code: 0, signal: null });
    expect(readFileSync(marker, "utf8")).toBe("exited");
    rmSync(dir, { force: true, recursive: true });
  });
});

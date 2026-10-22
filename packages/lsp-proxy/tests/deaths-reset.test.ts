import { describe, expect, it } from "bun:test";

import { DocumentStore } from "../src/docstore.ts";
import type { Downstream } from "../src/downstream.ts";
import { RequestBroker, type RequestHost } from "../src/proxy-requests.ts";
import { type ProxyHost, ServerSide } from "../src/proxy-server.ts";

const RESET_MS = 50;

const makeHost = (logs: string[]): ProxyHost => {
  const servers = new Map<string, Downstream>();
  const requestHost: RequestHost = {
    config: { servers: [] },
    log: (line) => {
      logs.push(line);
    },
    notify: () => undefined,
    replyErrorTo: () => undefined,
    replyTo: () => undefined,
    servers,
  };
  return {
    broker: new RequestBroker(requestHost),
    clientParams: {},
    config: { servers: [] },
    docs: new DocumentStore(),
    dropServer: () => undefined,
    isStopped: () => false,
    log: (line) => {
      logs.push(line);
    },
    servers,
    write: () => undefined,
  };
};

describe("handleServerExit deaths reset", () => {
  it("resets the death counter after a stable interval", async () => {
    const logs: string[] = [];
    const side = new ServerSide(makeHost(logs), RESET_MS);
    await side.handleServerExit("stub", 1);
    expect(logs).toEqual(["server stub died (1); respawning"]);
    await side.handleServerExit("stub", 1);
    expect(logs).toEqual([
      "server stub died (1); respawning",
      "server stub died (1) a second time; giving up",
    ]);
    await Bun.sleep(RESET_MS * 3);
    await side.handleServerExit("stub", 1);
    expect(logs.at(2)).toBe("server stub died (1); respawning");
  });
});

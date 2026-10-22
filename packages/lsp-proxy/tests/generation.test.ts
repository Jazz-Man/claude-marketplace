import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import type { ServerConfig } from "../src/config.ts";
import { DocumentStore } from "../src/docstore.ts";
import { Downstream } from "../src/downstream.ts";
import { RequestBroker, type RequestHost } from "../src/proxy-requests.ts";
import { type ProxyHost, ServerSide } from "../src/proxy-server.ts";
import { waitFor } from "./helpers/wait.ts";

const STUB = join(import.meta.dir, "fixtures", "stub-server.ts");

const stubConfig = (name: string): ServerConfig => ({
  args: [STUB, name, "{}"],
  command: "bun",
  extensionToLanguage: { ".ts": "typescript" },
  name,
});

interface Fixture {
  host: ProxyHost;
  logs: string[];
  replies: [unknown, unknown][];
}

const makeFixture = (): Fixture => {
  const logs: string[] = [];
  const replies: [unknown, unknown][] = [];
  const servers = new Map<string, Downstream>();
  const requestHost: RequestHost = {
    config: { servers: [] },
    log: (line) => {
      logs.push(line);
    },
    notify: () => undefined,
    replyErrorTo: () => undefined,
    replyTo: (id, result) => {
      replies.push([id, result]);
    },
    servers,
  };
  return {
    host: {
      broker: new RequestBroker(requestHost),
      clientParams: {},
      config: { servers: [] },
      docs: new DocumentStore(),
      dropServer: (server) => {
        servers.get(server)?.kill();
        servers.delete(server);
      },
      isStopped: () => false,
      log: (line) => {
        logs.push(line);
      },
      servers,
      write: () => undefined,
    },
    logs,
    replies,
  };
};

const childless = (name: string): Downstream =>
  new Downstream(stubConfig(name), {
    onExit: () => undefined,
    onMessage: () => undefined,
  });

describe("generation collision hardening", () => {
  it("FM1.4: initialize ids never collide with broker waiter ids", async () => {
    const { host, logs, replies } = makeFixture();
    const side = new ServerSide(host);
    host.servers.set("alpha", childless("alpha"));
    host.broker.resolveCodeAction({
      id: 7,
      jsonrpc: "2.0",
      method: "codeAction/resolve",
      params: {},
    });
    const boot = side
      .startServer(stubConfig("alpha"), {})
      .catch(() => undefined);
    const raced = await Promise.race([
      boot.then(() => "boot"),
      Bun.sleep(2000).then(() => "deadline"),
    ]);
    if (raced === "deadline") {
      side.onServerMessage("alpha", {
        id: 1,
        jsonrpc: "2.0",
        result: { capabilities: {} },
      });
    }
    host.servers.get("alpha")?.kill();
    await boot;
    expect(raced).toBe("boot");
    expect(replies).toEqual([]);
    expect(side.capabilities.get("alpha")).toBeDefined();
    expect(logs.join("\n")).not.toContain("initialize timeout");
  });

  it("FM1.3: an orphan generation's exit leaves the current child alone", async () => {
    const { host, logs } = makeFixture();
    const side = new ServerSide(host);
    await side.startServer(stubConfig("alpha"), {});
    const orphan = host.servers.get("alpha");
    const current = childless("alpha");
    host.servers.set("alpha", current);
    orphan?.kill();
    await waitFor(
      () =>
        logs.some(
          (line) => line.includes("died") || line.includes("stale exit"),
        ),
      5000,
    );
    expect(host.servers.get("alpha")).toBe(current);
    expect(side.capabilities.get("alpha")).toBeDefined();
    expect(logs.some((line) => line.includes("respawning"))).toBe(false);
  });
});

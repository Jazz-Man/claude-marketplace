import { describe, expect, it } from "bun:test";

import { ProxyConfig } from "../src/config/ProxyConfig.ts";
import { ConfigError } from "../src/guards/index.ts";
import { serverEntry, serverPair } from "./helpers/config.ts";

describe("ServerConfig validation", () => {
  it("constructs from valid raw JSON", () => {
    const server = new ProxyConfig({
      servers: [
        {
          args: ["--stdio"],
          command: "vtsls",
          extensionToLanguage: { ".ts": "typescript" },
          name: "vtsls",
        },
      ],
    });
    expect(server.servers[0]?.name).toBe("vtsls");
    expect(server.servers[0]?.args).toEqual(["--stdio"]);
  });

  it("rejects empty name", () => {
    expect(
      () =>
        new ProxyConfig({ servers: [serverEntry("", "cmd", { ".ts": "ts" })] }),
    ).toThrow(ConfigError);
  });

  it("rejects args with non-string elements", () => {
    const raw = {
      servers: [
        { ...serverEntry("test", "cmd", { ".ts": "ts" }), args: [1, 2] },
      ],
    };
    expect(() => new ProxyConfig(raw)).toThrow(ConfigError);
    expect(() => new ProxyConfig(raw)).toThrow("args");
  });
});

describe("ServerConfig optional-fields validation", () => {
  it("rejects env with non-string values", () => {
    expect(
      () =>
        new ProxyConfig({
          servers: [
            {
              ...serverEntry("test", "cmd", { ".ts": "ts" }),
              env: { key: 42 },
            },
          ],
        }),
    ).toThrow(ConfigError);
  });

  it("rejects extensionToLanguage with dotless keys", () => {
    expect(
      () =>
        new ProxyConfig({
          servers: [serverEntry("test", "cmd", { ts: "typescript" })],
        }),
    ).toThrow("must start with '.'");
  });
});

describe("ProxyConfig validation", () => {
  it.each([
    [
      "rejects duplicate server names",
      {
        servers: [
          serverEntry("dup", "a", { ".ts": "ts" }),
          serverEntry("dup", "b", { ".ts": "ts" }),
        ],
      },
      "duplicate",
    ],
    [
      "rejects extension mapped to conflicting languages",
      serverPair("typescript", "javascript"),
      "conflict",
    ],
    ["rejects empty servers array", { servers: [] }, "not be empty"],
  ])("%s", (_, raw, expected) => {
    expect(() => new ProxyConfig(raw)).toThrow(expected);
  });

  it("allows same extension mapped to same language", () => {
    expect(
      new ProxyConfig(serverPair("typescript", "typescript")).servers,
    ).toHaveLength(2);
  });

  it("rejects non-object server entry", () => {
    expect(() => new ProxyConfig({ servers: [42] })).toThrow(ConfigError);
  });
});

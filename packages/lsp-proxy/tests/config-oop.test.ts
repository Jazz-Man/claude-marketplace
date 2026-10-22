import { describe, expect, it } from "bun:test";

import { ProxyConfig } from "../src/config/ProxyConfig.ts";
import { ConfigError } from "../src/guards/index.ts";

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
        new ProxyConfig({
          servers: [
            { command: "cmd", extensionToLanguage: { ".ts": "ts" }, name: "" },
          ],
        }),
    ).toThrow(ConfigError);
  });

  it("rejects args with non-string elements", () => {
    expect(
      () =>
        new ProxyConfig({
          servers: [
            {
              args: [1, 2],
              command: "cmd",
              extensionToLanguage: { ".ts": "ts" },
              name: "test",
            },
          ],
        }),
    ).toThrow(ConfigError);
    expect(
      () =>
        new ProxyConfig({
          servers: [
            {
              args: [1, 2],
              command: "cmd",
              extensionToLanguage: { ".ts": "ts" },
              name: "test",
            },
          ],
        }),
    ).toThrow("args");
  });
});

describe("ServerConfig optional-fields validation", () => {
  it("rejects env with non-string values", () => {
    expect(
      () =>
        new ProxyConfig({
          servers: [
            {
              command: "cmd",
              env: { key: 42 },
              extensionToLanguage: { ".ts": "ts" },
              name: "test",
            },
          ],
        }),
    ).toThrow(ConfigError);
  });

  it("rejects extensionToLanguage with dotless keys", () => {
    expect(
      () =>
        new ProxyConfig({
          servers: [
            {
              command: "cmd",
              extensionToLanguage: { ts: "typescript" },
              name: "test",
            },
          ],
        }),
    ).toThrow("must start with '.'");
  });
});

describe("ProxyConfig validation", () => {
  it("rejects duplicate server names", () => {
    expect(
      () =>
        new ProxyConfig({
          servers: [
            { command: "a", extensionToLanguage: { ".ts": "ts" }, name: "dup" },
            { command: "b", extensionToLanguage: { ".ts": "ts" }, name: "dup" },
          ],
        }),
    ).toThrow("duplicate");
  });

  it("rejects extension mapped to conflicting languages", () => {
    expect(
      () =>
        new ProxyConfig({
          servers: [
            {
              command: "a",
              extensionToLanguage: { ".ts": "typescript" },
              name: "a",
            },
            {
              command: "b",
              extensionToLanguage: { ".ts": "javascript" },
              name: "b",
            },
          ],
        }),
    ).toThrow("conflict");
  });

  it("allows same extension mapped to same language", () => {
    const config = new ProxyConfig({
      servers: [
        {
          command: "a",
          extensionToLanguage: { ".ts": "typescript" },
          name: "a",
        },
        {
          command: "b",
          extensionToLanguage: { ".ts": "typescript" },
          name: "b",
        },
      ],
    });
    expect(config.servers).toHaveLength(2);
  });

  it("rejects non-object server entry", () => {
    expect(() => new ProxyConfig({ servers: [42] })).toThrow(ConfigError);
  });

  it("rejects empty servers array", () => {
    expect(() => new ProxyConfig({ servers: [] })).toThrow("not be empty");
  });
});

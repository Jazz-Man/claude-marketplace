import { describe, expect, it } from "bun:test";

import type { ProxyConfig } from "../src/config.ts";
import { extensionUnion, mergeIntoLspJson } from "../src/sync-extensions.ts";

const CONFIG: ProxyConfig = {
  servers: [
    {
      command: "vtsls",
      extensionToLanguage: { ".ts": "typescript", ".tsx": "typescriptreact" },
      name: "vtsls",
    },
    {
      command: "biome",
      extensionToLanguage: { ".css": "css", ".ts": "typescript" },
      name: "biome",
    },
  ],
};

const TARGET = JSON.stringify({
  "lsp-proxy": {
    args: ["/abs/config.json"],
    command: "lsp-proxy",
    extensionToLanguage: { ".old": "oldlang" },
    maxRestarts: 3,
    transport: "stdio",
  },
});

describe("extensionUnion", () => {
  it("unions server maps", () => {
    expect(extensionUnion(CONFIG)).toEqual({
      ".css": "css",
      ".ts": "typescript",
      ".tsx": "typescriptreact",
    });
  });

  it("throws on a conflicting language for the same extension", () => {
    const conflicting: ProxyConfig = {
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
    };
    expect(() => extensionUnion(conflicting)).toThrow(".ts");
  });
});

describe("mergeIntoLspJson", () => {
  it("replaces only extensionToLanguage and preserves every other field", () => {
    const updated = mergeIntoLspJson(TARGET, extensionUnion(CONFIG));
    const parsed = JSON.parse(updated) as Record<string, unknown>;
    const entry = parsed["lsp-proxy"] as Record<string, unknown>;
    expect(entry.args).toEqual(["/abs/config.json"]);
    expect(entry.command).toBe("lsp-proxy");
    expect(entry.maxRestarts).toBe(3);
    expect(entry.transport).toBe("stdio");
    expect(entry.extensionToLanguage).toEqual({
      ".css": "css",
      ".ts": "typescript",
      ".tsx": "typescriptreact",
    });
  });
});

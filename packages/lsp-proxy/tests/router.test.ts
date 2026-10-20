import { describe, expect, it } from "bun:test";

import type { ProxyConfig, ServerConfig } from "../src/config.ts";
import {
  extensionOf,
  serversForDocument,
  serversForRequest,
} from "../src/router.ts";

const vtsls: ServerConfig = {
  command: "vtsls",
  extensionToLanguage: { ".ts": "typescript" },
  name: "vtsls",
};
const biome: ServerConfig = {
  command: "biome",
  extensionToLanguage: { ".css": "css", ".ts": "typescript" },
  name: "biome",
};
const config: ProxyConfig = { servers: [vtsls, biome] };

describe("extensionOf", () => {
  it("extracts the lowercase extension with the dot", () => {
    expect(extensionOf("file:///proj/Main.TS")).toBe(".ts");
    expect(extensionOf("file:///proj/x.css")).toBe(".css");
  });

  it("ignores query strings and dotfiles", () => {
    expect(extensionOf("file:///proj/x.ts?raw=1")).toBe(".ts");
    expect(extensionOf("file:///proj/.gitignore")).toBeUndefined();
  });

  it("returns undefined for malformed URIs", () => {
    expect(extensionOf("not-a-uri")).toBeUndefined();
    expect(extensionOf("")).toBeUndefined();
  });
});

describe("serversForDocument", () => {
  it("returns only servers whose map contains the extension, in priority order", () => {
    const names = serversForDocument(config, "file:///p/a.ts").map(
      (entry) => entry.name,
    );
    expect(names).toEqual(["vtsls", "biome"]);
  });

  it("returns an empty array for unmatched extensions", () => {
    expect(serversForDocument(config, "file:///p/a.py")).toEqual([]);
  });
});

describe("serversForRequest", () => {
  const capabilities = new Map<string, Record<string, unknown>>([
    ["vtsls", { hoverProvider: true }],
    ["biome", { documentFormattingProvider: true }],
  ]);

  it("filters by declared capability", () => {
    const names = serversForRequest(
      config,
      capabilities,
      "file:///p/a.ts",
      "textDocument/hover",
    ).map((entry) => entry.name);
    expect(names).toEqual(["vtsls"]);
  });

  it("returns all extension owners for unknown methods", () => {
    const names = serversForRequest(
      config,
      capabilities,
      "file:///p/a.ts",
      "workspace/unknownThing",
    ).map((entry) => entry.name);
    expect(names).toEqual(["vtsls", "biome"]);
  });
});

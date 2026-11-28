import { describe, expect, it } from "bun:test";

import { parseConfig } from "../src/config.ts";
import { serverEntry, serverPair, violationText } from "./helpers/config.ts";

describe("parseConfig acceptance", () => {
  it("accepts a minimal valid config and keeps optional fields", () => {
    const parsed = parseConfig({
      servers: [
        {
          ...serverEntry("vtsls", "vtsls", { ".ts": "typescript" }),
          args: ["--stdio"],
          initializationOptions: { a: 1 },
          settings: { b: 2 },
        },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.config.servers[0]?.name).toBe("vtsls");
    expect(parsed.config.servers[0]?.args).toEqual(["--stdio"]);
  });

  it("allows the same extension mapped to the same language twice", () => {
    expect(parseConfig(serverPair("typescript", "typescript")).ok).toBe(true);
  });

  it("keeps configFiles when present", () => {
    const parsed = parseConfig({
      servers: [
        {
          ...serverEntry("biome", "biome", { ".ts": "typescript" }),
          configFiles: ["biome.json", "biome.jsonc"],
        },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.config.servers[0]?.configFiles).toEqual([
      "biome.json",
      "biome.jsonc",
    ]);
  });

  it("leaves configFiles undefined when absent", () => {
    const parsed = parseConfig(serverPair("typescript", "typescript"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.config.servers[0]?.configFiles).toBeUndefined();
  });
});

describe("parseConfig configFiles violations", () => {
  const gated = (configFiles: unknown) => ({
    servers: [
      {
        ...serverEntry("biome", "biome", { ".ts": "typescript" }),
        configFiles,
      },
    ],
  });

  it.each([
    ["an empty list", []],
    ["an empty file name", [""]],
    ["a non-string entry", ["biome.json", 1]],
    ["a bare file name", "biome.json"],
  ])("rejects %s", (_, configFiles) => {
    const parsed = parseConfig(gated(configFiles));
    expect(parsed.ok).toBe(false);
    expect(violationText(parsed)).toContain('"servers[0].configFiles"');
  });
});

describe("parseConfig violations", () => {
  it("rejects non-object input", () => {
    expect(parseConfig(42).ok).toBe(false);
    expect(parseConfig("nope").ok).toBe(false);
    expect(parseConfig(null).ok).toBe(false);
  });

  it.each([
    {
      config: {
        servers: [
          serverEntry("", "", {}),
          serverEntry("a", "x", { ".ts": "typescript" }),
          serverEntry("a", "y", { ts: "typescript" }),
        ],
      },
      expected: [
        "command",
        "servers[0].name",
        "duplicate",
        "must start with '.'",
      ],
      name: "collects every violation instead of stopping at the first",
    },
    {
      config: serverPair("typescript", "javascript"),
      expected: [".ts", "typescript", "javascript"],
      name: "rejects an extension mapped to two different languages across servers",
    },
    {
      config: { servers: [serverEntry("a", "a", { ".ts": "" })] },
      expected: ["language"],
      name: "rejects empty language values",
    },
  ])("$name", ({ config, expected }) => {
    const parsed = parseConfig(config);
    expect(parsed.ok).toBe(false);
    const errors = violationText(parsed);
    for (const fragment of expected) {
      expect(errors.includes(fragment)).toBe(true);
    }
  });
});

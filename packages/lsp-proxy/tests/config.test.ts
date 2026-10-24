import { describe, expect, it } from "bun:test";

import { parseConfig } from "../src/config.ts";

describe("parseConfig acceptance", () => {
  it("accepts a minimal valid config and keeps optional fields", () => {
    const parsed = parseConfig({
      servers: [
        {
          args: ["--stdio"],
          command: "vtsls",
          extensionToLanguage: { ".ts": "typescript" },
          initializationOptions: { a: 1 },
          name: "vtsls",
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
    const parsed = parseConfig({
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
    expect(parsed.ok).toBe(true);
  });
});

describe("parseConfig violations", () => {
  it("rejects non-object input", () => {
    expect(parseConfig(42).ok).toBe(false);
    expect(parseConfig("nope").ok).toBe(false);
    expect(parseConfig(null).ok).toBe(false);
  });

  it("collects every violation instead of stopping at the first", () => {
    const parsed = parseConfig({
      servers: [
        { command: "", extensionToLanguage: {}, name: "" },
        {
          command: "x",
          extensionToLanguage: { ".ts": "typescript" },
          name: "a",
        },
        { command: "y", extensionToLanguage: { ts: "typescript" }, name: "a" },
      ],
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      return;
    }
    const errors = parsed.errors.join("\n");
    expect(errors).toContain("command");
    expect(errors).toContain("servers[0].name");
    expect(errors).toContain("duplicate");
    expect(errors).toContain("must start with '.'");
  });

  it("rejects an extension mapped to two different languages across servers", () => {
    const parsed = parseConfig({
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
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      return;
    }
    const errors = parsed.errors.join("\n");

    expect(errors).toContain(".ts");
    expect(errors).toContain("typescript");
    expect(errors).toContain("javascript");
  });

  it("rejects empty language values", () => {
    const parsed = parseConfig({
      servers: [
        { command: "a", extensionToLanguage: { ".ts": "" }, name: "a" },
      ],
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      return;
    }
    const errors = parsed.errors.join("\n");
    expect(errors).toContain("language");
  });
});

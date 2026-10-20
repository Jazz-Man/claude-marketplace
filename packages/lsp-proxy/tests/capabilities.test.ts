import { describe, expect, it } from "bun:test";

import {
  mergeCapabilities,
  stripPullDiagnostics,
} from "../src/capabilities.ts";

const COMPLETION_INPUTS = [
  {
    capabilities: {
      completionProvider: { triggerCharacters: ["."] },
      textDocumentSync: 2,
    },
    server: "vtsls",
  },
  {
    capabilities: {
      completionProvider: { triggerCharacters: [":"] },
      textDocumentSync: 2,
    },
    server: "biome",
  },
];

const DISJOINT_BOOLEANS = [
  {
    capabilities: { hoverProvider: true, textDocumentSync: 2 },
    server: "vtsls",
  },
  {
    capabilities: {
      documentFormattingProvider: true,
      textDocumentSync: 2,
    },
    server: "biome",
  },
];

const FALSE_THEN_TRUE = [
  {
    capabilities: { hoverProvider: false, textDocumentSync: 2 },
    server: "vtsls",
  },
  {
    capabilities: { hoverProvider: true, textDocumentSync: 2 },
    server: "biome",
  },
];

const FALSE_THEN_OBJECT = [
  {
    capabilities: { completionProvider: false, textDocumentSync: 2 },
    server: "vtsls",
  },
  {
    capabilities: {
      completionProvider: { triggerCharacters: [":"] },
      textDocumentSync: 2,
    },
    server: "biome",
  },
];

const OBJECT_THEN_FALSE = [
  {
    capabilities: {
      completionProvider: { triggerCharacters: ["."] },
      textDocumentSync: 2,
    },
    server: "vtsls",
  },
  {
    capabilities: { completionProvider: false, textDocumentSync: 2 },
    server: "biome",
  },
];

describe("stripPullDiagnostics", () => {
  it("removes textDocument.diagnostic without mutating the original", () => {
    const original = {
      textDocument: {
        diagnostic: { dynamicRegistration: false },
        hover: { dynamicRegistration: true },
      },
    };
    const stripped = stripPullDiagnostics(original) as typeof original;
    expect(stripped.textDocument.diagnostic).toBeUndefined();
    expect(stripped.textDocument.hover).toEqual({ dynamicRegistration: true });
    expect(original.textDocument.diagnostic).toBeDefined();
  });

  it("tolerates missing textDocument", () => {
    expect(stripPullDiagnostics({})).toEqual({});
  });
});

describe("mergeCapabilities", () => {
  it("ORs provider booleans and forces incremental sync", () => {
    const merged = mergeCapabilities(DISJOINT_BOOLEANS, ["vtsls", "biome"]);
    expect(merged.merged).toEqual({
      documentFormattingProvider: true,
      hoverProvider: true,
      textDocumentSync: 2,
    });
    expect(merged.rejected).toEqual([]);
  });

  it("rejects a full-sync server and keeps the rest (D6)", () => {
    const merged = mergeCapabilities(
      [
        { capabilities: { textDocumentSync: 2 }, server: "vtsls" },
        { capabilities: { textDocumentSync: 1 }, server: "biome" },
      ],
      ["vtsls", "biome"],
    );
    expect(merged.rejected).toEqual([
      {
        reason: "textDocumentSync must be 2 (incremental), got 1",
        server: "biome",
      },
    ]);
    expect(merged.merged.textDocumentSync).toBe(2);
  });

  it("takes provider objects from the priority-first server that declares them", () => {
    const merged = mergeCapabilities(COMPLETION_INPUTS, ["vtsls", "biome"]);
    expect(merged.merged.completionProvider).toEqual({
      triggerCharacters: ["."],
    });
  });

  it("ORs provider booleans across servers even when the priority-first declares false", () => {
    const merged = mergeCapabilities(FALSE_THEN_TRUE, ["vtsls", "biome"]);
    expect(merged.merged.hoverProvider).toBe(true);
  });

  it("an object declaration is not masked by a priority-first false", () => {
    const merged = mergeCapabilities(FALSE_THEN_OBJECT, ["vtsls", "biome"]);
    expect(merged.merged.completionProvider).toEqual({
      triggerCharacters: [":"],
    });
  });

  it("an object declaration survives a lower server's false", () => {
    const merged = mergeCapabilities(OBJECT_THEN_FALSE, ["vtsls", "biome"]);
    expect(merged.merged.completionProvider).toEqual({
      triggerCharacters: ["."],
    });
  });
});

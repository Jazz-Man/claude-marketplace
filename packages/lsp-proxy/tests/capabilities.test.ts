import { describe, expect, it } from "bun:test";

import { mergeCapabilities } from "../src/capabilities.ts";

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

  it("accepts full-sync and incremental servers together (D6)", () => {
    const merged = mergeCapabilities(
      [
        { capabilities: { textDocumentSync: 2 }, server: "vtsls" },
        { capabilities: { textDocumentSync: 1 }, server: "biome" },
      ],
      ["vtsls", "biome"],
    );
    expect(merged.rejected).toEqual([]);
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

describe("mergeCapabilities — sync object form (live vtsls finding)", () => {
  it("accepts the TextDocumentSyncOptions form with change: 2", () => {
    const merged = mergeCapabilities(
      [
        {
          capabilities: { textDocumentSync: { change: 2, openClose: true } },
          server: "vtsls",
        },
      ],
      ["vtsls"],
    );
    expect(merged.rejected).toEqual([]);
    expect(merged.merged.textDocumentSync).toBe(2);
  });

  it("accepts the object form whose change is 1", () => {
    const merged = mergeCapabilities(
      [
        {
          capabilities: { textDocumentSync: { change: 1, openClose: true } },
          server: "legacy",
        },
      ],
      ["legacy"],
    );
    expect(merged.rejected).toEqual([]);
    expect(merged.merged.textDocumentSync).toBe(2);
  });
});

describe("mergeCapabilities — unsupported sync kinds", () => {
  it("rejects an object sync whose change is outside 1 and 2", () => {
    const merged = mergeCapabilities(
      [{ capabilities: { textDocumentSync: { change: 3 } }, server: "odd" }],
      ["odd"],
    );
    expect(merged.rejected).toEqual([
      {
        reason:
          'textDocumentSync must be 1 (full) or 2 (incremental), got {"change":3}',
        server: "odd",
      },
    ]);
  });

  it("rejects a numeric sync outside 1 and 2", () => {
    const merged = mergeCapabilities(
      [{ capabilities: { textDocumentSync: 0 }, server: "odd" }],
      ["odd"],
    );
    expect(merged.rejected).toEqual([
      {
        reason: "textDocumentSync must be 1 (full) or 2 (incremental), got 0",
        server: "odd",
      },
    ]);
  });

  it("rejects absent sync", () => {
    const merged = mergeCapabilities(
      [{ capabilities: {}, server: "odd" }],
      ["odd"],
    );
    expect(merged.rejected).toEqual([
      {
        reason:
          "textDocumentSync must be 1 (full) or 2 (incremental), got undefined",
        server: "odd",
      },
    ]);
  });
});

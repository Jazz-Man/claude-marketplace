import { describe, expect, it } from "bun:test";

import { mergeCapabilities } from "../src/capabilities.ts";
import type { ServerCapabilities } from "../src/types/index.ts";

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

const OBJECT_DECLARATION_CASES: [
  string,
  { capabilities: ServerCapabilities; server: string }[],
  { triggerCharacters: string[] },
][] = [
  [
    "an object declaration is not masked by a priority-first false",
    [
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
    ],
    { triggerCharacters: [":"] },
  ],
  [
    "an object declaration survives a lower server's false",
    [
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
    ],
    { triggerCharacters: ["."] },
  ],
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

  it.each(OBJECT_DECLARATION_CASES)("%s", (_, inputs, expected) => {
    const merged = mergeCapabilities(inputs, ["vtsls", "biome"]);
    expect(merged.merged.completionProvider).toEqual(expected);
  });
});

describe("mergeCapabilities — sync object form (live vtsls finding)", () => {
  it.each([
    [
      "accepts the TextDocumentSyncOptions form with change: 2",
      [
        {
          capabilities: { textDocumentSync: { change: 2, openClose: true } },
          server: "vtsls",
        },
      ],
      ["vtsls"],
    ],
    [
      "accepts the object form whose change is 1",
      [
        {
          capabilities: { textDocumentSync: { change: 1, openClose: true } },
          server: "legacy",
        },
      ],
      ["legacy"],
    ],
  ])("%s", (_, inputs, priority) => {
    const merged = mergeCapabilities(inputs, priority);
    expect(merged.rejected).toEqual([]);
    expect(merged.merged.textDocumentSync).toBe(2);
  });
});

describe("mergeCapabilities — unsupported sync kinds", () => {
  it.each([
    [
      "rejects an object sync whose change is outside 1 and 2",
      { textDocumentSync: { change: 3 } },
      [
        {
          reason:
            'textDocumentSync must be 1 (full) or 2 (incremental), got {"change":3}',
          server: "odd",
        },
      ],
    ],
    [
      "rejects a numeric sync outside 1 and 2",
      { textDocumentSync: 0 },
      [
        {
          reason: "textDocumentSync must be 1 (full) or 2 (incremental), got 0",
          server: "odd",
        },
      ],
    ],
    [
      "rejects absent sync",
      {},
      [
        {
          reason:
            "textDocumentSync must be 1 (full) or 2 (incremental), got undefined",
          server: "odd",
        },
      ],
    ],
  ])("%s", (_, sync, expected) => {
    const merged = mergeCapabilities(
      [{ capabilities: sync, server: "odd" }],
      ["odd"],
    );
    expect(merged.rejected).toEqual(expected);
  });
});

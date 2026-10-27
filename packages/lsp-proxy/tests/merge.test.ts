import { describe, expect, it } from "bun:test";

import { mergeOutcomes, type ServerOutcome } from "../src/merge.ts";

const PRIORITY = ["vtsls", "biome"];

const resultTableTests = (
  method: string,
  rows: [string, ServerOutcome[], unknown][],
): void => {
  it.each(rows)("%s", (_, outcomes, expected) => {
    expect(mergeOutcomes(method, outcomes, PRIORITY).result).toEqual(expected);
  });
};

describe("mergeOutcomes — set arrays", () => {
  resultTableTests("textDocument/definition", [
    [
      "concatenates definition arrays across servers",
      [
        { result: [{ uri: "file:///a" }], server: "vtsls" },
        {
          result: [{ uri: "file:///b" }, { uri: "file:///c" }],
          server: "biome",
        },
      ],
      [{ uri: "file:///a" }, { uri: "file:///b" }, { uri: "file:///c" }],
    ],
    [
      "normalizes a single Location into the array",
      [
        { result: { uri: "file:///a" }, server: "vtsls" },
        { result: null, server: "biome" },
      ],
      [{ uri: "file:///a" }],
    ],
  ]);

  it("returns the first error by priority when every server errored", () => {
    const outcomes: ServerOutcome[] = [
      { error: { code: -1, message: "biome boom" }, server: "biome" },
      { error: { code: -2, message: "vtsls boom" }, server: "vtsls" },
    ];
    const merged = mergeOutcomes("textDocument/hover", outcomes, PRIORITY);
    expect(merged.error?.message).toBe("vtsls boom");
  });

  it("merges successes when some servers error", () => {
    const outcomes: ServerOutcome[] = [
      {
        result: { contents: { kind: "markdown", value: "hi" } },
        server: "vtsls",
      },
      { error: { code: -1, message: "boom" }, server: "biome" },
    ];
    expect(
      mergeOutcomes("textDocument/hover", outcomes, PRIORITY).error,
    ).toBeUndefined();
  });
});

describe("mergeOutcomes — completion", () => {
  resultTableTests("textDocument/completion", [
    [
      "concatenates items and ORs isIncomplete",
      [
        {
          result: { isIncomplete: true, items: [{ label: "a" }] },
          server: "vtsls",
        },
        {
          result: { isIncomplete: false, items: [{ label: "b" }] },
          server: "biome",
        },
      ],
      { isIncomplete: true, items: [{ label: "a" }, { label: "b" }] },
    ],
    [
      "treats a null list as empty",
      [
        { result: null, server: "vtsls" },
        {
          result: { isIncomplete: false, items: [{ label: "b" }] },
          server: "biome",
        },
      ],
      { isIncomplete: false, items: [{ label: "b" }] },
    ],
  ]);
});

describe("mergeOutcomes — hover", () => {
  resultTableTests("textDocument/hover", [
    [
      "joins markdown contents with a blank line",
      [
        {
          result: { contents: { kind: "markdown", value: "one" } },
          server: "vtsls",
        },
        {
          result: { contents: { kind: "markdown", value: "two" } },
          server: "biome",
        },
      ],
      { contents: { kind: "markdown", value: "one\n\ntwo" } },
    ],
    [
      "falls back to the priority-first hover when contents shapes differ",
      [
        { result: { contents: "plain" }, server: "biome" },
        { result: null, server: "vtsls" },
      ],
      { contents: "plain" },
    ],
  ]);
});

describe("mergeOutcomes — single-document results", () => {
  it("picks the first non-null formatting edits by priority", () => {
    const outcomes: ServerOutcome[] = [
      { result: [{ newText: "x", range: null }], server: "biome" },
      { result: null, server: "vtsls" },
    ];
    const merged = mergeOutcomes("textDocument/formatting", outcomes, PRIORITY);
    expect(merged.result).toEqual([{ newText: "x", range: null }]);
  });

  it("returns null when every server answered null", () => {
    const outcomes: ServerOutcome[] = [
      { result: null, server: "vtsls" },
      { result: null, server: "biome" },
    ];
    expect(
      mergeOutcomes("textDocument/formatting", outcomes, PRIORITY).result,
    ).toBeNull();
  });
});

describe("mergeOutcomes — unknown methods", () => {
  it("returns the first non-null by priority", () => {
    const outcomes: ServerOutcome[] = [
      { result: { value: "from-biome" }, server: "biome" },
      { result: null, server: "vtsls" },
    ];
    expect(
      mergeOutcomes("workspace/someMethod", outcomes, PRIORITY).result,
    ).toEqual({
      value: "from-biome",
    });
  });
});

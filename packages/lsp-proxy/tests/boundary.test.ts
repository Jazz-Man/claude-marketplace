import { describe, expect, it } from "bun:test";

import {
  cancelIdOf,
  changesOf,
  textDocumentOf,
  uriOf,
} from "../src/boundary.ts";

describe("uriOf", () => {
  it.each([
    [
      "extracts uri from textDocument",
      { textDocument: { uri: "file:///test.ts" } },
      "file:///test.ts",
    ],
    [
      "extracts uri from top-level uri field",
      { uri: "file:///other.ts" },
      "file:///other.ts",
    ],
    [
      "falls back to top-level uri when textDocument is malformed",
      { textDocument: 42, uri: "file:///fallback.ts" },
      "file:///fallback.ts",
    ],
  ])("%s", (_, params, expected) => {
    expect(uriOf(params)).toBe(expected);
  });

  it.each([
    [{ textDocument: { uri: 42 } }, ""],
    [{ textDocument: "nope", uri: 7 }, ""],
    [{}, ""],
    [[], ""],
    [42, ""],
    ["str", ""],
    [null, ""],
  ])("returns empty string for malformed params: %j", (params, expected) => {
    expect(uriOf(params)).toBe(expected);
  });
});

describe("textDocumentOf", () => {
  it("wraps uriOf", () => {
    expect(textDocumentOf({ textDocument: { uri: "file:///a.ts" } })).toEqual({
      uri: "file:///a.ts",
    });
    expect(textDocumentOf(null)).toEqual({ uri: "" });
  });
});

describe("changesOf", () => {
  const range = {
    end: { character: 2, line: 1 },
    start: { character: 0, line: 0 },
  };

  it.each([
    [
      "extracts valid content changes",
      { contentChanges: [{ text: "new content" }] },
      [{ text: "new content" }],
    ],
    [
      "keeps ranged changes with valid positions",
      { contentChanges: [{ range, text: "patched" }] },
      [{ range, text: "patched" }],
    ],
    [
      "filters out changes without text",
      { contentChanges: [{ text: "valid" }, { noText: true }, null] },
      [{ text: "valid" }],
    ],
    [
      "keeps valid changes alongside malformed ones",
      {
        contentChanges: [{ range: "junk", text: "dropped" }, { text: "kept" }],
      },
      [{ text: "kept" }],
    ],
  ])("%s", (_, params, expected) => {
    expect(changesOf(params)).toEqual(expected);
  });

  it.each([
    [{ contentChanges: "not array" }],
    [{ contentChanges: [42] }],
    [{ contentChanges: [{ text: 7 }] }],
    [{ contentChanges: [{ range: "nope", text: "bad range" }] }],
    [
      {
        contentChanges: [{ range: { start: { line: 0 } }, text: "partial" }],
      },
    ],
    [{}],
    [null],
  ])("returns empty array for malformed params: %j", (params) => {
    expect(changesOf(params)).toEqual([]);
  });
});

describe("cancelIdOf", () => {
  it.each([
    ["extracts numeric id", 42],
    ["extracts string id", "request-1"],
  ])("%s", (_, id) => {
    expect(cancelIdOf({ id })).toBe(id);
  });

  it.each([
    [{ id: true }],
    [{ id: null }],
    [{ id: { nested: true } }],
    [{ id: ["x"] }],
    [{}],
    [null],
  ])("returns undefined for malformed params: %j", (params) => {
    expect(cancelIdOf(params)).toBeUndefined();
  });
});

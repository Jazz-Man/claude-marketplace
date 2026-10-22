import { describe, expect, it } from "bun:test";

import {
  cancelIdOf,
  changesOf,
  textDocumentOf,
  uriOf,
} from "../src/boundary.ts";

describe("uriOf", () => {
  it("extracts uri from textDocument", () => {
    expect(uriOf({ textDocument: { uri: "file:///test.ts" } })).toBe(
      "file:///test.ts",
    );
  });

  it("extracts uri from top-level uri field", () => {
    expect(uriOf({ uri: "file:///other.ts" })).toBe("file:///other.ts");
  });

  it("falls back to top-level uri when textDocument is malformed", () => {
    expect(uriOf({ textDocument: 42, uri: "file:///fallback.ts" })).toBe(
      "file:///fallback.ts",
    );
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
  it("extracts valid content changes", () => {
    const changes = changesOf({
      contentChanges: [{ text: "new content" }],
    });
    expect(changes).toEqual([{ text: "new content" }]);
  });

  it("keeps ranged changes with valid positions", () => {
    const range = {
      end: { character: 2, line: 1 },
      start: { character: 0, line: 0 },
    };
    const changes = changesOf({ contentChanges: [{ range, text: "patched" }] });
    expect(changes).toEqual([{ range, text: "patched" }]);
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

  it("filters out changes without text", () => {
    const changes = changesOf({
      contentChanges: [{ text: "valid" }, { noText: true }, null],
    });
    expect(changes).toEqual([{ text: "valid" }]);
  });

  it("keeps valid changes alongside malformed ones", () => {
    const changes = changesOf({
      contentChanges: [{ range: "junk", text: "dropped" }, { text: "kept" }],
    });
    expect(changes).toEqual([{ text: "kept" }]);
  });
});

describe("cancelIdOf", () => {
  it("extracts numeric id", () => {
    expect(cancelIdOf({ id: 42 })).toBe(42);
  });

  it("extracts string id", () => {
    expect(cancelIdOf({ id: "request-1" })).toBe("request-1");
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

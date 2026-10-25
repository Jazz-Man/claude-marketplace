import { describe, expect, it } from "bun:test";

import { didChangeFrame } from "../src/sync-adapt.ts";

const CHANGE = {
  jsonrpc: "2.0" as const,
  method: "textDocument/didChange",
  params: {
    contentChanges: [
      {
        range: {
          end: { character: 11, line: 0 },
          start: { character: 6, line: 0 },
        },
        text: "y = 42",
      },
    ],
    textDocument: { uri: "file:///p/a.ts", version: 3 },
  },
};

describe("didChangeFrame", () => {
  it("synthesizes a full-text frame for an object-form full-sync server", () => {
    const frame = didChangeFrame(CHANGE, { change: 1 }, "const y = 42;\n");
    expect(frame).toEqual({
      jsonrpc: "2.0",
      method: "textDocument/didChange",
      params: {
        contentChanges: [{ text: "const y = 42;\n" }],
        textDocument: { uri: "file:///p/a.ts", version: 3 },
      },
    });
  });

  it("synthesizes for the numeric full-sync form too", () => {
    const frame = didChangeFrame(CHANGE, 1, "const y = 42;\n");
    expect(frame.params).toEqual({
      contentChanges: [{ text: "const y = 42;\n" }],
      textDocument: { uri: "file:///p/a.ts", version: 3 },
    });
  });

  it("hands the client delta verbatim to an incremental server", () => {
    expect(didChangeFrame(CHANGE, { change: 2 }, "const y = 42;\n")).toBe(
      CHANGE,
    );
  });

  it("leaves non-didChange notifications untouched", () => {
    const open = {
      jsonrpc: "2.0" as const,
      method: "textDocument/didOpen",
      params: {
        textDocument: { languageId: "ts", text: "t", uri: "file:///p/a.ts" },
      },
    };
    expect(didChangeFrame(open, { change: 1 }, "t")).toBe(open);
  });

  it("passes the delta through when the document text is unknown", () => {
    expect(didChangeFrame(CHANGE, { change: 1 }, undefined)).toBe(CHANGE);
  });

  it("keeps a versionless textDocument from the original params", () => {
    const change = {
      jsonrpc: "2.0" as const,
      method: "textDocument/didChange",
      params: {
        contentChanges: [{ text: "next" }],
        textDocument: { uri: "file:///p/a.ts" },
      },
    };
    const frame = didChangeFrame(change, { change: 1 }, "next");
    expect(frame.params).toEqual({
      contentChanges: [{ text: "next" }],
      textDocument: { uri: "file:///p/a.ts" },
    });
  });
});

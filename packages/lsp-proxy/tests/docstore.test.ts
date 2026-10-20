import { describe, expect, it } from "bun:test";

import { applyChanges, DocumentStore } from "../src/docstore.ts";

const LINES = "one\ntwo\nthree\n";

describe("applyChanges", () => {
  it("replaces the whole text when no range is present", () => {
    expect(applyChanges(LINES, [{ text: "fresh" }])).toBe("fresh");
  });

  it("applies a single ranged change", () => {
    const change = {
      range: {
        end: { character: 3, line: 1 },
        start: { character: 0, line: 1 },
      },
      text: "TWO",
    };
    expect(applyChanges(LINES, [change])).toBe("one\nTWO\nthree\n");
  });

  it("applies an insertion as a zero-width range", () => {
    const change = {
      range: {
        end: { character: 0, line: 0 },
        start: { character: 0, line: 0 },
      },
      text: "> ",
    };
    expect(applyChanges(LINES, [change])).toBe("> one\ntwo\nthree\n");
  });

  it("applies several changes in array order against the running text", () => {
    const changes = [
      {
        range: {
          end: { character: 3, line: 0 },
          start: { character: 0, line: 0 },
        },
        text: "ONE",
      },
      {
        range: {
          end: { character: 5, line: 1 },
          start: { character: 0, line: 1 },
        },
        text: "2",
      },
    ];
    expect(applyChanges(LINES, changes)).toBe("ONE\n2\nthree\n");
  });

  it("survives a multibyte edit", () => {
    const change = {
      range: {
        end: { character: 3, line: 0 },
        start: { character: 0, line: 0 },
      },
      text: "тест",
    };
    expect(applyChanges("укр\ntext", [change])).toBe("тест\ntext");
  });
});

describe("DocumentStore", () => {
  it("tracks the final text across open and incremental changes", () => {
    const store = new DocumentStore();
    store.open("file:///p/a.ts", "typescript", "const x = 1;\n");
    store.change("file:///p/a.ts", [
      {
        range: {
          end: { character: 11, line: 0 },
          start: { character: 11, line: 0 },
        },
        text: "0",
      },
    ]);
    store.change("file:///p/a.ts", [{ text: "const y = 2;\n" }]);
    expect(store.get("file:///p/a.ts")).toEqual({
      languageId: "typescript",
      text: "const y = 2;\n",
    });
    store.close("file:///p/a.ts");
    expect(store.get("file:///p/a.ts")).toBeUndefined();
  });

  it("lists every open document for respawn replay", () => {
    const store = new DocumentStore();
    store.open("file:///p/a.ts", "typescript", "a");
    store.open("file:///p/b.json", "json", "b");
    expect(store.entries().map((entry) => entry.uri)).toEqual([
      "file:///p/a.ts",
      "file:///p/b.json",
    ]);
  });
});

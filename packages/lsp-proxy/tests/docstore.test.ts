import { describe, expect, it } from "bun:test";

import { applyChanges, DocumentStore } from "../src/docstore.ts";

const LINES = "one\ntwo\nthree\n";

const at = (
  start: { character: number; line: number },
  end: { character: number; line: number },
) => ({ end, start });

const atLine1 = at({ character: 0, line: 1 }, { character: 3, line: 1 });
const atZero = at({ character: 0, line: 0 }, { character: 0, line: 0 });
const atHead = at({ character: 0, line: 0 }, { character: 3, line: 0 });
const atMidLine1 = at({ character: 0, line: 1 }, { character: 5, line: 1 });

describe("applyChanges", () => {
  it.each([
    [
      "replaces the whole text when no range is present",
      LINES,
      [{ text: "fresh" }],
      "fresh",
    ],
    [
      "applies a single ranged change",
      LINES,
      [{ range: atLine1, text: "TWO" }],
      "one\nTWO\nthree\n",
    ],
    [
      "applies an insertion as a zero-width range",
      LINES,
      [{ range: atZero, text: "> " }],
      "> one\ntwo\nthree\n",
    ],
    [
      "applies several changes in array order against the running text",
      LINES,
      [
        { range: atHead, text: "ONE" },
        { range: atMidLine1, text: "2" },
      ],
      "ONE\n2\nthree\n",
    ],
    [
      "survives a multibyte edit",
      "укр\ntext",
      [{ range: atHead, text: "тест" }],
      "тест\ntext",
    ],
  ])("%s", (_, base, changes, expected) => {
    expect(applyChanges(base, changes)).toBe(expected);
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

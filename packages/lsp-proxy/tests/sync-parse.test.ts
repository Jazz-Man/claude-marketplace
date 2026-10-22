import { describe, expect, it } from "bun:test";

import { mergeIntoLspJson } from "../src/sync-extensions.ts";

describe("mergeIntoLspJson invalid target", () => {
  it("throws a domain error when the target is not valid JSON", () => {
    expect(() => mergeIntoLspJson("{not json", {})).toThrow(
      "target .lsp.json is not valid JSON",
    );
  });
});

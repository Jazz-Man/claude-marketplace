import { describe, expect, it } from "bun:test";

import { sortByPriority } from "../src/utils/index.ts";

describe("sortByPriority", () => {
  it.each([
    [
      "by priority order",
      [
        { name: "zeta", server: "zeta" },
        { name: "alpha", server: "alpha" },
      ],
      ["alpha", "zeta"],
      ["alpha", "zeta"],
    ],
    [
      "items missing from the priority list last",
      [
        { name: "unknown", server: "unknown" },
        { name: "known", server: "known" },
      ],
      ["known"],
      ["known", "unknown"],
    ],
  ])("sorts %s", (_label, items, priority, expected) => {
    const sorted = sortByPriority(items, priority);
    expect(sorted.map((item) => item.server)).toEqual(expected);
  });

  it("does not mutate the input array", () => {
    const items = [
      { name: "zeta", server: "zeta" },
      { name: "alpha", server: "alpha" },
    ];
    const copy = [...items];
    sortByPriority(items, ["alpha", "zeta"]);
    expect(items).toEqual(copy);
  });
});

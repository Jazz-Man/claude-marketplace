import { expect, test } from "bun:test";

import plugin, { reportForbiddenComments } from "./plugin";

const loc = { column: 1, line: 1 };

function runNoComments(
  comments: { loc: object; type: string; value: string }[],
  options: unknown[] = [],
): number {
  let reported = 0;
  reportForbiddenComments(options, comments, () => {
    reported += 1;
  });
  return reported;
}

const SYSTEM_ALLOWED = [
  " eslint-disable-next-line eqeqeq",
  " eslint-enable",
  " prettier-ignore",
  " @ts-expect-error stale types until unbash 7",
  " biome-ignore lint/style/noMagicNumbers: legacy suppression",
];

const ALWAYS_FORBIDDEN = [
  " owner decision: allow this shape",
  " TODO: refactor",
  " adds two numbers and returns the sum",
  "* walked invariants for the AST walk",
  " 2026-10-15 ruling",
];

test("system prefixes pass", () => {
  for (const value of SYSTEM_ALLOWED) {
    expect(runNoComments([{ loc, type: "Line", value }])).toBe(0);
  }
});

test("everything else is forbidden across comment forms", () => {
  const forms = [
    ...ALWAYS_FORBIDDEN.map((value) => ({ loc, type: "Line", value })),
    ...ALWAYS_FORBIDDEN.map((value) => ({ loc, type: "Block", value })),
    ...ALWAYS_FORBIDDEN.map((value) => ({
      loc,
      type: "Block",
      value: `*${value}`,
    })),
  ];
  expect(forms.every((comment) => runNoComments([comment]) === 1)).toBe(true);
});

test("allow option admits extra prefixes only", () => {
  const options = [{ allow: ["NOTE:"] }];
  expect(
    runNoComments(
      [{ loc, type: "Line", value: " NOTE: keep until v2" }],
      options,
    ),
  ).toBe(0);
  expect(
    runNoComments([{ loc, type: "Line", value: " plain note" }], options),
  ).toBe(1);
});

test("self-disable guard fires and options cannot weaken it", () => {
  const guarded = [
    " eslint-disable-next-line local/no-comments",
    " eslint-disable local/no-comments",
  ];
  for (const value of guarded) {
    expect(runNoComments([{ loc, type: "Line", value }])).toBe(1);
    expect(
      runNoComments(
        [{ loc, type: "Line", value }],
        [{ allow: [value.trim()] }],
      ),
    ).toBe(1);
  }
});

test("plugin shape: single rule, local namespace", () => {
  expect(plugin.meta.name).toBe("local");
  expect(Object.keys(plugin.rules)).toEqual(["no-comments"]);
});

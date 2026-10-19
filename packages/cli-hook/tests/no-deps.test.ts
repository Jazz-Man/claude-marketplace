import { describe, expect, it } from "bun:test";

import { noDepsPolicy, REASON } from "../src/policies/no-deps.ts";
import { ALLOW, DENY } from "./fixtures/no-deps.ts";
import { policyCheck, reasonOf } from "./helpers/policy.ts";

const check = (command: string) => policyCheck(noDepsPolicy, command);

describe("no-deps policy", () => {
  it.each(DENY)("denies %s", (command) => {
    expect(reasonOf(check(command))).toBe(REASON);
  });

  it.each(ALLOW)("allows %s", (command) => {
    expect(check(command)).toBeNull();
  });
});

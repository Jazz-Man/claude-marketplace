import { describe, expect, it } from "bun:test";

import {
  FUNCTION_REASON,
  noInlineScriptsPolicy,
  REASON,
} from "../src/policies/no-inline-scripts.ts";
import { ALLOW, DENY, FUNCTIONS } from "./fixtures/no-inline-scripts.ts";
import { policyCheck, reasonOf } from "./helpers/policy.ts";

const check = (command: string) => policyCheck(noInlineScriptsPolicy, command);

describe("no-inline-scripts policy", () => {
  it.each(DENY)("denies %s", (command) => {
    expect(reasonOf(check(command))).toBe(REASON);
  });

  it.each(ALLOW)("allows %s", (command) => {
    expect(check(command)).toBeNull();
  });

  it.each(FUNCTIONS)("denies inline function definition %s", (command) => {
    expect(reasonOf(check(command))).toBe(FUNCTION_REASON);
  });
});

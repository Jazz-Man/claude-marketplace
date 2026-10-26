import { describe, expect, it } from "bun:test";

import {
  FUNCTION_REASON,
  noInlineScriptsPolicy,
  REASON,
} from "../src/policies/no-inline-scripts.ts";
import { ALLOW, DENY, FUNCTIONS } from "./fixtures/no-inline-scripts.ts";
import { policyCheck, policyTableTests, reasonOf } from "./helpers/policy.ts";

const check = (command: string) => policyCheck(noInlineScriptsPolicy, command);

describe("no-inline-scripts policy", () => {
  policyTableTests(noInlineScriptsPolicy, { allow: ALLOW, deny: DENY }, REASON);

  it.each(FUNCTIONS)("denies inline function definition %s", (command) => {
    expect(reasonOf(check(command))).toBe(FUNCTION_REASON);
  });
});

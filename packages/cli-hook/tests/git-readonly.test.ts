import { describe, expect, it } from "bun:test";

import {
  GIT_HOOK_REASON,
  GIT_READONLY_REASON,
  gitReadonlyPolicy,
} from "../src/policies/git-readonly.ts";
import { ALLOW, DENY } from "./fixtures/git-readonly.ts";
import { decisionOf, policyCheck, reasonOf } from "./helpers/policy.ts";

const check = (command: string) => policyCheck(gitReadonlyPolicy, command);

describe("git-readonly policy", () => {
  it.each(DENY)("denies %s", (command) => {
    expect(decisionOf(check(command))).toBe("deny");
  });

  it.each(ALLOW)("allows %s", (command) => {
    expect(check(command)).toBeNull();
  });

  it("the hook deny carries the dedicated hook reason", () => {
    expect(reasonOf(check("git hook run pre-commit"))).toBe(GIT_HOOK_REASON);
  });

  it("write ops carry the generic read-only reason", () => {
    expect(reasonOf(check("git push"))).toBe(GIT_READONLY_REASON);
  });
});

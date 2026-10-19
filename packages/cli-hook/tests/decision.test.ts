import { describe, expect, it } from "bun:test";

import { ask, decision, deny } from "../src/core/decision.ts";
import { decisionOf } from "./helpers/policy.ts";

describe("decision", () => {
  it("deny() builds the PreToolUse deny contract", () => {
    expect(deny("boom")).toEqual({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "boom",
      },
    });
  });

  it("defaults to PreToolUse and passes the permission through", () => {
    expect(decision("ask", "why")).toEqual({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: "why",
      },
    });
  });
});

describe("ask()", () => {
  it("emits a PreToolUse ask decision with the reason", () => {
    const out = ask("confirm with the user").hookSpecificOutput;
    expect(out.hookEventName).toBe("PreToolUse");
    expect(out.permissionDecision).toBe("ask");
    expect(out.permissionDecisionReason).toBe("confirm with the user");
  });

  it("decisionOf maps results to their decision token", () => {
    expect(decisionOf(ask("x"))).toBe("ask");
    expect(decisionOf(decision("deny", "x"))).toBe("deny");
    expect(decisionOf(null)).toBeNull();
  });
});

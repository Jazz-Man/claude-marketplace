import { expect, it } from "bun:test";

import { parseCommand } from "../../src/core/ast.ts";
import { permissionOf } from "../../src/core/decision.ts";
import type { Policy, PolicyCheckResult } from "../../src/core/policy.ts";

export function policyCheck(
  policy: Policy,
  command: string,
  paths: {
    cwd?: string;
    projectRoot?: string;
  } = {},
): PolicyCheckResult {
  const cwd = paths.cwd ?? "/proj";
  const projectRoot = paths.projectRoot ?? cwd;
  const cmd = parseCommand(command);
  if (cmd === null) {
    return null;
  }
  return policy.check(cmd, {
    cwd,
    projectRoot,
  });
}

export function decisionOf(result: PolicyCheckResult): "deny" | "ask" | null {
  return permissionOf(result);
}

export function reasonOf(result: PolicyCheckResult): string | undefined {
  const out = result?.hookSpecificOutput;
  if (out?.hookEventName === "PreToolUse") {
    return out.permissionDecisionReason;
  }
  return undefined;
}

export function policyTableTests(
  policy: Policy,
  tables: { allow: string[]; deny: string[] },
  reason: string,
): void {
  const check = (command: string) => policyCheck(policy, command);
  it.each(tables.deny)("denies %s", (command) => {
    expect(reasonOf(check(command))).toBe(reason);
  });
  it.each(tables.allow)("allows %s", (command) => {
    expect(check(command)).toBeNull();
  });
}

export function decisionTableTests(
  policy: Policy,
  decisions: { allow: string[]; ask: string[]; deny: string[] },
): void {
  const check = (command: string) => policyCheck(policy, command);
  const registerTier = (
    title: string,
    table: string[],
    decision: "deny" | "ask",
  ) => {
    it.each(table)(title, (command) => {
      expect(decisionOf(check(command))).toBe(decision);
    });
  };
  registerTier("denies %s", decisions.deny, "deny");
  registerTier("asks on %s", decisions.ask, "ask");
  it.each(decisions.allow)("allows %s", (command) => {
    expect(check(command)).toBeNull();
  });
}

import { expect, it } from "bun:test";

import { parseCommand } from "../../src/core/ast.ts";
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
  const out = result?.hookSpecificOutput;
  if (out?.hookEventName !== "PreToolUse") {
    return null;
  }
  const decision = out.permissionDecision;
  if (decision === "deny" || decision === "ask") {
    return decision;
  }
  return null;
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

import { parseCommand } from "../../src/core/ast.ts";
import type { Policy, PolicyCheckResult } from "../../src/core/policy.ts";

export function policyCheck(
  policy: Policy,
  command: string,
  paths: { cwd?: string; projectRoot?: string } = {},
): PolicyCheckResult {
  const cwd = paths.cwd ?? "/proj";
  const projectRoot = paths.projectRoot ?? cwd;
  const cmd = parseCommand(command);
  if (cmd === null) {
    return null;
  }
  return policy.check(cmd, { cwd, projectRoot });
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

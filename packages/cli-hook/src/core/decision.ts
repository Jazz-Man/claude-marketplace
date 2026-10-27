import type {
  PreToolUseHookSpecificOutput,
  SyncHookJSONOutput,
} from "@cc-sdd/agent-types";

export type Permission = "allow" | "deny" | "ask";

export const decision = (
  permission: Permission,
  reason: string,
): {
  hookSpecificOutput: PreToolUseHookSpecificOutput;
} => ({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: permission,
    permissionDecisionReason: reason,
  },
});

export const deny = (reason: string) => decision("deny", reason);

export const ask = (reason: string) => decision("ask", reason);

export function permissionOf(
  result: SyncHookJSONOutput | null,
): "deny" | "ask" | null {
  const out = result?.hookSpecificOutput;
  if (out?.hookEventName !== "PreToolUse") {
    return null;
  }
  const permission = out.permissionDecision;
  if (permission === "deny" || permission === "ask") {
    return permission;
  }
  return null;
}

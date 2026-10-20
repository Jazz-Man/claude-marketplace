import type { PreToolUseHookSpecificOutput } from "@cc-sdd/agent-types";

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

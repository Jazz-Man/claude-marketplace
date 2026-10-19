import type { PreToolUseHookSpecificOutput } from "@cc-sdd/agent-types";

export type Permission = "allow" | "deny" | "ask";

export function decision(
  permission: Permission,
  reason: string,
): { hookSpecificOutput: PreToolUseHookSpecificOutput } {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: permission,
      permissionDecisionReason: reason,
    },
  };
}

export function deny(reason: string): {
  hookSpecificOutput: PreToolUseHookSpecificOutput;
} {
  return decision("deny", reason);
}

export function ask(reason: string): {
  hookSpecificOutput: PreToolUseHookSpecificOutput;
} {
  return decision("ask", reason);
}

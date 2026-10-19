import type { SyncHookJSONOutput } from "@cc-sdd/agent-types";

import type { ParsedCommand } from "./ast.ts";

export type PolicyCheckResult = SyncHookJSONOutput | null;

// Per-invocation facts from the hook payload (cwd is required by the SDK's
// PreToolUseHookInput contract). Policies that need none of it declare only
// the cmd parameter — fewer-parameter implementations are assignable to the
// check signature.
export interface PolicyContext {
  cwd: string;
  // Stable project root (CLAUDE_PROJECT_DIR, falling back to cwd): scope
  // analysis runs against it, while cwd is the per-call working directory.
  projectRoot: string;
}

// A policy inspects a parsed Bash command and either decides (deny/ask/allow
// JSON out) or returns null for "no opinion". Policies are pure functions;
// the router (main.ts) owns the order and the first decision wins.
export interface Policy {
  check: (cmd: ParsedCommand, context: PolicyContext) => PolicyCheckResult;
  name: string;
}

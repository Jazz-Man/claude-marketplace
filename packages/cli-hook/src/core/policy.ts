import type { SyncHookJSONOutput } from "@cc-sdd/agent-types";

import type { ParsedCommand } from "./ast.ts";

export type PolicyCheckResult = SyncHookJSONOutput | null;

export interface PolicyContext {
  cwd: string;
  projectRoot: string;
}

export interface Policy {
  check: (cmd: ParsedCommand, context: PolicyContext) => PolicyCheckResult;
  name: string;
}

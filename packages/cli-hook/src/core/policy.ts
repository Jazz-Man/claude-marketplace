import type { SyncHookJSONOutput } from "@cc-sdd/agent-types";

import type { CommandUnit, ParsedCommand } from "./ast.ts";

export type PolicyCheckResult = SyncHookJSONOutput | null;

export interface PolicyContext {
  cwd: string;
  projectRoot: string;
}

export interface Policy {
  check: (cmd: ParsedCommand, context: PolicyContext) => PolicyCheckResult;
  name: string;
}

export function firstUnitHit(
  units: readonly CommandUnit[],
  hit: (unit: CommandUnit) => PolicyCheckResult,
): PolicyCheckResult {
  for (const unit of units) {
    const result = hit(unit);
    if (result !== null) {
      return result;
    }
  }
  return null;
}

import process from "node:process";

import type { SyncHookJSONOutput } from "@cc-sdd/agent-types";

import { parseCommand } from "./core/ast.ts";
import * as hookPayload from "./core/payload.ts";
import type { Policy } from "./core/policy.ts";
import {
  checkFilePath,
  filesystemPolicy,
} from "./policies/filesystem/policy.ts";
import { gitReadonlyPolicy } from "./policies/git-readonly.ts";
import { noDepsPolicy } from "./policies/no-deps.ts";
import { noInlineScriptsPolicy } from "./policies/no-inline-scripts.ts";

const POLICIES: Policy[] = [
  noDepsPolicy,
  gitReadonlyPolicy,
  noInlineScriptsPolicy,
  filesystemPolicy,
];

const READ_TOOLS = new Set(["Read"]);
const WRITE_TOOLS = new Set(["Edit", "Write", "NotebookEdit"]);

function projectRootOf(payload: hookPayload.ParsedHookInput): string {
  // @effect-diagnostics-next-line processEnv:off
  return process.env.CLAUDE_PROJECT_DIR ?? payload.cwd;
}

function routeBash(
  payload: hookPayload.ParsedHookInput,
): SyncHookJSONOutput | null {
  if (payload.command === undefined) {
    return null;
  }
  const cmd = parseCommand(payload.command);
  if (cmd === null) {
    return null;
  }
  for (const policy of POLICIES) {
    const result = policy.check(cmd, {
      cwd: payload.cwd,
      projectRoot: projectRootOf(payload),
    });
    if (result !== null) {
      return result;
    }
  }
  return null;
}

function routeFileTool(
  payload: hookPayload.ParsedHookInput,
): SyncHookJSONOutput | null {
  if (payload.filePath === undefined) {
    return null;
  }
  let intent: "read" | "write" = "write";
  if (READ_TOOLS.has(payload.toolName)) {
    intent = "read";
  }
  return checkFilePath(payload.filePath, intent, {
    cwd: payload.cwd,
    projectRoot: projectRootOf(payload),
  });
}

export function runHook(input: unknown): SyncHookJSONOutput | null {
  try {
    const payload = hookPayload.toHookInput(input);
    if (payload === null || payload.hookEventName !== "PreToolUse") {
      return null;
    }
    if (payload.toolName === "Bash") {
      return routeBash(payload);
    }
    if (READ_TOOLS.has(payload.toolName) || WRITE_TOOLS.has(payload.toolName)) {
      return routeFileTool(payload);
    }
    return null;
  } catch {
    return null;
  }
}

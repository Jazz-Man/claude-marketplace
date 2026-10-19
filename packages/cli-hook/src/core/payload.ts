import type { PreToolUseHookInput } from "@cc-sdd/agent-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringField(
  record: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      return value;
    }
  }
  return undefined;
}

export interface ParsedHookInput {
  command: string | undefined;
  // Field availability mirrors the SDK contract: BaseHookInput.cwd is a
  // required string on every hook payload.
  cwd: PreToolUseHookInput["cwd"];
  filePath: string | undefined; // tool_input.file_path / notebook_path
  hookEventName: string;
  toolName: string;
}

interface ToolFields {
  command: string | undefined;
  filePath: string | undefined;
}

function toolFields(data: unknown): ToolFields {
  if (!isRecord(data)) {
    return { command: undefined, filePath: undefined };
  }
  return {
    command: stringField(data, "command"),
    filePath: stringField(data, "file_path", "notebook_path"),
  };
}

// Narrow the runtime-parsed hook payload (Bun.stdin.json() output) into a
// typed shape, or null when it is not a hook payload we can reason about
// (fail-open starts here). Nothing parses text: the runtime already did.
export function toHookInput(data: unknown): ParsedHookInput | null {
  if (!isRecord(data)) {
    return null;
  }
  if (
    typeof data.hook_event_name !== "string" ||
    typeof data.tool_name !== "string"
  ) {
    return null;
  }
  const { command, filePath } = toolFields(data.tool_input);
  // cwd is a required field of the SDK's PreToolUseHookInput (BaseHookInput);
  // a payload without a usable cwd is not a payload we can reason about.
  const { cwd } = data;
  if (typeof cwd !== "string" || cwd === "") {
    return null;
  }
  return {
    command,
    cwd,
    filePath,
    hookEventName: data.hook_event_name,
    toolName: data.tool_name,
  };
}

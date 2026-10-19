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

export interface ParsedHookInput {
  command: string | undefined;
  cwd: PreToolUseHookInput["cwd"];
  filePath: string | undefined;
  hookEventName: string;
  toolName: string;
}

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

import { describe, expect, it } from "bun:test";

import { toHookInput } from "../src/core/payload.ts";

const PAYLOAD = {
  cwd: "/proj",
  hook_event_name: "PreToolUse",
  tool_input: { command: "git push" },
  tool_name: "Bash",
};

describe("toHookInput", () => {
  it("narrows a Bash PreToolUse payload", () => {
    expect(toHookInput(PAYLOAD)).toEqual({
      command: "git push",
      cwd: "/proj",
      filePath: undefined,
      hookEventName: "PreToolUse",
      toolName: "Bash",
    });
  });

  it("keeps a defined-but-empty command (not undefined)", () => {
    const parsed = toHookInput({ ...PAYLOAD, tool_input: { command: "" } });
    expect(parsed?.command).toBe("");
  });

  it("treats a non-string command field as absent", () => {
    const parsed = toHookInput({ ...PAYLOAD, tool_input: { command: 42 } });
    expect(parsed?.command).toBeUndefined();
  });

  it("returns null for non-object input", () => {
    const numericInput = 42;
    expect(toHookInput(numericInput)).toBeNull();
    expect(toHookInput("not json")).toBeNull();
    expect(toHookInput(null)).toBeNull();
    expect(toHookInput([1, 2])).toBeNull();
  });

  it("returns null when event or tool name is missing", () => {
    expect(toHookInput({})).toBeNull();
    expect(toHookInput({ tool_name: "Bash" })).toBeNull();
    expect(toHookInput({ hook_event_name: "PreToolUse" })).toBeNull();
  });

  it("returns null when cwd is missing, non-string, or empty", () => {
    const { cwd: _cwd, ...withoutCwd } = PAYLOAD;
    expect(toHookInput(withoutCwd)).toBeNull();
    expect(toHookInput({ ...PAYLOAD, cwd: 42 })).toBeNull();
    expect(toHookInput({ ...PAYLOAD, cwd: "" })).toBeNull();
  });

  it("extracts file_path and notebook_path", () => {
    const r1 = toHookInput({
      cwd: "/p",
      hook_event_name: "PreToolUse",
      tool_input: { file_path: "/etc/passwd" },
      tool_name: "Read",
    });
    expect(r1?.filePath).toBe("/etc/passwd");
    const r2 = toHookInput({
      cwd: "/p",
      hook_event_name: "PreToolUse",
      tool_input: { notebook_path: "/p/n.ipynb" },
      tool_name: "NotebookEdit",
    });
    expect(r2?.filePath).toBe("/p/n.ipynb");
  });
});

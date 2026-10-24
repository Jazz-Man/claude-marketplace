import { describe, expect, it } from "bun:test";
import { homedir } from "node:os";

import { memoryReason } from "../src/policies/filesystem/reasons.ts";
import { runHook } from "../src/run-hook.ts";
import { decisionOf, reasonOf } from "./helpers/policy.ts";
import { filePayload } from "./helpers/utils.ts";

describe("project memory (file tools)", () => {
  const MEM = "~/.claude/projects/-proj-x/memory";

  it.each(["Write", "Edit", "NotebookEdit"])(
    "asks on %s into memory .md",
    (tool) => {
      const decision = decisionOf(runHook(filePayload(tool, `${MEM}/fact.md`)));
      expect(decision).toBe("ask");
    },
  );

  it("asks with the plain wording for .md and the dir itself", () => {
    expect(reasonOf(runHook(filePayload("Write", `${MEM}/fact.md`)))).toBe(
      memoryReason(`${MEM}/fact.md`, true),
    );
    expect(reasonOf(runHook(filePayload("Write", `${MEM}`)))).toBe(
      memoryReason(`${MEM}`, true),
    );
  });

  it.each([`${MEM}/fact.txt`, `${MEM}/noext`, `${MEM}/note.MD`])(
    "asks with the non-md wording on %s",
    (filePath) => {
      expect(reasonOf(runHook(filePayload("Write", filePath)))).toBe(
        memoryReason(filePath, false),
      );
    },
  );

  it.each([
    "$HOME/.claude/projects/-proj-x/memory/f.md",
    "${HOME}/.claude/projects/-proj-x/memory/f.md",
    `${homedir()}/.claude/projects/-proj-x/memory/f.md`,
  ])("normalizes %s", (filePath) => {
    expect(decisionOf(runHook(filePayload("Write", filePath)))).toBe("ask");
  });

  it("keeps memory reads free", () => {
    expect(runHook(filePayload("Read", `${MEM}/fact.md`))).toBeNull();
  });

  it("does not touch sibling paths under .claude/projects", () => {
    expect(
      runHook(
        filePayload("Write", "~/.claude/projects/-proj-x/transcripts/t.jsonl"),
      ),
    ).toBeNull();
    expect(
      runHook(
        filePayload("Write", "~/.claude/projects/-proj-x/memory-backup/f.md"),
      ),
    ).toBeNull();
  });
});

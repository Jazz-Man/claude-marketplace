import { parse, relative } from "node:path";
import { HOME } from "./resolve.ts";

const PROJECTS_ROOT = `${HOME}/.claude/projects`;

export type MemoryTarget = "dir" | "md" | "other";

export function memoryTargetOf(abs: string): MemoryTarget | null {
  if (HOME === "") {
    return null;
  }
  const rel = relative(PROJECTS_ROOT, abs);
  if (rel === "" || rel.startsWith("..")) {
    return null;
  }
  const segments = rel.split("/");
  if (segments[1] !== "memory") {
    return null;
  }
  if (segments.length === 2) {
    return "dir";
  }
  return parse(abs).ext === ".md" ? "md" : "other";
}

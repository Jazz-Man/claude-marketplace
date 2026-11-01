import { parse, relative } from "node:path";
import { HOME } from "./resolve.ts";

export const PROJECTS_ROOT = `${HOME}/.claude/projects`;

const PROJECTS_PREFIX = `${PROJECTS_ROOT}/`;

export type MemoryTarget = "dir" | "md" | "other";

export function memoryTargetOf(abs: string): MemoryTarget | null {
  if (HOME === "" || !abs.startsWith(PROJECTS_PREFIX)) {
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

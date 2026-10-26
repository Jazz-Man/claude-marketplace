import type { ParseResult } from "../../src/config.ts";

export interface ServerEntry {
  command: string;
  extensionToLanguage: Record<string, string>;
  name: string;
}

export interface ServerSet {
  servers: ServerEntry[];
}

export const serverEntry = (
  name: string,
  command: string,
  extensionToLanguage: Record<string, string>,
): ServerEntry => ({ command, extensionToLanguage, name });

export function serverPair(first: string, second: string): ServerSet {
  const a = serverEntry("a", "a", { ".ts": first });
  const b = serverEntry("b", "b", { ".ts": second });
  return { servers: [a, b] };
}

export function violationText(parsed: ParseResult): string {
  if (parsed.ok) {
    return "";
  }
  return parsed.errors.join("\n");
}

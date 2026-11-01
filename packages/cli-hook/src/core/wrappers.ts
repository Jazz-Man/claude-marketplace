import { parseEnv } from "node:util";

export const SHARED_WRAPPERS: ReadonlySet<string> = new Set([
  "env",
  "nice",
  "nohup",
  "parallel",
  "sudo",
  "time",
  "timeout",
  "xargs",
]);

export const isAssignment = (token: string): boolean =>
  token.includes("=") && Object.keys(parseEnv(token)).length > 0;

export const isNoiseToken = (token: string): boolean =>
  token.startsWith("-") || isAssignment(token);

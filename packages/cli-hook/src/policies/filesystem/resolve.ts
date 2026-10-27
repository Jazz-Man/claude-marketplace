import { homedir } from "node:os";
import { isAbsolute, join, normalize } from "node:path";

import type { PolicyContext } from "../../core/policy.ts";

const HOME_HEAD = /^\$HOME(?![A-Za-z0-9_])/u;

function expandHomeToken(token: string): string | null {
  if (HOME === "") {
    return null;
  }
  if (token === "~") {
    return normalize(HOME);
  }
  return normalize(join(HOME, token.slice(2)));
}

interface NameValue {
  name: string;
  value: string;
}

function splitPair(token: string): NameValue | null {
  if (!token.includes("=")) {
    return null;
  }
  try {
    const cookie = Bun.Cookie.parse(token);
    return {
      name: cookie.name,
      value: cookie.value,
    };
  } catch {
    return null;
  }
}

const SAFE_DEVICES = new Set([
  "/dev/null",
  "/dev/stdin",
  "/dev/stdout",
  "/dev/stderr",
  "/dev/zero",
  "/dev/urandom",
  "/dev/random",
]);

const TMP_PREFIXES = [
  "/tmp/",
  "/private/tmp/",
  "/var/tmp/",
  "/private/var/tmp/",
];

function proseCandidates(arg: string): string[] {
  if (arg.startsWith("-")) {
    return [];
  }
  return [arg];
}

function pairCandidates(arg: string, pair: NameValue): string[] {
  const { name, value } = pair;
  if (name.startsWith("-")) {
    return flagPairCandidates(arg, value);
  }
  return valuePairCandidates(arg, value);
}

function flagPairCandidates(arg: string, value: string): string[] {
  let truncated = value;
  if (value.startsWith("@")) {
    truncated = value.slice(1);
  }
  if (!arg.includes(";")) {
    return [truncated];
  }
  return unionFullValue(arg, truncated);
}

function unionFullValue(arg: string, truncated: string): string[] {
  const full = arg.slice(arg.indexOf("=") + 1);
  if (full.startsWith("@")) {
    return [truncated, full.slice(1)];
  }
  return [truncated, full];
}

function valuePairCandidates(arg: string, value: string): string[] {
  if (!value.startsWith("@")) {
    return midAtCandidates(arg);
  }
  const truncated = value.slice(1);
  if (!arg.includes(";")) {
    return [truncated];
  }
  return [truncated, arg.slice(arg.indexOf("=@") + 2)];
}

function midAtCandidates(arg: string): string[] {
  const midAt = arg.indexOf("=@");
  if (midAt !== -1) {
    return [arg, arg.slice(midAt + 2)];
  }
  return [arg];
}

export function homeVarToTilde(token: string): string | null {
  if (token.startsWith("${HOME}")) {
    return `~${token.slice(7)}`;
  }
  if (HOME_HEAD.test(token)) {
    return `~${token.slice(5)}`;
  }
  return null;
}

export function tildeUser(token: string): boolean {
  return token.startsWith("~") && token !== "~" && !token.startsWith("~/");
}

export function unresolvedVar(token: string): boolean {
  const anchored = homeVarToTilde(token);
  if (anchored === null) {
    return token.includes("$");
  }
  return (
    anchored.includes("$") || (anchored !== "~" && !anchored.startsWith("~/"))
  );
}

export function pathCandidates(arg: string): string[] {
  if (arg.startsWith("@")) {
    return [arg.slice(1)];
  }
  const pair = splitPair(arg);
  if (pair === null) {
    return proseCandidates(arg);
  }
  return pairCandidates(arg, pair);
}

export function inHome(absPath: string): boolean {
  return HOME !== "" && (absPath === HOME || absPath.startsWith(`${HOME}/`));
}

export function inAllowedZone(
  absPath: string,
  context: PolicyContext,
): boolean {
  if (SAFE_DEVICES.has(absPath)) {
    return true;
  }
  if (inHome(absPath)) {
    return true;
  }
  const root = normalize(context.projectRoot);
  return absPath === root || absPath.startsWith(`${root}/`);
}

export function isTmpPath(absPath: string): boolean {
  const lowercased = absPath.toLowerCase();
  return (
    lowercased === "/tmp" ||
    TMP_PREFIXES.some((pre) => lowercased.startsWith(pre))
  );
}

export const TMP_HINT =
  " For scratch files, write to ./tmp/ at the project root — it is git-ignored there.";

export function expandToken(
  token: string,
  context: PolicyContext,
): string | null {
  const anchored = homeVarToTilde(token) ?? token;
  if (anchored === "~" || anchored.startsWith("~/")) {
    return expandHomeToken(anchored);
  }
  if (isAbsolute(anchored)) {
    return normalize(anchored);
  }
  return normalize(join(context.cwd, anchored));
}

export const HOME = homedir();

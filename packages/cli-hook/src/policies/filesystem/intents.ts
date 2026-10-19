import { parseEnv } from "node:util";

import * as ast from "../../core/ast.ts";

function isAssignment(token: string): boolean {
  return Object.keys(parseEnv(token)).length > 0;
}

const INTENTS: Record<string, Intent> = {
  cat: "read",
  chmod: "write",
  chown: "write",
  "cp": "write",
  "dd": "write",
  "df": "read",
  diff: "read",
  "du": "read",
  file: "read",
  find: "read",
  grep: "read",
  head: "read",
  install: "write",
  less: "read",
  "ln": "write",
  "ls": "read",
  md5sum: "read",
  mkdir: "write",
  more: "read",
  "mv": "write",
  "rg": "read",
  "rm": "delete",
  rmdir: "delete",
  rsync: "write",
  shasum: "read",
  shred: "delete",
  stat: "read",
  tail: "read",
  tar: "write",
  tee: "write",
  touch: "write",
  tree: "read",
  truncate: "write",
  unlink: "delete",
  "wc": "read",
};

const NETWORK_TOOLS = new Set([
  "curl",
  "wget",
  "nc",
  "ssh",
  "scp",
  "sftp",
  "ping",
  "dig",
  "host",
  "nslookup",
  "whois",
  "openssl",
]);

const WRAPPERS = new Set(["env", "nice", "nohup", "timeout", "xargs"]);

function isScanNoise(token: string): boolean {
  return token.startsWith("-") || isAssignment(token);
}

function resolveToken(
  token: string,
  network: string | null,
): { intent: Intent | null; network: string | null } {
  const known = INTENTS[ast.baseName(token)];
  if (known !== undefined) {
    return { intent: known, network };
  }
  if (network === null && NETWORK_TOOLS.has(ast.baseName(token))) {
    return { intent: null, network: ast.baseName(token) };
  }
  return { intent: null, network };
}

function unwrapScan(
  args: string[],
  sudoIn: boolean,
  networkIn: string | null,
): Unwrapped {
  let sudo = sudoIn;
  let network = networkIn;
  for (const [index, token] of args.entries()) {
    sudo ||= token === "sudo";
    if (token !== "sudo" && !isScanNoise(token)) {
      const resolved = resolveToken(token, network);
      if (resolved.intent !== null) {
        return {
          intent: resolved.intent,
          network: resolved.network,
          rest: args.slice(index + 1),
          sudo,
        };
      }
      ({ network } = resolved);
    }
  }
  return { intent: null, network, rest: args, sudo };
}

interface Unwrapped {
  intent: Intent | null;
  network: string | null;
  rest: string[];
  sudo: boolean;
}

export type Intent = "read" | "write" | "delete";

export function intentOf(name: string, args: string[]): Unwrapped {
  const base = ast.baseName(name);
  const intent: Intent | null = INTENTS[base] ?? null;
  let network: string | null = null;
  if (NETWORK_TOOLS.has(base)) {
    network = base;
  }
  const sudo = name === "sudo";
  if (!WRAPPERS.has(name) && name !== "sudo") {
    return { intent, network, rest: args, sudo };
  }
  return unwrapScan(args, sudo, network);
}

export function redirectTargets(
  cmd: ast.ParsedCommand,
): { intent: Intent; token: string }[] {
  const out: { intent: Intent; token: string }[] = [];
  for (const redirect of cmd.redirects) {
    if (redirect.operator === "<") {
      out.push({ intent: "read", token: redirect.target });
    } else {
      out.push({ intent: "write", token: redirect.target });
    }
  }
  return out;
}

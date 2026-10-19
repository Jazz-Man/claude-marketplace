import { parseEnv } from "node:util";

import * as ast from "../../core/ast.ts";

// NAME=VALUE assignment token: a wrapper's variable assignments ride the
// prefix region, they are never the command. node:util parseEnv detects
// them gracefully ({}) on non-assignments and handles quoted values
// (X="a b").
function isAssignment(token: string): boolean {
  return Object.keys(parseEnv(token)).length > 0;
}

// Intent per command base name (baseName strips version suffixes). Keys are
// sorted per assist convention — the grouping lives in the VALUES: reads,
// writes, deletes.
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

// Network tools deny on the unwrapped unit name alone (spec §7.3 blanket):
// no network command runs, so nothing about one is parsed. The wrapper scan
// flags them wherever seen — like sudo — so `env curl …` denies like
// `env sudo …` does.
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

// Wrappers: the real command is args[0] (unbash flattens `env rm …`).
// `sudo` is NOT a wrapper here — any unit reaching sudo denies outright
// (SUDO_REASON). Deliberately NOT shared with
// no-inline-scripts' WRAPPERS: the sets encode different rules (interpreter
// adjacency vs intent unwrapping — e.g. `find` is a wrapper there but a
// read-intent command here); merging couples them.
const WRAPPERS = new Set(["env", "nice", "nohup", "timeout", "xargs"]);

// Prefix-region noise: `-`-head option tokens and NAME=VALUE assignments
// never name the command. Unknown bare tokens stay in the walk — they can
// still flag a NETWORK_TOOLS entry.
function isScanNoise(token: string): boolean {
  return token.startsWith("-") || isAssignment(token);
}

// Intent resolution for one non-noise wrapper-region token: the INTENTS hit
// resolves the command, otherwise a NETWORK_TOOLS basename arms the network
// flag. Both key on the version-stripped base name.
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

// Unwrap transparent wrappers across their own options and env assignments
// (`env X=1 tee`, `nice -n 5 cp`, `timeout 10 rm`, `xargs -I{} rm`,
// `env -u X sudo …`). The scan walks the prefix region left-to-right:
// noise tokens (isScanNoise) are skipped for intent resolution, sudo and
// NETWORK_TOOLS names are flagged wherever seen in the region — both deny
// on the unwrapped name, before any argument walk. The first INTENTS-known
// token is the command; none found → intent null and rest = the full args
// (any-intent tier/boundary checks still see them).
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

// Redirect targets with their direction (parseCommand surfaces the exact
// operator+target pairs; unit args never carry them): `< x` is a read,
// every other redirection is a write.
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

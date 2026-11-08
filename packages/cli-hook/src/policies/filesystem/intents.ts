import * as ast from "../../core/ast.ts";
import { isNoiseToken, SHARED_WRAPPERS } from "../../core/wrappers.ts";

export type Intent = "read" | "write" | "delete";

const DELETE_TOOLS = ["rm", "rmdir", "shred", "unlink"] as const;
const READ_TOOLS = [
  "cat",
  "df",
  "diff",
  "du",
  "file",
  "find",
  "grep",
  "head",
  "less",
  "ls",
  "md5sum",
  "more",
  "perl",
  "rg",
  "sed",
  "shasum",
  "stat",
  "tail",
  "tree",
  "wc",
] as const;
const WRITE_TOOLS = [
  "chmod",
  "chown",
  "cp",
  "dd",
  "install",
  "ln",
  "mkdir",
  "mv",
  "rsync",
  "tar",
  "tee",
  "touch",
  "truncate",
] as const;

export const INTENTS = new Map<string, Intent>();
for (const name of DELETE_TOOLS) {
  INTENTS.set(name, "delete");
}
for (const name of READ_TOOLS) {
  INTENTS.set(name, "read");
}
for (const name of WRITE_TOOLS) {
  INTENTS.set(name, "write");
}

export const NETWORK_TOOLS = new Set([
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

function resolveToken(
  token: string,
  network: string | null,
): {
  intent: Intent | null;
  network: string | null;
} {
  const base = ast.baseName(token);
  const known = INTENTS.get(base);
  if (known !== undefined) {
    return {
      intent: known,
      network,
    };
  }
  if (network === null && NETWORK_TOOLS.has(base)) {
    return {
      intent: null,
      network: base,
    };
  }
  return {
    intent: null,
    network,
  };
}

function unwrapScan(args: string[], networkIn: string | null): Unwrapped {
  let network = networkIn;
  for (const [index, token] of args.entries()) {
    if (!isNoiseToken(token)) {
      const resolved = resolveToken(token, network);
      if (resolved.intent !== null) {
        const rest = args.slice(index + 1);
        return {
          intent: adjustForFlags(ast.baseName(token), resolved.intent, rest),
          network: resolved.network,
          rest,
        };
      }
      ({ network } = resolved);
    }
  }
  return {
    intent: null,
    network,
    rest: args,
  };
}

interface Unwrapped {
  intent: Intent | null;
  network: string | null;
  rest: string[];
}

export const IN_PLACE_CLUSTER = /^-[A-Za-z]*i[A-Za-z]*$/u;

function adjustForFlags(
  base: string,
  intent: Intent | null,
  args: readonly string[],
): Intent | null {
  if (base === "find" && args.includes("-delete")) {
    return "delete";
  }
  if (
    (base === "sed" || base === "perl") &&
    args.some((arg) => IN_PLACE_CLUSTER.test(arg))
  ) {
    return "write";
  }
  return intent;
}

export function intentOf(name: string, args: string[]): Unwrapped {
  const base = ast.baseName(name);
  const intent: Intent | null = INTENTS.get(base) ?? null;
  let network: string | null = null;
  if (NETWORK_TOOLS.has(base)) {
    network = base;
  }
  if (!SHARED_WRAPPERS.has(name)) {
    return {
      intent: adjustForFlags(base, intent, args),
      network,
      rest: args,
    };
  }
  return unwrapScan(args, network);
}

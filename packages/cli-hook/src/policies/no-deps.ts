import { baseName } from "../core/ast.ts";
import { deny } from "../core/decision.ts";
import { firstUnitHit, type Policy } from "../core/policy.ts";
import commandList from "../mutable-commands.txt";

const ALIASES: Record<string, string> = {
  bundler: "bundle",
  yarnpkg: "yarn",
};

function isUrl(value: string): boolean {
  return URL.canParse(value);
}

function isModuleRef(value: string): boolean {
  const at = value.lastIndexOf("@");
  if (at <= 0) {
    return false;
  }
  const prefix = `https://${value.slice(0, at)}`;
  if (!URL.canParse(prefix)) {
    return false;
  }
  const { host } = new URL(prefix);
  return host !== "" && host !== ".";
}

const FETCH_FORMS: readonly [
  string,
  readonly string[],
  (arg: string) => boolean,
][] = [
  ["go", ["run"], isModuleRef],
  ["deno", ["run"], isUrl],
];

type Pattern = readonly string[];

const toolCache = new Map<string, string>();
function toolOf(name: string): string {
  const cached = toolCache.get(name);
  if (cached !== undefined) {
    return cached;
  }
  const raw = name.toLowerCase();
  const tool = baseName(ALIASES[raw] ?? raw);
  toolCache.set(name, tool);
  return tool;
}

const RUNNERS = new Set<string>();
const source = new Map<string, Set<string>>();
const lines = commandList
  .split("\n")
  .map((line) => line.trim().toLowerCase())
  .filter((line) => line !== "" && !line.includes("<"));
for (const line of lines) {
  const [name, ...pattern] = line.split(/\s+/u);
  const tool = toolOf(name ?? "");
  if (pattern.length === 0) {
    RUNNERS.add(tool);
  } else {
    const joined = source.get(tool) ?? new Set<string>();
    joined.add(pattern.join(" "));
    source.set(tool, joined);
  }
}
const DENY = new Map<string, readonly Pattern[]>(
  [...source].map(([tool, joined]) => [
    tool,
    [...joined].map((pattern) => pattern.split(" ")),
  ]),
);

function startsWithTokens(tokens: readonly string[], args: string[]): boolean {
  return (
    tokens.length <= args.length &&
    tokens.every((token, index) => token === args[index]?.toLowerCase())
  );
}

function fetches(tool: string, args: string[]): boolean {
  return FETCH_FORMS.some(([prefix, tokens, isFetch]) => {
    if (prefix !== tool) {
      return false;
    }
    const spec = args[tokens.length];
    return (
      spec !== undefined && startsWithTokens(tokens, args) && isFetch(spec)
    );
  });
}

function denies(name: string, args: string[]): boolean {
  const tool = toolOf(name);
  if (RUNNERS.has(tool)) {
    return true;
  }
  const patterns = DENY.get(tool);
  if (patterns?.some((pattern) => startsWithTokens(pattern, args))) {
    return true;
  }
  return fetches(tool, args);
}

export const REASON =
  "Dependency install/update blocked: do not install, update, or remove packages (pip/uv/pipx/poetry, npm/npx/pnpm/pnpx/yarn, bun/bunx, cargo/rustup, composer, gem/bundler, go, swift package, brew, nix) or run one-shot package runners.";

/**
 * @deprecated
 */
export const noDepsPolicy: Policy = {
  check(cmd) {
    return firstUnitHit(cmd.units, (unit) =>
      denies(unit.name, unit.args) ? deny(REASON) : null,
    );
  },
  name: "no-deps",
};

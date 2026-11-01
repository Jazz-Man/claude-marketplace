import { baseName } from "../core/ast.ts";
import { deny } from "../core/decision.ts";
import type { Policy } from "../core/policy.ts";
import commandList from "../mutable-commands.txt";

const ALIASES: Record<string, string> = {
  bundler: "bundle",
  yarnpkg: "yarn",
};

const FETCH_FORMS: readonly [
  string,
  readonly string[],
  (arg: string) => boolean,
][] = [
  ["go", ["run"], (arg) => arg.includes("@")],
  ["deno", ["run"], (arg) => /^(?:https?:|npm:|jsr:)/u.test(arg)],
];

function toolOf(name: string): string {
  const raw = name.toLowerCase();
  return baseName(ALIASES[raw] ?? raw);
}

const RUNNERS = new Set<string>();
const DENY = new Map<string, Set<string>>();
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
    const patterns = DENY.get(tool) ?? new Set<string>();
    patterns.add(pattern.join(" "));
    DENY.set(tool, patterns);
  }
}

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
  if (patterns !== undefined) {
    for (const pattern of patterns) {
      if (startsWithTokens(pattern.split(" "), args)) {
        return true;
      }
    }
  }
  return fetches(tool, args);
}

export const REASON =
  "Dependency install/update blocked: do not install, update, or remove packages (pip/uv/pipx/poetry, npm/npx/pnpm/pnpx/yarn, bun/bunx, cargo/rustup, composer, gem/bundler, go, swift package, brew, nix) or run one-shot package runners.";

export const noDepsPolicy: Policy = {
  check(cmd) {
    for (const unit of cmd.units) {
      if (denies(unit.name, unit.args)) {
        return deny(REASON);
      }
    }
    return null;
  },
  name: "no-deps",
};

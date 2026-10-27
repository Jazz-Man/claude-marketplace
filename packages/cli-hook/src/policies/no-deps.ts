import { baseName } from "../core/ast.ts";
import { deny } from "../core/decision.ts";
import type { Policy } from "../core/policy.ts";

const JS_TOOLS = ["bun", "npm", "pnpm", "yarn"] as const;
const PY_TOOLS = ["pip", "pip3"] as const;
const ALWAYS_MUTATES = ["bunx", "npx", "uvx"] as const;

const VERBS: Readonly<Record<string, readonly string[]>> = {
  add: ["bun", "cargo", "deno", "pnpm", "poetry", "uv", "yarn"],
  autoremove: ["brew"],
  bundle: ["brew"],
  cache: ["deno"],
  ci: ["npm"],
  create: ["npm"],
  ddp: ["npm"],
  dedupe: ["npm"],
  "dist-tag": ["npm"],
  dlx: ["pnpm", "yarn"],
  download: [...PY_TOOLS],
  exec: ["npm"],
  fetch: ["cargo"],
  generate: ["cargo"],
  get: ["go"],
  i: [...JS_TOOLS],
  import: ["pnpm"],
  init: [...JS_TOOLS],
  inject: ["pipx"],
  install: [
    ...JS_TOOLS,
    "brew",
    "cargo",
    "composer",
    "deno",
    "gem",
    "go",
    ...PY_TOOLS,
    "pipx",
    "poetry",
    "rustup",
  ],
  "install-test": ["npm"],
  link: [...JS_TOOLS, "brew"],
  ln: ["npm"],
  lock: ["poetry", "uv"],
  r: ["npm"],
  reinstall: ["brew", "npm", "pipx"],
  remove: [...JS_TOOLS, "brew", "cargo", "composer", "poetry", "uv"],
  require: ["composer"],
  rm: ["brew", "bun", "cargo", "npm", "pnpm"],
  "self-update": ["composer"],
  selfupdate: ["composer"],
  sync: ["uv"],
  tap: ["brew"],
  un: ["npm"],
  uninstall: [...PY_TOOLS, "brew", "gem", "npm", "pipx", "rustup"],
  untap: ["brew"],
  up: ["npm", "pnpm", "yarn"],
  update: [...JS_TOOLS, "cargo", "composer", "gem", "poetry", "rustup"],
  upgrade: [...JS_TOOLS, "brew", "cargo", "deno", "pipx", "uv"],
};

const SEQUENCE_GROUPS: readonly [
  string,
  readonly string[],
  readonly string[],
][] = [
  [
    "brew",
    ["services"],
    ["start", "stop", "restart", "run", "kill", "cleanup"],
  ],
  ["composer", ["global"], ["remove", "require", "update"]],
  ["go", ["mod"], ["download", "tidy"]],
  ["poetry", ["self"], ["update"]],
  ["python", ["-m", "pip"], ["download", "install", "uninstall"]],
  ["python3", ["-m", "pip"], ["download", "install", "uninstall"]],
  ["swift", ["package"], ["install", "resolve", "update"]],
  ["uv", ["pip"], ["download", "install", "uninstall"]],
  ["uv", ["tool"], ["install", "uninstall", "upgrade"]],
  ["uv", ["self"], ["update"]],
  ["yarn", ["global"], ["add", "install", "remove", "upgrade"]],
  ["yarn", ["set"], ["version"]],
];

const MUTATIONS = new Map<string, readonly (readonly string[])[]>();
for (const [verb, tools] of Object.entries(VERBS)) {
  for (const tool of tools) {
    MUTATIONS.set(tool, [...(MUTATIONS.get(tool) ?? []), [verb]]);
  }
}
for (const tool of ALWAYS_MUTATES) {
  MUTATIONS.set(tool, [[]]);
}
for (const [tool, scope, actions] of SEQUENCE_GROUPS) {
  for (const action of actions) {
    MUTATIONS.set(tool, [...(MUTATIONS.get(tool) ?? []), [...scope, action]]);
  }
}

function mutates(name: string, args: string[]): boolean {
  const prefixes = MUTATIONS.get(baseName(name.toLowerCase()));
  if (prefixes === undefined) {
    return false;
  }
  return prefixes.some(
    (prefix) =>
      prefix.length <= args.length &&
      prefix.every((word, index) => word === args[index]?.toLowerCase()),
  );
}

export const REASON =
  "Dependency install/update blocked: do not install, update, or remove packages (pip/uv/pipx/poetry, npm/npx/yarn/pnpm/bun/bunx, cargo/rustup, composer, gem, go get/install, swift package, brew).";

export const noDepsPolicy: Policy = {
  check(cmd) {
    for (const unit of cmd.units) {
      if (mutates(unit.name, unit.args)) {
        return deny(REASON);
      }
    }
    return null;
  },
  name: "no-deps",
};

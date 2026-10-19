import { baseName } from "../core/ast.ts";
import { deny } from "../core/decision.ts";
import type { Policy } from "../core/policy.ts";

const MUTATIONS: Record<string, readonly (readonly string[])[]> = {
  brew: [
    ["install"],
    ["reinstall"],
    ["uninstall"],
    ["remove"],
    ["rm"],
    ["upgrade"],
    ["tap"],
    ["untap"],
    ["bundle"],
    ["autoremove"],
    ["services", "start"],
    ["services", "stop"],
    ["services", "restart"],
    ["services", "run"],
    ["services", "kill"],
    ["services", "cleanup"],
  ],
  bun: [
    ["add"],
    ["remove"],
    ["rm"],
    ["install"],
    ["i"],
    ["update"],
    ["upgrade"],
  ],
  bunx: [[]],
  cargo: [
    ["install"],
    ["add"],
    ["remove"],
    ["rm"],
    ["update"],
    ["upgrade"],
    ["fetch"],
    ["generate"],
  ],
  composer: [
    ["install"],
    ["update"],
    ["require"],
    ["remove"],
    ["self-update"],
    ["selfupdate"],
    ["global", "require"],
    ["global", "update"],
    ["global", "remove"],
  ],
  deno: [["add"], ["install"], ["cache"], ["upgrade"]],
  gem: [["install"], ["uninstall"], ["update"]],
  "go": [["install"], ["get"], ["mod", "tidy"], ["mod", "download"]],
  npm: [
    ["install"],
    ["i"],
    ["install-test"],
    ["ci"],
    ["reinstall"],
    ["uninstall"],
    ["un"],
    ["remove"],
    ["rm"],
    ["r"],
    ["update"],
    ["up"],
    ["upgrade"],
    ["link"],
    ["ln"],
    ["dedupe"],
    ["ddp"],
    ["dist-tag"],
    ["exec"],
    ["create"],
    ["init"],
  ],
  npx: [[]],
  pip: [["install"], ["uninstall"], ["download"]],
  pip3: [["install"], ["uninstall"], ["download"]],
  pipx: [["install"], ["upgrade"], ["uninstall"], ["inject"], ["reinstall"]],
  pnpm: [
    ["add"],
    ["remove"],
    ["rm"],
    ["install"],
    ["i"],
    ["update"],
    ["up"],
    ["upgrade"],
    ["dlx"],
    ["import"],
    ["link"],
  ],
  poetry: [
    ["add"],
    ["remove"],
    ["install"],
    ["update"],
    ["lock"],
    ["self", "update"],
  ],
  python: [
    ["-m", "pip", "install"],
    ["-m", "pip", "uninstall"],
    ["-m", "pip", "download"],
  ],
  python3: [
    ["-m", "pip", "install"],
    ["-m", "pip", "uninstall"],
    ["-m", "pip", "download"],
  ],
  rustup: [["install"], ["update"], ["uninstall"]],
  swift: [
    ["package", "install"],
    ["package", "update"],
    ["package", "resolve"],
  ],
  "uv": [
    ["add"],
    ["remove"],
    ["sync"],
    ["lock"],
    ["upgrade"],
    ["pip", "install"],
    ["pip", "uninstall"],
    ["pip", "download"],
    ["tool", "install"],
    ["tool", "uninstall"],
    ["tool", "upgrade"],
    ["self", "update"],
  ],
  uvx: [[]],
  yarn: [
    ["add"],
    ["remove"],
    ["install"],
    ["upgrade"],
    ["up"],
    ["dlx"],
    ["link"],
    ["set", "version"],
    ["global", "add"],
    ["global", "remove"],
    ["global", "install"],
    ["global", "upgrade"],
  ],
};

function mutates(name: string, args: string[]): boolean {
  const prefixes = MUTATIONS[baseName(name.toLowerCase())];
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

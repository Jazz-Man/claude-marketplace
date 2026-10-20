import type { CommandUnit } from "../core/ast.ts";
import { deny } from "../core/decision.ts";
import type { Policy } from "../core/policy.ts";

const UNCONDITIONAL = new Set([
  "add",
  "commit",
  "push",
  "pull",
  "fetch",
  "merge",
  "rebase",
  "reset",
  "revert",
  "cherry-pick",
  "am",
  "apply",
  "rm",
  "mv",
  "clean",
  "init",
  "clone",
  "gc",
  "prune",
  "update-ref",
  "update-index",
  "worktree",
  "bundle",
  "checkout",
  "switch",
  "restore",
  "bisect",
  "filter-branch",
  "read-tree",
  "checkout-index",
  "commit-tree",
  "fast-import",
  "pack-refs",
  "update-server-info",
]);

const MUTATING_FLAGS: Record<string, Set<string>> = {
  branch: new Set([
    "-d",
    "-D",
    "-m",
    "-M",
    "-c",
    "-C",
    "-f",
    "-u",
    "--delete",
    "--move",
    "--copy",
    "--force",
    "--set-upstream-to",
    "--edit-description",
  ]),
  tag: new Set([
    "-a",
    "-d",
    "-s",
    "-f",
    "-u",
    "-m",
    "--message",
    "-F",
    "--file",
    "--annotate",
    "--sign",
    "--delete",
    "--force",
  ]),
};

const MUTATING_SUBS: Record<string, Set<string>> = {
  notes: new Set(["add", "append", "remove", "edit", "copy", "prune"]),
  reflog: new Set(["expire", "delete"]),
  remote: new Set(["add", "remove", "rename", "set-url", "set-head", "prune"]),
  "sparse-checkout": new Set(["set", "add", "reapply", "enable", "disable"]),
  stash: new Set([
    "push",
    "pop",
    "apply",
    "drop",
    "branch",
    "clear",
    "save",
    "store",
    "create",
  ]),
};

const CONFIG_MUTATING_FLAGS = new Set([
  "-e",
  "--global",
  "--local",
  "--system",
  "--add",
  "--unset",
  "--unset-all",
  "--replace-all",
  "--file",
]);

const SYMBOLIC_REF_FLAGS = new Set(["-d", "--delete"]);
const REPLACE_FLAGS = new Set(["-d", "--delete", "--edit", "-g", "--graft"]);

const GLOBAL_VALUE_FLAGS = new Set([
  "-c",
  "-C",
  "--git-dir",
  "--work-tree",
  "--namespace",
  "--super-prefix",
]);
const GLOBAL_FLAG_ONLY = new Set([
  "--bare",
  "--icase-pathspecs",
  "--glob-pathspecs",
  "--literal-pathspecs",
  "--no-literal-pathspecs",
  "--noglob-pathspecs",
  "--no-optional-locks",
  "--no-pager",
  "--no-replace-objects",
  "--paginate",
]);

interface GitCall {
  rest: string[];
  sub: string;
}

function globalAdvance(arg: string): number | null {
  if (GLOBAL_VALUE_FLAGS.has(arg)) {
    return 2;
  }
  if (arg.includes("=") || GLOBAL_FLAG_ONLY.has(arg)) {
    return 1;
  }
  return null;
}

function gitCall(args: readonly string[]): GitCall | null {
  const [arg] = args;
  if (arg === undefined) {
    return null;
  }
  if (!arg.startsWith("-")) {
    return {
      rest: args.slice(1),
      sub: arg,
    };
  }
  const advance = globalAdvance(arg);
  if (advance === null) {
    return null;
  }
  return gitCall(args.slice(advance));
}

function gitUnitCall(unit: CommandUnit): GitCall | null {
  if (unit.name.toLowerCase() !== "git" || unit.args.length === 0) {
    return null;
  }
  return gitCall(unit.args);
}

function hasMutatingFlag(flags: Set<string>, args: readonly string[]): boolean {
  return args.some((arg) => {
    if (flags.has(arg)) {
      return true;
    }
    const equalsIndex = arg.indexOf("=");
    return equalsIndex !== -1 && flags.has(arg.slice(0, equalsIndex));
  });
}

function stashViolates(subs: Set<string>, args: readonly string[]): boolean {
  const [firstArg] = args;
  const flagsOnly = args.length === 0 || firstArg?.startsWith("-") === true;
  if (flagsOnly) {
    return true;
  }
  return subs.has(firstArg ?? "");
}

function configViolates(args: readonly string[]): boolean {
  if (args.some((arg) => CONFIG_MUTATING_FLAGS.has(arg))) {
    return true;
  }
  return args.filter((arg) => !arg.startsWith("-")).length >= 2;
}

function subFamilyMutating(sub: string, args: readonly string[]): boolean {
  const subs = MUTATING_SUBS[sub];
  if (subs !== undefined) {
    return listedSubMutating(sub, subs, args);
  }
  return singleSubMutating(sub, args);
}

function listedSubMutating(
  sub: string,
  subs: Set<string>,
  args: readonly string[],
): boolean {
  if (sub === "stash") {
    return stashViolates(subs, args);
  }
  const [firstArg] = args;
  return subs.has(firstArg ?? "");
}

function singleSubMutating(sub: string, args: readonly string[]): boolean {
  if (sub === "config") {
    return configViolates(args);
  }
  if (sub === "symbolic-ref") {
    return args.some((arg) => SYMBOLIC_REF_FLAGS.has(arg));
  }
  if (sub === "replace") {
    return args.some((arg) => REPLACE_FLAGS.has(arg));
  }
  return false;
}

function mutating(sub: string, args: readonly string[]): boolean {
  if (UNCONDITIONAL.has(sub)) {
    return true;
  }
  const [firstArg] = args;
  const flags = MUTATING_FLAGS[sub];
  if (flags !== undefined) {
    return hasMutatingFlag(flags, args) || firstArg?.startsWith("-") === false;
  }
  return subFamilyMutating(sub, args);
}

export const GIT_READONLY_REASON =
  "Git write operation blocked (read-only policy): only read-only git is allowed (status, diff, log, show, branch -l, tag -l, stash list, ...).";

export const GIT_HOOK_REASON =
  "Git hook access blocked (read-only policy): the `git hook` subcommand reads and runs .git/hooks entries — name-based execution the filesystem policy cannot see.";

export const gitReadonlyPolicy: Policy = {
  check(cmd) {
    for (const unit of cmd.units) {
      const call = gitUnitCall(unit);
      if (call !== null && call.sub.toLowerCase() === "hook") {
        return deny(GIT_HOOK_REASON);
      }
      if (call !== null && mutating(call.sub.toLowerCase(), call.rest)) {
        return deny(GIT_READONLY_REASON);
      }
    }
    return null;
  },
  name: "git-readonly",
};

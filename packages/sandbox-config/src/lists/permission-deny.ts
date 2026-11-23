// import { denyRead } from "./deny-read.ts";
// import { denyWrite } from "./deny-write.ts";
import { pathsToRules, unique } from "../utils.ts";

const gitWriteCommands = [
  "add",
  "commit",
  "push",
  "merge",
  "rebase",
  "reset",
  "revert",
  "checkout",
  "switch",
  "stash",
  "cherry-pick",
  "restore",
  "clean",
  "rm",
  "mv",
  "tag v",
  "branch -D ",
  "submodule update",
  "hook",
  "init",
  "clone",
].map((cmd) => `git ${cmd}*`);

const ghCommands = ["login", "logout", "refresh", "switch", "token"].map(
  (cmd) => `gh auth ${cmd}*`,
);

const disableCommands = [
  "sudo*",
  "omz*",
  "brew*",
  "nix*",
  "bunx*",
  "npx*",
  "pnpx*",
  "uvx*",
];

export const permissionDeny = unique([
  // ...pathsToRules(denyRead, "Read"),
  // ...pathsToRules(denyWrite, "Edit"),
  ...pathsToRules(["**/.git", "**/.git/**"], "Edit"),
  ...pathsToRules(gitWriteCommands, "Bash"),
  ...pathsToRules(disableCommands, "Bash"),
  // ...pathsToRules(ghCommands, "Bash"),
]);

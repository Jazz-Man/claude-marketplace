/**
 * permissions.deny — the only list the built-in Read, Edit and Bash tools
 * answer to; they run outside the sandbox. Paths denied to those tools are
 * listed here, not in the sandbox lists. See config.ts for why lists never
 * share entries.
 */
// import { denyRead } from "./deny-read.ts";
// import { denyWrite } from "./deny-write.ts";
import { debug } from "../debug.ts";
import { pathsToRules, unique } from "../utils.ts";

// Git commands that rewrite history or repository state.
const gitWriteCommands = [
  "git add*",
  "git commit*",
  "git push*",
  "git merge*",
  "git rebase*",
  "git reset*",
  "git revert*",
  "git checkout*",
  "git switch*",
  "git stash*",
  "git cherry-pick*",
  "git restore*",
  "git clean*",
  "git rm*",
  "git mv*",
  "git tag v*",
  "git branch -D *",
  "git submodule update*",
  "git hook*",
  "git init*",
  "git clone*",
];

const gitListTest = ["add", "commit"].map((cmd) => `git ${cmd}*`);

debug(gitListTest);

// Privileged or package-running commands — system changes and installs
// belong to the owner.
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
]);

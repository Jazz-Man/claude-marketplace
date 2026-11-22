/**
 * Write-only path protections: git history, the global git config, repo tool
 * config files, and system trees. All stay readable; where each group lands
 * (Edit deny list, sandbox denyWrite, or both) is wired in config.ts.
 */

import { bothForms } from "../patterns.ts";

export const gitHistoryWriteOnly = ["/**/.git"];

export const gitConfigWriteOnly = ["~/.gitconfig*"];

export const configWriteOnly = [
  ".gitmodules",
  ".mcp.json",
  ".lsp.json",
].flatMap(bothForms);

// Carved out of the sandbox's default write-deny (everything outside the
// working dir and TMPDIR): Darwin's per-user temp tree, where xcrun keeps
// its cache DB and build tools spill intermediates. Both spellings because
// /var is a symlink to /private/var and the matcher's symlink resolution
// is unverified.
export const systemWriteAllow = [
  "~/.cache",
  "/var/folders",
  "/private/var/folders",
];

export const systemWriteOnly = [
  "/Applications",
  "/Library",
  "/System",
  "/Volumes",
  "/bin",
  "/etc",
  "/opt",
  "/private/etc",
  "/private/var/agentx*",
  "/private/var/at*",
  "/private/var/audit*",
  "/private/var/db*",
  "/private/var/log*",
  "/private/var/mail*",
  "/private/var/root*",
  "/private/var/run*",
  "/private/var/spool*",
  "/private/var/vm*",
  "/sbin",
  "/usr",
];

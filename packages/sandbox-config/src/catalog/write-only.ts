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

export const systemWriteOnly = [
  "/Applications",
  "/Library",
  "/System",
  "/Volumes",
  "/bin",
  "/etc",
  "/opt",
  "/private/etc",
  "/private/var",
  "/sbin",
  "/usr",
  "/var",
];

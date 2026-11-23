import { unique } from "../utils.ts";

const grepaiServers = [
  "plugin_grepai_grepai",
  "grepai-api",
  "grepai-source-mcp",
];

export const permissionAllow = unique(
  grepaiServers.map((server) => `mcp__${server}__*`),
);

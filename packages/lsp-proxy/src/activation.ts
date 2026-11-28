import { existsSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import type { ProxyConfig, ServerConfig } from "./config.ts";
import { isNonEmptyString, isRecord } from "./guards/index.ts";

function rootLocator(initParams: Record<string, unknown>): unknown {
  const [first] = Array.isArray(initParams.workspaceFolders)
    ? initParams.workspaceFolders
    : [];
  const folderUri = isRecord(first) ? first.uri : undefined;
  return folderUri ?? initParams.rootUri ?? initParams.rootPath;
}

function projectRootOf(initParams: Record<string, unknown>): string {
  const locator = rootLocator(initParams);
  if (!isNonEmptyString(locator)) {
    return process.cwd();
  }
  try {
    return fileURLToPath(locator);
  } catch {
    return locator;
  }
}

function isConfigured(server: ServerConfig, root: string): boolean {
  const { configFiles } = server;
  if (configFiles === undefined) {
    return true;
  }
  return configFiles.some((file) => existsSync(join(root, file)));
}

export function activeServers(
  config: ProxyConfig,
  initParams: Record<string, unknown>,
  log: (line: string) => void,
): ServerConfig[] {
  const root = projectRootOf(initParams);
  return config.servers.filter((server) => {
    if (isConfigured(server, root)) {
      return true;
    }
    log(
      `server ${server.name}: not started, none of [${(server.configFiles ?? []).join(", ")}] in ${root}`,
    );
    return false;
  });
}

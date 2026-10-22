import { parse } from "node:path";

import type { ProxyConfig, ServerConfig } from "./config.ts";
import { policyFor } from "./methods/index.ts";
import type { ServerCapabilities } from "./types/index.ts";

export type { ServerCapabilities } from "./types/index.ts";

export function extensionOf(uri: string): string | undefined {
  try {
    const { pathname } = new URL(uri);
    if (pathname === "") {
      return undefined;
    }
    const { ext } = parse(pathname);
    if (ext === "") {
      return undefined;
    }
    return ext.toLowerCase();
  } catch {
    return undefined;
  }
}

export function serversForDocument(
  config: ProxyConfig,
  uri: string,
): ServerConfig[] {
  const extension = extensionOf(uri);
  if (extension === undefined) {
    return [];
  }
  return config.servers.filter((server) =>
    Object.hasOwn(server.extensionToLanguage, extension),
  );
}

export function serversForRequest(
  config: ProxyConfig,
  capabilities: Map<string, ServerCapabilities>,
  uri: string,
  method: string,
): ServerConfig[] {
  const owners = serversForDocument(config, uri);
  const capability = policyFor(method)?.capability;
  if (capability === undefined || capability === "") {
    return owners;
  }
  return owners.filter((server) => {
    const caps = capabilities.get(server.name);
    return caps !== undefined && Boolean(caps[capability]);
  });
}

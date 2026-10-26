import { ConfigError, isNonEmptyString, isRecord } from "../guards/index.ts";
import { ServerConfig } from "./ServerConfig.ts";
import { arrayField, collectServerFields, recordField } from "./validate.ts";

function emptyServersError(rawServers: unknown[]): ConfigError | undefined {
  if (rawServers.length > 0) {
    return undefined;
  }
  return new ConfigError(
    "config root.servers",
    "an array that must not be empty",
    rawServers,
  );
}

function duplicateNameError(rawServers: unknown[]): ConfigError | undefined {
  const names = new Set<string>();
  for (const entry of rawServers) {
    if (isRecord(entry) && isNonEmptyString(entry.name)) {
      if (names.has(entry.name)) {
        return new ConfigError(
          "servers",
          `a set of unique names (duplicate "${entry.name}")`,
          entry.name,
        );
      }
      names.add(entry.name);
    }
  }
  return undefined;
}

function extensionConflictError(
  servers: ServerConfig[],
): ConfigError | undefined {
  const seen = new Map<string, string>();
  for (const server of servers) {
    for (const [extension, language] of Object.entries(
      server.extensionToLanguage,
    )) {
      const previous = seen.get(extension);
      if (previous !== undefined && previous !== language) {
        return new ConfigError(
          `extension ${extension}`,
          `a single language across servers (conflict: "${previous}" and "${language}")`,
          language,
        );
      }
      seen.set(extension, language);
    }
  }
  return undefined;
}

function rawServerList(
  raw: unknown,
  errors: ConfigError[],
): unknown[] | undefined {
  const record = recordField(raw, "config root", errors);
  if (record === undefined) {
    return undefined;
  }
  const rawServers = arrayField(record.servers, "config root.servers", errors);
  if (rawServers === undefined) {
    return undefined;
  }
  const empty = emptyServersError(rawServers);
  if (empty !== undefined) {
    errors.push(empty);
    return undefined;
  }
  return rawServers;
}

function collectServers(
  raw: unknown,
  errors: ConfigError[],
): ServerConfig[] | undefined {
  const rawServers = rawServerList(raw, errors);
  if (rawServers === undefined) {
    return undefined;
  }
  const duplicate = duplicateNameError(rawServers);
  if (duplicate !== undefined) {
    errors.push(duplicate);
  }
  const servers: ServerConfig[] = [];
  for (const [index, entry] of rawServers.entries()) {
    const fields = collectServerFields(entry, `servers[${index}]`, errors);
    if (fields !== undefined) {
      servers.push(new ServerConfig(entry, `servers[${index}]`));
    }
  }
  const conflict = extensionConflictError(servers);
  if (conflict !== undefined) {
    errors.push(conflict);
  }
  if (errors.length > 0) {
    return undefined;
  }
  return servers;
}

export class ProxyConfig {
  readonly servers: ServerConfig[];

  constructor(raw: unknown) {
    const collected: ConfigError[] = [];
    const servers = collectServers(raw, collected);
    if (servers === undefined) {
      throw collected[0];
    }
    this.servers = servers;
  }

  static parse(raw: unknown): { config?: ProxyConfig; errors: string[] } {
    const collected: ConfigError[] = [];
    const servers = collectServers(raw, collected);
    if (servers === undefined) {
      return { errors: collected.map((error) => error.message) };
    }
    return { config: new ProxyConfig(raw), errors: [] };
  }
}

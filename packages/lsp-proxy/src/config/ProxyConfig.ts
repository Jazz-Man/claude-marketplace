import { ConfigError, isNonEmptyString, isRecord } from "../guards/index.ts";
import { ServerConfig } from "./ServerConfig.ts";
import {
  arrayField,
  conflictingExtension,
  failFast,
  recordField,
  withMessages,
} from "./validate.ts";

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
  const conflict = conflictingExtension(servers);
  if (conflict === undefined) {
    return undefined;
  }
  return new ConfigError(
    `extension ${conflict.extension}`,
    `a single language across servers (conflict: "${conflict.previous}" and "${conflict.language}")`,
    conflict.language,
  );
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
    const server = ServerConfig.parse(entry, `servers[${index}]`, errors);
    if (server !== undefined) {
      servers.push(server);
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
    this.servers = failFast((errors) => collectServers(raw, errors));
  }

  static parse(raw: unknown): { config?: ProxyConfig; errors: string[] } {
    const errors: string[] = [];
    const servers = withMessages(
      (collected) => collectServers(raw, collected),
      errors,
    );
    if (servers === undefined) {
      return { errors };
    }
    return { config: new ProxyConfig(raw), errors: [] };
  }
}

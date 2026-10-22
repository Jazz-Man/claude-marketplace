import {
  asArray,
  asRecord,
  ConfigError,
  isNonEmptyString,
  isRecord,
} from "../guards/index.ts";
import { pushConfigError, ServerConfig } from "./ServerConfig.ts";

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

function rootRecord(
  raw: unknown,
  errors: string[],
): Record<string, unknown> | undefined {
  try {
    return asRecord(raw, "config root");
  } catch (error) {
    pushConfigError(error, errors);
    return undefined;
  }
}

function rootServers(
  record: Record<string, unknown>,
  errors: string[],
): unknown[] | undefined {
  let rawServers: unknown[];
  try {
    rawServers = asArray(record.servers, "config root.servers");
  } catch (error) {
    pushConfigError(error, errors);
    return undefined;
  }
  const empty = emptyServersError(rawServers);
  if (empty !== undefined) {
    errors.push(empty.message);
    return undefined;
  }
  return rawServers;
}

export class ProxyConfig {
  readonly servers: ServerConfig[];

  constructor(raw: unknown) {
    const record = asRecord(raw, "config root");
    const rawServers = asArray(record.servers, "config root.servers");
    const empty = emptyServersError(rawServers);
    if (empty !== undefined) {
      throw empty;
    }
    const duplicate = duplicateNameError(rawServers);
    if (duplicate !== undefined) {
      throw duplicate;
    }
    this.servers = rawServers.map(
      (entry, index) => new ServerConfig(entry, `servers[${index}]`),
    );
    const conflict = extensionConflictError(this.servers);
    if (conflict !== undefined) {
      throw conflict;
    }
  }

  static parse(raw: unknown): { config?: ProxyConfig; errors: string[] } {
    const errors: string[] = [];
    const record = rootRecord(raw, errors);
    if (record === undefined) {
      return { errors };
    }
    const rawServers = rootServers(record, errors);
    if (rawServers === undefined) {
      return { errors };
    }
    const duplicate = duplicateNameError(rawServers);
    if (duplicate !== undefined) {
      errors.push(duplicate.message);
    }
    const servers: ServerConfig[] = [];
    for (const [index, entry] of rawServers.entries()) {
      const server = ServerConfig.collectViolations(
        entry,
        `servers[${index}]`,
        errors,
      );
      if (server !== undefined) {
        servers.push(server);
      }
    }
    const conflict = extensionConflictError(servers);
    if (conflict !== undefined) {
      errors.push(conflict.message);
    }
    if (errors.length > 0) {
      return { errors };
    }
    return { config: new ProxyConfig(raw), errors: [] };
  }
}

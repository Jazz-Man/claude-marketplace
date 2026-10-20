export type ExtensionMap = Record<string, string>;

export interface ServerConfig {
  args?: string[];
  command: string;
  env?: Record<string, string>;
  extensionToLanguage: ExtensionMap;
  initializationOptions?: unknown;
  name: string;
  settings?: unknown;
}

export interface ProxyConfig {
  servers: ServerConfig[];
}

export type ParseResult =
  | { config: ProxyConfig; errors?: undefined; ok: true }
  | { config?: undefined; errors: string[]; ok: false };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateExtensionMap(
  extensionToLanguage: Record<string, unknown>,
  index: number,
  errors: string[],
): boolean {
  let valid = true;
  for (const [extension, language] of Object.entries(extensionToLanguage)) {
    if (!extension.startsWith(".")) {
      errors.push(
        `servers[${index}] extension "${extension}" must start with '.'`,
      );
      valid = false;
    }
    if (typeof language !== "string" || language === "") {
      errors.push(
        `servers[${index}] extension "${extension}" needs a non-empty language`,
      );
      valid = false;
    }
  }
  return valid;
}

function checkServerFields(
  server: Record<string, unknown>,
  index: number,
  errors: string[],
): boolean {
  const { args, command, env, extensionToLanguage, name } = server;
  let valid = true;
  if (typeof name !== "string" || name === "") {
    errors.push(`servers[${index}].name must be a non-empty string`);
    valid = false;
  }
  if (typeof command !== "string" || command === "") {
    errors.push(`servers[${index}].command must be a non-empty string`);
    valid = false;
  }
  if (
    !isRecord(extensionToLanguage) ||
    Object.keys(extensionToLanguage).length === 0
  ) {
    errors.push(
      `servers[${index}].extensionToLanguage must be a non-empty object`,
    );
    valid = false;
  } else if (!validateExtensionMap(extensionToLanguage, index, errors)) {
    valid = false;
  }
  if (args !== undefined && !Array.isArray(args)) {
    errors.push(`servers[${index}].args must be an array`);
    valid = false;
  }
  if (env !== undefined && !isRecord(env)) {
    errors.push(`servers[${index}].env must be an object`);
    valid = false;
  }
  return valid;
}

function toServerConfig(server: Record<string, unknown>): ServerConfig {
  const configured = server as {
    args?: string[];
    command: string;
    env?: Record<string, string>;
    extensionToLanguage: ExtensionMap;
    initializationOptions?: unknown;
    name: string;
    settings?: unknown;
  };
  return {
    args: configured.args,
    command: configured.command,
    env: configured.env,
    extensionToLanguage: configured.extensionToLanguage,
    initializationOptions: configured.initializationOptions,
    name: configured.name,
    settings: configured.settings,
  };
}

function validateServer(
  server: unknown,
  index: number,
  errors: string[],
): ServerConfig | undefined {
  if (!isRecord(server)) {
    errors.push(`servers[${index}] must be an object`);
    return undefined;
  }
  if (checkServerFields(server, index, errors)) {
    return toServerConfig(server);
  }
  return undefined;
}

function checkLanguageConflicts(
  servers: ServerConfig[],
  errors: string[],
): void {
  const seen = new Map<string, string>();
  for (const server of servers) {
    for (const [extension, language] of Object.entries(
      server.extensionToLanguage,
    )) {
      const previous = seen.get(extension);
      if (previous === undefined) {
        seen.set(extension, language);
      } else if (previous !== language) {
        errors.push(
          `extension ${extension} is mapped to "${previous}" and "${language}" by different servers`,
        );
      }
    }
  }
}

function checkDuplicateNames(servers: unknown[], errors: string[]): void {
  const names = new Set<string>();
  for (const entry of servers) {
    if (
      isRecord(entry) &&
      typeof entry.name === "string" &&
      entry.name !== ""
    ) {
      if (names.has(entry.name)) {
        errors.push(`duplicate server name "${entry.name}"`);
      } else {
        names.add(entry.name);
      }
    }
  }
}

export function parseConfig(raw: unknown): ParseResult {
  const errors: string[] = [];
  if (
    !(isRecord(raw) && Array.isArray(raw.servers)) ||
    raw.servers.length === 0
  ) {
    return {
      errors: ["config must be an object with a non-empty servers array"],
      ok: false,
    };
  }
  checkDuplicateNames(raw.servers, errors);
  const servers: ServerConfig[] = [];
  for (const [index, entry] of raw.servers.entries()) {
    const server = validateServer(entry, index, errors);
    if (server !== undefined) {
      servers.push(server);
    }
  }
  checkLanguageConflicts(servers, errors);
  if (errors.length > 0) {
    return { errors, ok: false };
  }
  return { config: { servers }, ok: true };
}

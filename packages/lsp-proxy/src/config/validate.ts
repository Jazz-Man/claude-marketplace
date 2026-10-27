import {
  asArray,
  asRecord,
  ConfigError,
  isNonEmptyString,
  isRecord,
  isStringArray,
  isStringRecord,
} from "../guards/index.ts";

export interface ExtensionConflict {
  extension: string;
  language: string;
  previous: string;
}

export interface ServerFields {
  args: string[] | undefined;
  command: string;
  env: Record<string, string> | undefined;
  extensionToLanguage: Record<string, string>;
  initializationOptions: unknown;
  name: string;
  settings: unknown;
}

function pushConfigError(error: unknown, errors: ConfigError[]): void {
  if (error instanceof ConfigError) {
    errors.push(error);
    return;
  }
  throw error;
}

function parseWith<T>(
  parse: (value: unknown, context: string) => T,
  raw: unknown,
  context: string,
  errors: ConfigError[],
): T | undefined {
  try {
    return parse(raw, context);
  } catch (error) {
    pushConfigError(error, errors);
    return undefined;
  }
}

export function withMessages<T>(
  run: (errors: ConfigError[]) => T | undefined,
  messages: string[],
): T | undefined {
  const collected: ConfigError[] = [];
  const value = run(collected);
  messages.push(...collected.map((error) => error.message));
  return value;
}

export function recordField(
  raw: unknown,
  context: string,
  errors: ConfigError[],
): Record<string, unknown> | undefined {
  return parseWith(asRecord, raw, context, errors);
}

export function arrayField(
  raw: unknown,
  context: string,
  errors: ConfigError[],
): unknown[] | undefined {
  return parseWith(asArray, raw, context, errors);
}

function nonEmptyField(
  field: string,
  raw: unknown,
  context: string,
  errors: ConfigError[],
): string {
  if (isNonEmptyString(raw)) {
    return raw;
  }
  errors.push(
    new ConfigError(`${context}.${field}`, "a non-empty string", raw),
  );
  return "";
}

function extensionMapField(
  raw: unknown,
  context: string,
  errors: ConfigError[],
): Record<string, string> {
  const map: Record<string, string> = {};
  if (!isRecord(raw) || Object.keys(raw).length === 0) {
    errors.push(
      new ConfigError(
        `${context}.extensionToLanguage`,
        "a non-empty object",
        raw,
      ),
    );
    return map;
  }
  for (const [extension, language] of Object.entries(raw)) {
    if (!extension.startsWith(".")) {
      errors.push(
        new ConfigError(
          `${context}.extensionToLanguage key "${extension}"`,
          "a key that must start with '.'",
          extension,
        ),
      );
      return map;
    }
    if (!isNonEmptyString(language)) {
      errors.push(
        new ConfigError(
          `${context}.extensionToLanguage key "${extension}"`,
          "a non-empty language value",
          language,
        ),
      );
      return map;
    }
    map[extension] = language;
  }
  return map;
}

function argsField(
  raw: unknown,
  context: string,
  errors: ConfigError[],
): string[] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (isStringArray(raw)) {
    return raw;
  }
  errors.push(new ConfigError(`${context}.args`, "a string array", raw));
  return undefined;
}

function envField(
  raw: unknown,
  context: string,
  errors: ConfigError[],
): Record<string, string> | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (isStringRecord(raw)) {
    return raw;
  }
  errors.push(new ConfigError(`${context}.env`, "a string record", raw));
  return undefined;
}

export function conflictingExtension(
  servers: { extensionToLanguage: Record<string, string> }[],
): ExtensionConflict | undefined {
  const seen = new Map<string, string>();
  for (const server of servers) {
    for (const [extension, language] of Object.entries(
      server.extensionToLanguage,
    )) {
      const previous = seen.get(extension);
      if (previous !== undefined && previous !== language) {
        return { extension, language, previous };
      }
      seen.set(extension, language);
    }
  }
  return undefined;
}

export function collectServerFields(
  raw: unknown,
  context: string,
  errors: ConfigError[],
): ServerFields | undefined {
  const record = recordField(raw, context, errors);
  if (record === undefined) {
    return undefined;
  }
  const before = errors.length;
  const name = nonEmptyField("name", record.name, context, errors);
  const command = nonEmptyField("command", record.command, context, errors);
  const extensionToLanguage = extensionMapField(
    record.extensionToLanguage,
    context,
    errors,
  );
  const args = argsField(record.args, context, errors);
  const env = envField(record.env, context, errors);
  if (errors.length > before) {
    return undefined;
  }
  return {
    args,
    command,
    env,
    extensionToLanguage,
    initializationOptions: record.initializationOptions,
    name,
    settings: record.settings,
  };
}

export function collectServerMessages(
  raw: unknown,
  context: string,
  errors: string[],
): ServerFields | undefined {
  return withMessages(
    (collected) => collectServerFields(raw, context, collected),
    errors,
  );
}

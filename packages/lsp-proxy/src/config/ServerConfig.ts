import {
  asRecord,
  ConfigError,
  isNonEmptyString,
  isRecord,
  isStringArray,
  isStringRecord,
} from "../guards/index.ts";

export function pushConfigError(error: unknown, errors: string[]): void {
  if (error instanceof ConfigError) {
    errors.push(error.message);
    return;
  }
  throw error;
}

function recordViolation(validate: () => unknown, errors: string[]): void {
  try {
    validate();
  } catch (error) {
    pushConfigError(error, errors);
  }
}

export class ServerConfig {
  private static validateNonEmpty(
    field: string,
    raw: unknown,
    context: string,
  ): string {
    if (!isNonEmptyString(raw)) {
      throw new ConfigError(`${context}.${field}`, "a non-empty string", raw);
    }
    return raw;
  }

  private static validateExtensionMap(
    raw: unknown,
    context: string,
  ): Record<string, string> {
    if (!isRecord(raw) || Object.keys(raw).length === 0) {
      throw new ConfigError(
        `${context}.extensionToLanguage`,
        "a non-empty object",
        raw,
      );
    }
    const result: Record<string, string> = {};
    for (const [extension, language] of Object.entries(raw)) {
      if (!extension.startsWith(".")) {
        throw new ConfigError(
          `${context}.extensionToLanguage key "${extension}"`,
          "a key that must start with '.'",
          extension,
        );
      }
      if (!isNonEmptyString(language)) {
        throw new ConfigError(
          `${context}.extensionToLanguage key "${extension}"`,
          "a non-empty language value",
          language,
        );
      }
      result[extension] = language;
    }
    return result;
  }

  private static validateArgs(
    raw: unknown,
    context: string,
  ): string[] | undefined {
    if (raw === undefined) {
      return undefined;
    }
    if (!isStringArray(raw)) {
      throw new ConfigError(`${context}.args`, "a string array", raw);
    }
    return raw;
  }

  private static validateEnv(
    raw: unknown,
    context: string,
  ): Record<string, string> | undefined {
    if (raw === undefined) {
      return undefined;
    }
    if (!isStringRecord(raw)) {
      throw new ConfigError(`${context}.env`, "a string record", raw);
    }
    return raw;
  }

  static collectViolations(
    raw: unknown,
    context: string,
    errors: string[],
  ): ServerConfig | undefined {
    let record: Record<string, unknown>;
    try {
      record = asRecord(raw, context);
    } catch (error) {
      pushConfigError(error, errors);
      return undefined;
    }
    const violationsBefore = errors.length;
    recordViolation(
      () => ServerConfig.validateNonEmpty("name", record.name, context),
      errors,
    );
    recordViolation(
      () => ServerConfig.validateNonEmpty("command", record.command, context),
      errors,
    );
    recordViolation(
      () =>
        ServerConfig.validateExtensionMap(record.extensionToLanguage, context),
      errors,
    );
    recordViolation(
      () => ServerConfig.validateArgs(record.args, context),
      errors,
    );
    recordViolation(
      () => ServerConfig.validateEnv(record.env, context),
      errors,
    );
    if (errors.length > violationsBefore) {
      return undefined;
    }
    return new ServerConfig(raw, context);
  }

  private readonly _name: string;
  private readonly _command: string;
  private readonly _extensionToLanguage: Record<string, string>;
  private readonly _args: string[] | undefined;
  private readonly _env: Record<string, string> | undefined;
  private readonly _initializationOptions: unknown;
  private readonly _settings: unknown;

  constructor(raw: unknown, context: string) {
    const record = asRecord(raw, context);
    this._name = ServerConfig.validateNonEmpty("name", record.name, context);
    this._command = ServerConfig.validateNonEmpty(
      "command",
      record.command,
      context,
    );
    this._extensionToLanguage = ServerConfig.validateExtensionMap(
      record.extensionToLanguage,
      context,
    );
    this._args = ServerConfig.validateArgs(record.args, context);
    this._env = ServerConfig.validateEnv(record.env, context);
    this._initializationOptions = record.initializationOptions;
    this._settings = record.settings;
  }

  get name(): string {
    return this._name;
  }

  get command(): string {
    return this._command;
  }

  get extensionToLanguage(): Record<string, string> {
    return this._extensionToLanguage;
  }

  get args(): string[] | undefined {
    return this._args;
  }

  get env(): Record<string, string> | undefined {
    return this._env;
  }

  get initializationOptions(): unknown {
    return this._initializationOptions;
  }

  get settings(): unknown {
    return this._settings;
  }
}

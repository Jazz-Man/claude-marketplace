import type { ConfigError } from "../guards/index.ts";
import { collectServerFields, collectServerMessages } from "./validate.ts";

export class ServerConfig {
  static collectViolations(
    raw: unknown,
    context: string,
    errors: string[],
  ): ServerConfig | undefined {
    const fields = collectServerMessages(raw, context, errors);
    return fields === undefined ? undefined : new ServerConfig(raw, context);
  }

  private readonly _name: string;
  private readonly _command: string;
  private readonly _extensionToLanguage: Record<string, string>;
  private readonly _args: string[] | undefined;
  private readonly _env: Record<string, string> | undefined;
  private readonly _initializationOptions: unknown;
  private readonly _settings: unknown;

  constructor(raw: unknown, context: string) {
    const collected: ConfigError[] = [];
    const fields = collectServerFields(raw, context, collected);
    if (fields === undefined) {
      throw collected[0];
    }
    this._name = fields.name;
    this._command = fields.command;
    this._extensionToLanguage = fields.extensionToLanguage;
    this._args = fields.args;
    this._env = fields.env;
    this._initializationOptions = fields.initializationOptions;
    this._settings = fields.settings;
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

import { ProxyConfig as ProxyConfigClass } from "./config/ProxyConfig.ts";

export interface ServerConfig {
  args?: string[];
  command: string;
  env?: Record<string, string>;
  extensionToLanguage: Record<string, string>;
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

export function parseConfig(raw: unknown): ParseResult {
  const { config, errors } = ProxyConfigClass.parse(raw);
  if (config !== undefined) {
    return { config, ok: true };
  }
  return { errors, ok: false };
}

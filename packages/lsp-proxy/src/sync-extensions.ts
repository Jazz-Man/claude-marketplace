import process from "node:process";
import { parseArgs } from "node:util";

import { type ProxyConfig, parseConfig } from "./config.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function extensionUnion(config: ProxyConfig): Record<string, string> {
  const union: Record<string, string> = {};
  for (const server of config.servers) {
    for (const [extension, language] of Object.entries(
      server.extensionToLanguage,
    )) {
      const previous = union[extension];
      if (previous !== undefined && previous !== language) {
        throw new Error(
          `extension ${extension} maps to both "${previous}" and "${language}"`,
        );
      }
      union[extension] = language;
    }
  }
  return union;
}

export function mergeIntoLspJson(
  text: string,
  union: Record<string, string>,
): string {
  const parsed: unknown = JSON.parse(text);
  if (!(isRecord(parsed) && isRecord(parsed["lsp-proxy"]))) {
    throw new Error("target .lsp.json has no lsp-proxy entry");
  }
  const entry = parsed["lsp-proxy"];
  const updated = {
    ...parsed,
    "lsp-proxy": { ...entry, extensionToLanguage: union },
  };
  return `${JSON.stringify(updated, null, 2)}\n`;
}

const isDirectRun = process.argv[1]?.endsWith("sync-extensions.ts");
if (isDirectRun) {
  const { positionals } = parseArgs({
    allowPositionals: true,
    args: process.argv.slice(2),
  });
  const defaultConfig = new URL("../lsp-proxy.config.json", import.meta.url);
  const defaultTarget = new URL(
    "../../../plugins/lsp-proxy/.lsp.json",
    import.meta.url,
  );
  const configPath = positionals[0] ?? defaultConfig.pathname;
  const targetPath = positionals[1] ?? defaultTarget.pathname;
  try {
    const parsedConfig = parseConfig(await Bun.file(configPath).json());
    if (!parsedConfig.ok) {
      console.error(parsedConfig.errors.join("\n"));
      process.exit(1);
    }
    const union = extensionUnion(parsedConfig.config);
    const previous = await Bun.file(targetPath).text();
    await Bun.write(targetPath, mergeIntoLspJson(previous, union));
  } catch (error) {
    console.error(String(error));
    process.exit(1);
  }
}

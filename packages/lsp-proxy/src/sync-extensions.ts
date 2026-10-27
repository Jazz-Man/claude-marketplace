import process from "node:process";
import { parseArgs } from "node:util";
import { conflictingExtension } from "./config/validate.ts";
import { type ProxyConfig, parseConfig } from "./config.ts";
import { isRecord, safeJsonParse } from "./guards/index.ts";

export function extensionUnion(config: ProxyConfig): Record<string, string> {
  const conflict = conflictingExtension(config.servers);
  if (conflict !== undefined) {
    throw new Error(
      `extension ${conflict.extension} maps to both "${conflict.previous}" and "${conflict.language}"`,
    );
  }
  const union: Record<string, string> = {};
  for (const server of config.servers) {
    Object.assign(union, server.extensionToLanguage);
  }
  return union;
}

export function mergeIntoLspJson(
  text: string,
  union: Record<string, string>,
): string {
  const parsed = safeJsonParse(text);
  if (parsed === undefined) {
    throw new Error("target .lsp.json is not valid JSON");
  }
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

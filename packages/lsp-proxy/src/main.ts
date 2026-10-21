import { join } from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";

import { parseConfig } from "./config.ts";
import { closeLog, initFileLog, log } from "./logger.ts";
import { LspProxy } from "./proxy.ts";

(async () => {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  let configDefault: string | undefined;
  if (pluginRoot === undefined) {
    console.error(
      "lsp-proxy: warning - CLAUDE_PLUGIN_ROOT not set, --config is now required",
    );
  } else {
    configDefault = join(pluginRoot, "lsp-proxy.config.json");
  }

  const { values } = parseArgs({
    allowPositionals: false,
    args: process.argv.slice(2),
    options: {
      config: {
        default: configDefault,
        type: "string",
      },
    },
    strict: true,
  });
  const configArgument = values.config;
  if (configArgument === undefined) {
    console.error(
      "lsp-proxy: --config <path> is required (or set CLAUDE_PLUGIN_ROOT)",
    );
    process.exit(1);
  }
  let configPath = configArgument;
  if (!configPath.startsWith("/") && pluginRoot !== undefined) {
    configPath = join(pluginRoot, configArgument);
  }
  const logPath = await initFileLog();
  if (logPath !== undefined) {
    log(`file logging enabled: ${logPath}`);
  }
  const raw: unknown = await Bun.file(configPath).json();
  const parsed = parseConfig(raw);
  if (!parsed.ok) {
    log(`invalid config at ${configPath}:\n${parsed.errors.join("\n")}`);
    closeLog();
    process.exit(1);
  }
  log(`starting lsp-proxy 0.1.0 config=${configPath}`);
  for (const server of parsed.config.servers) {
    const args = (server.args ?? []).join(" ");
    log(`server ${server.name}: ${server.command} ${args}`);
  }
  const proxy = new LspProxy(
    parsed.config,
    { readChunks: () => Bun.stdin.stream(), stdout: Bun.stdout.writer() },
    (line) => log(line),
  );
  process.on("SIGTERM", () => {
    proxy.cascadeShutdown("SIGTERM");
  });
  await proxy.run();
})().catch((error: unknown) => {
  log(`fatal: ${String(error)}`);
  closeLog();
  process.exit(1);
});

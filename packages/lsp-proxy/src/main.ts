import process from "node:process";
import { parseArgs } from "node:util";

import { parseConfig } from "./config.ts";
import { LspProxy } from "./proxy.ts";

(async () => {
  const { values } = parseArgs({
    allowPositionals: false,
    args: process.argv.slice(2),
    options: { config: { type: "string" } },
    strict: true,
  });
  const configPath = values.config;
  if (configPath === undefined) {
    console.error("lsp-proxy: --config <path> is required");
    process.exit(1);
  }
  const raw: unknown = await Bun.file(configPath).json();
  const parsed = parseConfig(raw);
  if (!parsed.ok) {
    console.error(
      `lsp-proxy: invalid config at ${configPath}:\n${parsed.errors.join("\n")}`,
    );
    process.exit(1);
  }
  const proxy = new LspProxy(
    parsed.config,
    { readChunks: () => Bun.stdin.stream(), stdout: Bun.stdout.writer() },
    (line) => console.error(`[lsp-proxy] ${line}`),
  );
  process.on("SIGTERM", () => {
    proxy.cascadeShutdown("SIGTERM");
  });
  await proxy.run();
})().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

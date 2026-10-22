import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { format } from "node:util";

const LOG_ENV = "LSP_PROXY_LOG";

function resolveLogPath(): string | undefined {
  const setting = process.env[LOG_ENV];
  if (setting === undefined || setting === "") {
    return undefined;
  }
  if (setting === "1" || setting === "true") {
    return join(homedir(), ".local", "state", "lsp-proxy.log");
  }
  return setting;
}

let logSink: Bun.FileSink | undefined;

export async function initFileLog(): Promise<string | undefined> {
  const logPath = resolveLogPath();
  if (logPath === undefined) {
    return undefined;
  }
  await mkdir(dirname(logPath), { recursive: true });
  logSink = Bun.file(logPath).writer();
  logSink.unref();
  return logPath;
}

export function log(line: string): void {
  const entry = format(
    "%s [%d] %s",
    new Date().toISOString(),
    process.pid,
    line,
  );
  console.error(entry);
  if (logSink !== undefined) {
    logSink.write(`${entry}\n`);
    logSink.flush();
  }
}

export function closeLog(): void {
  if (logSink !== undefined) {
    logSink.end();
    logSink = undefined;
  }
}

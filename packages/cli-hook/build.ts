import { homedir } from "node:os";
import process from "node:process";

import { buildBinary } from "@cc-sdd/bin-builder";

await buildBinary(
  { binName: "claude-code-cli-hook", entrypoints: ["./src/main.ts"] },
  homedir(),
).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

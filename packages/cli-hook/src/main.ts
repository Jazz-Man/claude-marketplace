import process from "node:process";

import { runHook } from "./run-hook.ts";

try {
  const input: unknown = await Bun.stdin.json();

  const result = runHook(input);
  if (result !== null) {
    await Bun.write(Bun.stdout, `${JSON.stringify(result)}\n`);
  }
} catch (error) {
  console.error(error);
  process.exit();
}

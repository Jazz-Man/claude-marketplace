import process from "node:process";

import { runHook } from "./run-hook.ts";

(async () => {
  // Stdin entrypoint for the PreToolUse hook: the runtime parses the payload
  // (Bun.stdin.json()), the router decides, the decision (if any) goes to
  // stdout. Any rejection — malformed or empty stdin — is a silent allow.
  try {
    const input: unknown = await Bun.stdin.json();

    const result = runHook(input);
    if (result !== null) {
      await Bun.write(Bun.stdout, `${JSON.stringify(result)}\n`);
    }
  } catch (e) {
    console.error(e);
    process.exit();
  }
})();

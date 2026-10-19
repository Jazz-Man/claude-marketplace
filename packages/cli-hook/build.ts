import { homedir } from "node:os";
import { resolve } from "node:path";
import process from "node:process";

import { name as packageName } from "./package.json";

const binName = packageName.split("/").at(1);
if (binName === undefined) {
  console.error(
    `package name "${packageName}" is not scoped - no binary name to build`,
  );
  process.exit(1);
}

const outfile = resolve(homedir(), ".local/bin", binName);

try {
  const res = await Bun.build({
    bytecode: true,
    compile: {
      autoloadBunfig: false,
      autoloadDotenv: false,
      outfile,
      target: "bun-darwin-arm64",
    },
    entrypoints: ["./src/main.ts"],
    minify: true,
    sourcemap: "linked",
  });
  if (!res.success) {
    console.error(res.logs);
    process.exit(1);
  }
  console.info(res);
} catch (e) {
  console.error(e);
  process.exit(1);
}

import { homedir } from "node:os";
import process from "node:process";
import { buildConfig } from "./config.ts";
import { debug } from "./debug.ts";

try {
  const HOME_DIR = homedir();

  const settingsPath = Bun.file(`${HOME_DIR}/.claude/settings.json`);
  //
  const exist = await settingsPath.exists();

  const currentConfig = exist ? await settingsPath.json() : {};

  // claudeMdExcludes, permissions, and sandbox are owned by this tool and
  // replaced wholesale; every other key in settings.json survives as is.
  const newConfig = {
    ...currentConfig,
    ...buildConfig(),
  };

  const configData = JSON.stringify(newConfig, null, 2);

  await settingsPath.write(configData);

  // await Bun.write("claude-settings.json", configData);

  debug(newConfig, {
    depth: 10,
  });
} catch (error) {
  console.error(error);
  process.exit(1);
}

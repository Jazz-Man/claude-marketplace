/**
 * Assembly: each settings key reads exactly one list from lists/. The lists
 * are independent on purpose — an entry is toggled for one key at a time —
 * so the same entries recur, verbatim, in several files. Never dedupe them
 * into shared modules.
 */
import { allowWrite } from "./lists/allow-write.ts";
import { claudeMdExcludes } from "./lists/claude-md-excludes.ts";
import { credentialEnvVars } from "./lists/credential-env-vars.ts";
import { credentialFiles } from "./lists/credential-files.ts";
import { denyRead } from "./lists/deny-read.ts";
import { denyWrite } from "./lists/deny-write.ts";
import { permissionDeny } from "./lists/permission-deny.ts";

// Order matters — it is the order of the generated deny lists.
export const buildConfig = () => ({
  claudeMdExcludes,
  permissions: {
    deny: permissionDeny,
  },
  sandbox: {
    allowAppleEvents: false,
    allowUnsandboxedCommands: false,
    autoAllowBashIfSandboxed: true,
    credentials: {
      envVars: credentialEnvVars.map((name) => ({ mode: "deny", name })),
      files: credentialFiles.map((file) => ({
        mode: "deny",
        path: file,
      })),
    },
    enabled: true,
    enabledPlatforms: ["macos"],
    enableWeakerNestedSandbox: true,
    enableWeakerNetworkIsolation: true,
    failIfUnavailable: true,
    filesystem: {
      allowWrite,
      denyRead,
      denyWrite,
    },
    network: {
      allowAllUnixSockets: true,
      // allowedDomains: ["127.0.0.1", "localhost", "[::1]"],
      allowLocalBinding: true,
      // allowMachLookup: ["*"],
    },
  },
});

import { allowWrite } from "./lists/allow-write.ts";
import { allowedDomains } from "./lists/allowed-domains.ts";
import { claudeMdExcludes } from "./lists/claude-md-excludes.ts";
import { credentialEnvVars } from "./lists/credential-env-vars.ts";
import { credentialFiles } from "./lists/credential-files.ts";
import { denyRead } from "./lists/deny-read.ts";
import { denyWrite } from "./lists/deny-write.ts";
import { permissionAllow } from "./lists/permission-allow.ts";
import { permissionDeny } from "./lists/permission-deny.ts";

export const buildConfig = () => ({
  claudeMdExcludes,
  permissions: {
    allow: permissionAllow,
    deny: permissionDeny,
  },
  sandbox: {
    allowAppleEvents: false,
    allowUnsandboxedCommands: false,
    autoAllowBashIfSandboxed: true,
    credentials: {
      envVars: credentialEnvVars,
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
      allowedDomains,
      // allowedDomains: ["127.0.0.1", "localhost", "[::1]"],
      allowLocalBinding: true,
      // allowMachLookup: ["*"],
      tlsTerminate: {},
    },
  },
});

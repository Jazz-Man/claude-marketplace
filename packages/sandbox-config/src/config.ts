/**
 * The wiring ledger: which catalog group lands on which protection surface.
 *
 *   protectedFiles        -> read deny + write deny + sandbox credential files
 *   memoryPaths           -> read deny + write deny
 *   dependencyMemoryFiles -> read deny + sandbox credential files + CLAUDE.md excludes
 *   dependencyWriteOnly, managerStateDirs, systemWriteOnly,
 *   gitConfigWriteOnly, configWriteOnly -> write deny only
 *   gitHistoryWriteOnly   -> sandbox denyWrite only (Edit(.git/**) is a separate rule)
 *   gitWriteCommands, disableCommands    -> Bash deny
 */

import {
  dependencyMemoryDirs,
  dependencyMemoryNames,
  memoryPaths,
} from "./catalog/agent-memory.ts";
import { disableCommands, gitWriteCommands } from "./catalog/commands.ts";
import {
  dependencyCacheRoots,
  dependencyFolders,
  dependencyPrefixes,
  dependencyWriteOnly,
  managerStateDirs,
} from "./catalog/dependencies.ts";
import {
  credentialDirs,
  envVars,
  keyNames,
  keySuffixes,
  secretConfigFiles,
  secretFileNames,
  secretRcFiles,
} from "./catalog/secrets.ts";
import {
  cloudStateDirs,
  homeStateFiles,
  macOSDirs,
  projectSecretNames,
  secretStateDirs,
} from "./catalog/state.ts";
import {
  configWriteOnly,
  gitConfigWriteOnly,
  gitHistoryWriteOnly,
  systemWriteAllow,
  systemWriteOnly,
} from "./catalog/write-only.ts";
import { bothForms, unique } from "./patterns.ts";

// Denied for BOTH reading and writing: secrets, state, and macOS user trees.
// Order matters — it is the order of the generated deny lists.
const protectedFiles = unique([
  ...keySuffixes.flatMap((suffix) => bothForms(`*.${suffix}`)),
  ...keyNames.flatMap(bothForms),
  ...secretFileNames.flatMap(bothForms),
  ...secretRcFiles.flatMap(bothForms),
  ...secretConfigFiles.flatMap(bothForms),
  ...projectSecretNames.flatMap(bothForms),
  ...homeStateFiles,
  ...credentialDirs,
  ...secretStateDirs,
  ...cloudStateDirs,
  ...macOSDirs,
]);

const memoryEntries = [
  ...dependencyMemoryNames,
  ...dependencyMemoryDirs.map((dir) => `${dir}/**`),
];

// Agent instruction files reachable inside dependency trees, curated sources,
// and dependency caches.
const dependencyMemoryFiles = unique([
  ...dependencyFolders.flatMap((folder) =>
    memoryEntries.map((entry) => `~/**/${folder}/**/${entry}`),
  ),
  ...dependencyPrefixes.flatMap((prefix) =>
    [...dependencyMemoryNames, ...dependencyMemoryDirs].flatMap((entry) => [
      `${prefix}/${entry}`,
      `${prefix}/**/${entry}`,
    ]),
  ),
  ...dependencyCacheRoots.flatMap((root) =>
    memoryEntries.map((entry) => `${root}/**/${entry}`),
  ),
]);

const readDenyPaths = unique([
  // ...protectedFiles,
  // ...memoryPaths,
  ...dependencyMemoryFiles,
]);

const writeDenyPaths = unique([
  ...protectedFiles,
  ...gitConfigWriteOnly,
  ...configWriteOnly,
  ...dependencyWriteOnly,
  ...managerStateDirs,
  ...systemWriteOnly,
  ...memoryPaths,
]);

const pathsToRules = (paths: readonly string[], ...tools: string[]) =>
  tools.flatMap((tool) => paths.map((path) => `${tool}(${path})`));

export const buildConfig = () => ({
  claudeMdExcludes: unique(dependencyMemoryFiles),
  permissions: {
    deny: unique([
      // ...pathsToRules(readDenyPaths, "Read"),
      // ...pathsToRules(writeDenyPaths, "Edit"),
      ...pathsToRules(["**/.git", "**/.git/**"], "Edit"),
      ...pathsToRules(gitWriteCommands, "Bash"),
      ...pathsToRules(disableCommands, "Bash"),
    ]),
  },
  sandbox: {
    allowAppleEvents: false,
    allowUnsandboxedCommands: false,
    autoAllowBashIfSandboxed: true,
    credentials: {
      envVars: unique(envVars).map((name) => ({ mode: "deny", name })),
      files: unique([...protectedFiles, ...dependencyMemoryFiles]).map(
        (file) => ({
          mode: "deny",
          path: file,
        }),
      ),
    },
    enabled: true,
    enabledPlatforms: ["macos"],
    enableWeakerNestedSandbox: true,
    enableWeakerNetworkIsolation: true,
    failIfUnavailable: true,
    filesystem: {
      allowWrite: systemWriteAllow,
      denyRead: readDenyPaths,
      denyWrite: unique([...writeDenyPaths, ...gitHistoryWriteOnly]),
    },
    network: {
      allowAllUnixSockets: true,
      // allowedDomains: ["127.0.0.1", "localhost", "[::1]"],
      allowLocalBinding: true,
      // allowMachLookup: ["*"],
    },
  },
});

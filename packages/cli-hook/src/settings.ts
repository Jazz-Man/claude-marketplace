/** biome-ignore-all lint/style/noExcessiveLinesPerFile: literal deny lists are data, not logic */
import process from "node:process";
import { debug } from "./debug.ts";

const bothForms = (name: string): string[] => [`~/${name}`, `~/**/${name}`];

const envVars = [
  "GITHUB_TOKEN",
  "GITHUB_AUTH_TOKEN",
  "GITHUB_PERSONAL_ACCESS_TOKEN",
  "GITHUB_PUBLICK_EMAIL",
  "HUGGINGFACE_TOKEN",
  "ANTHROPIC_API_KEY",
  "GOOGLE_AI_API_KEY",
  "GEMINI_API_KEY",
  "OLLAMA_API_KEY",
  "CONTEXT7_API_KEY",
  "QWEN_CODER_API",
  "INTELEPHENSE_LICENSE_KEY",
  "Z_AI_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
  "NPM_CONFIG_TOKEN",
  "NPM_CONFIG_TOKEN_TEST",
];

const keySuffixes = [
  "pem",
  "pub",
  "key",
  "p12",
  "pfx",
  "p8",
  "ppk",
  "jks",
  "keystore",
  "secret",
  "secrets",
];

const keyNames = [
  "authorized_keys",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  "id_rsa",
];

const secretFileNames = ["credentials.json", "token.json", ".vault-token"];

const secretRcFiles = [
  ".netrc",
  "_netrc",
  ".npmrc",
  ".yarnrc",
  ".yarnrc.yml",
  ".pypirc",
  ".gemrc",
  ".curlrc",
  ".wgetrc",
  ".condarc",
  ".pearrc",
  ".dockercfg",
  ".authrc",
  ".ldaprc",
  ".sentryclirc",
  ".mongorc.js",
  ".hgrc",
  ".msmtprc",
  ".mbsyncrc",
  ".offlineimaprc",
  ".fetchmailrc",
  ".muttrc",
  ".mailrc",
  ".lftprc",
  ".screenrc",
];

const secretConfigFiles = [
  ".my.cnf",
  ".mariadb.cnf",
  ".mylogin.cnf",
  ".pgpass",
  ".pg_service.conf",
  ".rclone.conf",
  ".s3cfg",
  ".boto",
  ".ansible.cfg",
  ".envrc",
];

const wildcardSecrets = [
  ".*login*",
  ".*logout*",
  ".*history*",
  ".*profile*",
  ".htpasswd*",
];

const projectSecretNames = [".DS_Store*", ".env", ".env.*", "Brewfile*"];

const homeStateFiles = [
  "~/.zshenv*",
  "~/.zcompdump*",
  "~/.zsh_sessions*",
  "~/.v8flags*",
  "~/.mutagen*",
  "~/.wget-hsts*",
  "~/.viminfo*",
  "~/.tmux*",
  "~/.git-credentials*",
  "~/.gitconfig*",
  "~/.bunfig.toml",
  "~/.gdbinit",
];

const credentialDirs = [
  "~/.ssh",
  "~/.aws",
  "~/.gnupg",
  "~/.gcloud",
  "~/.config",
  "~/.docker",
  "~/.kube",
  "~/.azure",
  "~/.keychain",
  "~/.appstoreconnect",
  "~/private_keys",
];

const secretStateDirs = [
  "~/.cloudflared",
  "~/.gsutil",
  "~/.mcp-auth",
  "~/.linkedin-mcp",
  "~/.zai",
  "~/.alchemy",
  "~/.slack",
  "~/.pgadmin",
  "~/.redis-insight",
  "~/.mysqlsh",
  "~/.subversion",
  "~/.BurpSuite",
  "~/.JWT4B",
  "~/.cryptoplugin",
  "~/.maryam",
  "~/.tor",
  "~/.postman",
  "~/Postman",
  "~/.ipython",
  "~/.jupyter",
  "~/.Trash",
  "~/.Xauthority",
  "~/.rnd",
  "~/.qwen",
  "~/.zed",
  "~/.claude.json",
  "~/.claude.json.backup",
];

const macOSDirs = [
  "~/Library",
  "~/Documents",
  "~/Downloads",
  "~/Movies",
  "~/Music",
  "~/Pictures",
  "~/Public",
  "~/Applications",
  "~/Sites",
  "~/Desktop",
];

const protectedFiles = [
  ...keySuffixes.flatMap((suffix) => bothForms(`*.${suffix}`)),
  ...keyNames.flatMap(bothForms),
  ...secretFileNames.flatMap(bothForms),
  ...secretRcFiles.flatMap(bothForms),
  ...secretConfigFiles.flatMap(bothForms),
  ...wildcardSecrets.flatMap(bothForms),
  ...projectSecretNames.flatMap(bothForms),
  ...homeStateFiles,
  ...credentialDirs,
  ...secretStateDirs,
  ...macOSDirs,
];

const memoryPaths = [
  "~/.claude/projects/**/memory",
  "~/.claude/agent-memory",
  ".claude/agent-memory",
  ".claude/agent-memory-local",
];

const dependencyFolders = ["node_modules", "vendor", "Pods", ".venv", "venv"];

const dependencyMemoryNames = [
  "CLAUDE.md",
  "AGENTS.md",
  "QWEN.md",
  "GEMINI.md",
  "COPILOT.md",
  "CONVENTIONAL.md",
  "copilot-instructions.md",
  ".cursorrules",
  ".clinerules",
  ".windsurfrules",
];

const dependencyMemoryDirs = [
  ".claude",
  ".cursor",
  // ".aider-desk",
  // ".agents",
  // ".autohand",
  // ".augment",
  // ".bob",
  // ".codeartsdoer",
  // ".codebuddy",
  // ".codemaker",
  // ".codestudio",
  // ".commandcode",
  // ".continue",
  // ".cortex",
  // ".crush",
  // ".devin",
  // ".forge",
  // ".goose",
  // ".grok",
  // ".hermes",
  // ".iflow",
  // ".inferencesh",
  // ".jazz",
  // ".junie",
  // ".kiro",
  // ".kode",
  // ".lingma",
  // ".mcpjam",
  // ".minimax",
  // ".moxby",
  // ".mux",
  // ".neovate",
  // ".ona",
  // ".openhands",
  // ".pochi",
  // ".posit/assistant",
  // ".qoder",
  ".qwen",
  // ".reasonix",
  // ".roo",
  // ".rovodev",
  // ".tabnine/agent",
  // ".terramind",
  // ".tinycloud",
  // ".trae",
  // ".windsurf",
  // ".zcode",
  // ".zencoder",
  // ".adal",
  // "skills",
];

const dependencyCacheRoots = ["~/.cargo/registry/src", "~/go/pkg/mod"];

const dependencyPrefixes = ["/opt/homebrew"];

const memoryEntries = [
  ...dependencyMemoryNames,
  ...dependencyMemoryDirs.map((dir) => `${dir}/**`),
];

const dependencyMemoryFiles = [
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
];

const gitHistoryWriteOnly = ["/**/.git"];

const gitHistoryDenyRules = ["Edit(**/.git/*)", "Write(**/.git)"];

const configWriteOnly = [".gitmodules", ".mcp.json", ".lsp.json"].flatMap(
  bothForms,
);

const dependencyWriteOnly = [
  ...dependencyFolders.flatMap((folder) => [`**/${folder}`, `**/${folder}/**`]),
  "**/package.json",
  "**/package-lock.json",
  "**/npm-shrinkwrap.json",
  "**/bun.lock",
  "**/bun.lockb",
  "**/pnpm-lock.yaml",
  "**/yarn.lock",
  "**/Cargo.toml",
  "**/Cargo.lock",
  "**/go.mod",
  "**/go.sum",
  "**/composer.json",
  "**/composer.lock",
  "**/Gemfile",
  "**/Gemfile.lock",
  "**/gems.locked",
  "**/Package.swift",
  "**/Package.resolved",
  "**/pyproject.toml",
  "**/requirements*.txt",
  "**/poetry.lock",
  "**/uv.lock",
  "**/Pipfile",
  "**/Pipfile.lock",
  "**/deno.json",
  "**/deno.lock",
];

const managerStateDirs = [
  "~/.bun",
  "~/.npm",
  "~/.pnpm-store",
  "~/.pnpm-state",
  "~/.local/share/pnpm",
  "~/.yarn",
  "~/.local/share/yarn",
  "~/.cache",
  "~/.cargo",
  "~/.rustup",
  "~/go",
  "~/.deno",
  "~/.pip",
  "~/.local/pipx",
  "~/.composer",
  "~/.gem",
  "~/.bundle",
  "~/.swiftpm",
];

const systemWriteOnly = [
  "/Applications",
  "/Library",
  "/System",
  "/Volumes",
  "/bin",
  "/etc",
  "/opt",
  "/private/etc",
  "/private/var",
  "/sbin",
  "/usr",
  "/var",
];

const gitWriteCommands = [
  "git add*",
  "git commit*",
  "git push*",
  "git merge*",
  "git rebase*",
  "git reset*",
  "git revert*",
  "git checkout*",
  "git switch*",
  "git stash*",
  "git cherry-pick*",
  "git restore*",
  "git clean*",
  "git rm*",
  "git mv*",
  "git tag v*",
  "git branch -D *",
  "git submodule update*",
  "git hook*",
  "git init*",
  "git clone*",
];

const disableCommands = [
  "sudo*",
  "brew*",
  "nix*",
  "bunx*",
  "npx*",
  "pnpx*",
  "uvx*",
  "grep*",
  "egrep*",
  "fgrep*",
  "find*",
  "xargs grep*",
  "xargs find*",
];

const readDenyPaths = [
  ...protectedFiles,
  ...memoryPaths,
  ...dependencyMemoryFiles,
];

const writeDenyPaths = [
  ...protectedFiles,
  ...configWriteOnly,
  ...dependencyWriteOnly,
  ...managerStateDirs,
  ...systemWriteOnly,
  ...memoryPaths,
];

const pathsToRules = (paths: readonly string[], ...tools: string[]) =>
  tools.flatMap((tool) => paths.map((path) => `${tool}(${path})`));

const config = {
  claudeMdExcludes: dependencyMemoryFiles,
  permissions: {
    deny: [
      ...pathsToRules(readDenyPaths, "Read"),
      ...pathsToRules(writeDenyPaths, "Edit", "Write"),
      ...gitHistoryDenyRules,
      ...pathsToRules(gitWriteCommands, "Bash"),
      ...pathsToRules(disableCommands, "Bash"),
    ],
  },
  sandbox: {
    allowAppleEvents: true,
    allowUnsandboxedCommands: false,
    autoAllowBashIfSandboxed: true,
    credentials: {
      envVars: envVars.map((env) => ({ mode: "deny", name: env })),
      files: [...protectedFiles, ...dependencyMemoryFiles].map((file) => ({
        mode: "deny",
        path: file,
      })),
    },
    enabled: true,
    enabledPlatforms: ["macos"],
    enableWeakerNetworkIsolation: true,
    failIfUnavailable: true,
    filesystem: {
      denyRead: readDenyPaths,
      denyWrite: [...writeDenyPaths, ...gitHistoryWriteOnly],
    },
    network: { allowAllUnixSockets: true, allowLocalBinding: true },
  },
};

try {
  const settingsPath = Bun.file(".claude/settings.json");

  const currentConfig = await settingsPath.json();

  const newConfig = {
    ...currentConfig,
    claudeMdExcludes: config.claudeMdExcludes,
    permissions: config.permissions,
    sandbox: config.sandbox,
  };

  await Bun.file(".claude/settings.json").write(
    JSON.stringify(newConfig, null, 2),
  );

  debug(newConfig, {
    depth: 10,
  });
} catch (error) {
  console.error(error);
  process.exit(1);
}

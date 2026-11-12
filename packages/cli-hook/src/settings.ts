/** biome-ignore-all lint/style/noExcessiveLinesPerFile: literal deny lists are data, not logic */

import { homedir } from "node:os";
import process from "node:process";
import { debug } from "./debug.ts";

const bothForms = (name: string): string[] => [`~/${name}`, `~/**/${name}`];

const unique = (items: readonly string[]): string[] => [...new Set(items)];

const envVars = [
  "GITHUB_TOKEN",
  "GITHUB_AUTH_TOKEN",
  "GITHUB_PERSONAL_ACCESS_TOKEN",
  "GITHUB_PUBLICK_EMAIL",
  "GH_TOKEN",
  "GH_ENTERPRISE_TOKEN",
  "GITHUB_ENTERPRISE_TOKEN",
  "OPENAI_API_KEY",
  "HF_TOKEN",
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
  "NPM_TOKEN",
  "NPM_CONFIG_TOKEN_TEST",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "CARGO_REGISTRY_TOKEN",
  "GEM_HOST_API_KEY",
  "TWINE_PASSWORD",
  "PYPI_TOKEN",
  "VAULT_TOKEN",
  "SENTRY_AUTH_TOKEN",
  "DOCKER_PASSWORD",
  "KUBECONFIG",
  "SSH_AUTH_SOCK",
  "BASH_ENV",
  "GIT_SSH_COMMAND",
  "GIT_ASKPASS",
  "GIT_EDITOR",
  "GIT_CONFIG",
  "GIT_CONFIG_GLOBAL",
  "GIT_PAGER",
  "PAGER",
  "EDITOR",
  "DYLD_INSERT_LIBRARIES",
  "DYLD_LIBRARY_PATH",
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
  ".zshrc*",
  ".bashrc*",
  ".kshrc*",
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
  "~/.bunfig.toml",
  "~/.gdbinit",
  "~/.oh-my-zsh",
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

const cloudStateDirs = [
  "~/.fly",
  "~/.supabase",
  "~/.netlify",
  "~/.heroku",
  "~/.circleci",
  "~/.travis",
  "~/.buildkite",
  "~/.railway",
  "~/.render",
  "~/.planetscale",
  "~/.neon",
  "~/.twilio",
  "~/.newrelic",
  "~/.launchdarkly",
  "~/.op",
  "~/.doctl",
  "~/.linode-cli",
  "~/.vultr",
  "~/.ibm-cloud",
  "~/.bluemix",
  "~/.alibabacloud",
  "~/.aliyun",
  "~/.tencentcloud",
  "~/.pulumi",
  "~/.p4tickets",
  "~/.p4trust",
  "~/.chef",
  "~/.okta-aws",
  "~/.saml2aws",
  "~/.aws-sso",
  "~/.aws-vault",
  "~/.minikube",
  "~/.colima",
  "~/.helm",
  "~/.mc",
  "~/.irssi",
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

const protectedFiles = unique([
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
  ...cloudStateDirs,
  ...macOSDirs,
]);

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

const gitHistoryWriteOnly = ["/**/.git"];

const gitConfigWriteOnly = ["~/.gitconfig*"];

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

const disableCommands = ["sudo*", "omz*", "brew*", "nix*", "bunx*", "npx*", "pnpx*", "uvx*"];

const readDenyPaths = unique([
  ...protectedFiles,
  ...memoryPaths,
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

const config = {
  claudeMdExcludes: unique(dependencyMemoryFiles),
  permissions: {
    deny: unique([
      ...pathsToRules(readDenyPaths, "Read"),
      ...pathsToRules(writeDenyPaths, "Edit"),
      ...pathsToRules(["**/.git", "**/.git/**"], "Edit"),
      ...pathsToRules(gitWriteCommands, "Bash"),
      ...pathsToRules(disableCommands, "Bash"),
    ]),
  },
  sandbox: {
    allowAppleEvents: true,
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
    enableWeakerNetworkIsolation: true,
    failIfUnavailable: true,
    filesystem: {
      denyRead: readDenyPaths,
      denyWrite: unique([...writeDenyPaths, ...gitHistoryWriteOnly]),
    },
    network: { allowAllUnixSockets: true, allowLocalBinding: true },
  },
};

try {
  const HOME_DIR = homedir();

  const settingsPath = Bun.file(`${HOME_DIR}/.claude/settings.json`);

  const currentConfig = await settingsPath.json();

  const newConfig = {
    ...currentConfig,
    claudeMdExcludes: config.claudeMdExcludes,
    permissions: config.permissions,
    sandbox: config.sandbox,
  };

  await settingsPath.write(JSON.stringify(newConfig, null, 2));

  debug(newConfig, {
    depth: 10,
  });
} catch (error) {
  console.error(error);
  process.exit(1);
}

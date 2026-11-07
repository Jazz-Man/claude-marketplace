import process from "node:process";

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

const protectedFiles = [
  "**/.DS_Store*",
  "**/.env",
  "**/.env.*",
  "~/.ssh",
  "~/.aws",
  "~/.gnupg",
  "~/.gcloud",
  "~/.config",
  "~/.docker",
  "~/.kube",
  "~/.htpasswd*",
  "~/.zshenv*",
  "~/.*rc*",
  "~/.v8flags*",
  "~/.mutagen*",
  "~/.*login*",
  "~/.*logout*",
  "~/.*history*",
  "~/.zcompdump*",
  "~/.zsh_sessions*",
  "~/.*profile*",
  "~/.wget-hsts*",
  "~/.viminfo*",
  "~/.tmux*",
  "~/.git-credentials*",
  "**/Brewfile*",
  "~/Brewfile*",
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

const gitHistoryWriteOnly = ["/**/.git"];

const gitHistoryDenyRules = ["Edit(**/.git/*)", "Write(**/.git)"];

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

const nativeSearchCommands = [
  "grep*",
  "egrep*",
  "fgrep*",
  "find*",
  "xargs grep*",
  "xargs find*",
];

const config = {
  permissions: {
    deny: [
      ...protectedFiles.map((file) => `Read(${file})`),
      ...protectedFiles.map((file) => `Edit(${file})`),
      ...protectedFiles.map((file) => `Write(${file})`),
      ...gitHistoryDenyRules,
      ...gitWriteCommands.map((command) => `Bash(${command})`),
      ...nativeSearchCommands.map((command) => `Bash(${command})`),
    ],
  },
  sandbox: {
    allowAppleEvents: true,
    allowUnsandboxedCommands: false,
    autoAllowBashIfSandboxed: true,
    credentials: {
      envVars: envVars.map((env) => ({ mode: "deny", name: env })),
      files: protectedFiles.map((file) => ({ mode: "deny", path: file })),
    },
    enabled: true,
    enabledPlatforms: ["macos"],
    enableWeakerNetworkIsolation: true,
    failIfUnavailable: true,
    filesystem: {
      denyRead: protectedFiles,
      denyWrite: [...protectedFiles, ...gitHistoryWriteOnly],
    },
    network: { allowAllUnixSockets: true, allowLocalBinding: true },
  },
};

try {
  const settingsPath = Bun.file(".claude/settings.json");

  const currentConfig = await settingsPath.json();

  const newConfig = {
    ...currentConfig,
    permissions: config.permissions,

    sandbox: config.sandbox,
  };

  await Bun.file(".claude/settings.json").write(
    JSON.stringify(newConfig, null, 2),
  );

  console.log(newConfig);
} catch (error) {
  console.error(error);
  process.exit(1);
}

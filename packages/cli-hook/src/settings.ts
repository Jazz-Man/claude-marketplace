import process from "node:process";
import { debug } from "./debug.ts";

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

const memoryPaths = [
  "~/.claude/projects/**/memory",
  "~/.claude/agent-memory",
  ".claude/agent-memory",
  ".claude/agent-memory-local",
];

const dependencyFolders = ["node_modules"];

const list: string[] = [];

dependencyFolders.forEach((folder) => {
  list.push(`**/${folder}/**/CLAUDE.md`);
});

console.log(list);

const dependencyMemoryFiles = [
  "**/node_modules/**/CLAUDE.md",
  "**/node_modules/**/AGENTS.md",
  "**/node_modules/**/QWEN.md",
  "**/node_modules/**/GEMINI.md",
  "**/node_modules/**/COPILOT.md",
  "**/node_modules/**/CONVENTIONAL.md",
  "**/node_modules/**/copilot-instructions.md",
  "**/node_modules/**/.cursorrules",
  "**/node_modules/**/.clinerules",
  "**/node_modules/**/.windsurfrules",
  "**/node_modules/**/.claude/**",
  "**/node_modules/**/.cursor/**",
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

const disableCommands = [
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

const config = {
  claudeMdExcludes: dependencyMemoryFiles,
  permissions: {
    deny: [
      ...protectedFiles.map((file) => `Read(${file})`),
      ...protectedFiles.map((file) => `Edit(${file})`),
      ...protectedFiles.map((file) => `Write(${file})`),
      ...memoryPaths.map((file) => `Read(${file})`),
      ...memoryPaths.map((file) => `Edit(${file})`),
      ...memoryPaths.map((file) => `Write(${file})`),
      ...dependencyMemoryFiles.map((file) => `Read(${file})`),
      ...gitHistoryDenyRules,
      ...gitWriteCommands.map((command) => `Bash(${command})`),
      ...disableCommands.map((command) => `Bash(${command})`),
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
      denyRead: [...protectedFiles, ...memoryPaths, ...dependencyMemoryFiles],
      denyWrite: [...protectedFiles, ...gitHistoryWriteOnly, ...memoryPaths],
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

  // debug(newConfig, {
  //   depth: 10,
  // });
} catch (error) {
  console.error(error);
  process.exit(1);
}

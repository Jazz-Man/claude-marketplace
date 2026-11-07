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

// never add "~/.gitconfig*" back: git reads it even for status, so any deny
// on it kills git outright — and matching stays segment-aware, so a ".git"
// entry never touches ".github"

// git history: reads stay open, writes denied anywhere on disk
// ("/**/.git" is absolute-rooted in sandbox paths, covering tmp and every repo)
const gitHistoryWriteOnly = ["/**/.git"];

// the same protection as permission rules for the file tools (project-anchored)
const gitHistoryDenyRules = ["Edit(**/.git/*)", "Write(**/.git)"];

// flat text approximation of the semantic policy in policies/git-readonly.ts —
// Bash patterns cannot express its flag/subcommand logic, so the two lists live apart
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

// mirror of the native-search policy in policies/native-search.ts: grep/egrep/
// fgrep/find banned as commands AND in argument position (xargs forms) — the
// built-in Grep and Glob tools replace them, rg stays the CLI fallback;
// text patterns cannot see the plugin's arg analysis, so absolute-path and
// `command grep` spellings stay open (same approximation class as the git list)
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

console.log(JSON.stringify(config));
// console.log(JSON.stringify(config, null, 2));

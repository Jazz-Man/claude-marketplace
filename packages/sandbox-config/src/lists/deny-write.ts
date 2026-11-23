/**
 * sandbox.filesystem.denyWrite — paths sandboxed commands cannot write.
 * This list is this key's alone; see config.ts for why lists never share
 * entries (the secret and state groups recur verbatim in credential-files.ts).
 */
/** biome-ignore-all lint/style/noExcessiveLinesPerFile: <explanation> */
import { bothForms, unique } from "../utils.ts";

// Denied for BOTH reading and writing: secrets, state, and macOS user trees.
// Credential-bearing material: key files and rc/config files that commonly
// hold credentials, and whole credential-store directories.
const keySuffixes = [
  // "pem",
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
  // ".npmrc",
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

// User and machine state: shell/tool state files, credential-adjacent state
// directories, cloud CLI state, and the macOS user trees.
const projectSecretNames = [
  ".DS_Store*",
  // ".env", ".env.*",
  "Brewfile*",
];

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

// Write-only protections that stay readable: git metadata, repo tool config,
// and system trees.
const gitConfigWriteOnly = ["~/.gitconfig*"];

const configWriteOnly = [".gitmodules", ".mcp.json", ".lsp.json"].flatMap(
  bothForms,
);

// The install world: dependency trees, manifests and lockfiles, package
// manager state. Readable — source inspection is legitimate — but never
// writable: installs and dependency changes belong to the owner.
const dependencyFolders = ["node_modules", "vendor", "Pods", ".venv", "venv"];

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
  // "~/.cache",
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
  "/private/var/agentx*",
  "/private/var/at*",
  "/private/var/audit*",
  "/private/var/db*",
  "/private/var/log*",
  "/private/var/mail*",
  "/private/var/root*",
  "/private/var/run*",
  "/private/var/spool*",
  "/private/var/vm*",
  "/sbin",
  "/usr",
];

const memoryPaths = [
  "~/.claude/projects/**/memory",
  "~/.claude/agent-memory",
  ".claude/agent-memory",
  ".claude/agent-memory-local",
];

export const denyWrite = unique([
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
  ...gitConfigWriteOnly,
  ...configWriteOnly,
  ...dependencyWriteOnly,
  ...managerStateDirs,
  ...systemWriteOnly,
  ...memoryPaths,
  "/**/.git",
]);

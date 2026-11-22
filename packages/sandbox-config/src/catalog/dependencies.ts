/**
 * The install world: dependency trees, manifests and lockfiles, package
 * manager state, and curated dependency sources. Readable — source
 * inspection is legitimate — but never writable: installs and dependency
 * changes belong to the owner.
 */

export const dependencyFolders = [
  "node_modules",
  "vendor",
  "Pods",
  ".venv",
  "venv",
];

export const dependencyCacheRoots = ["~/.cargo/registry/src", "~/go/pkg/mod"];

export const dependencyPrefixes = ["/opt/homebrew"];

export const dependencyWriteOnly = [
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

export const managerStateDirs = [
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

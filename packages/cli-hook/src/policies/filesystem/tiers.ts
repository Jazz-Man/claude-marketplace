import { basename } from "node:path";

import { HOME, inHome } from "./resolve.ts";

const SECRETS_BASENAMES = new Set([
  "id_rsa",
  "id_ed25519",
  "id_ecdsa",
  "credentials.json",
  "token.json",
  ".netrc",
  ".npmrc",
  ".pypirc",
  ".htpasswd",
  "terraform.tfstate",
]);
const SECRETS_SUBPATHS = new Set([
  ".ssh",
  ".aws",
  ".gnupg",
  ".gcloud",
  ".docker",
  ".kube",
]);
const PERSONAL_HOME_SUBPATHS = new Set([".config", ".vscode", ".cursor"]);
const PERSONAL_BASENAMES = new Set([
  ".bashrc",
  ".zshrc",
  ".zprofile",
  ".profile",
  ".bash_profile",
  ".vimrc",
  ".gitconfig",
]);
const MACOS_PERSONAL_DIRS = new Set([
  "desktop",
  "documents",
  "downloads",
  "movies",
  "music",
  "pictures",
  "public",
  "applications",
  "sites",
]);

const SECRET_SUFFIXES = [".pem", ".key", ".p12", ".pfx", ".secret", ".secrets"];

function isSecretBasename(base: string): boolean {
  const lowercased = base.toLowerCase();
  return (
    lowercased === ".env" ||
    lowercased.startsWith(".env.") ||
    SECRET_SUFFIXES.some((suffix) => lowercased.endsWith(suffix))
  );
}

function gitTier(absPath: string): Tier | null {
  const lowercased = absPath.toLowerCase();
  if (lowercased.endsWith("/.git/config")) {
    return "git-config";
  }
  if (
    lowercased.includes("/.git/hooks/") ||
    lowercased.endsWith("/.git/hooks")
  ) {
    return "git-hooks";
  }
  return null;
}

function segmentTier(seg: string): Tier | null {
  if (MACOS_PERSONAL_DIRS.has(seg)) {
    return "macos-personal";
  }
  if (SECRETS_SUBPATHS.has(seg)) {
    return "secrets";
  }
  return null;
}

function personalTier(
  restHome: string,
  base: string,
  seg: string,
): Tier | null {
  if (PERSONAL_BASENAMES.has(base.toLowerCase()) && !restHome.includes("/")) {
    return "personal";
  }
  if (PERSONAL_HOME_SUBPATHS.has(seg)) {
    return "personal";
  }
  return null;
}

function homeTier(restHome: string, base: string): Tier | null {
  const lower = restHome.toLowerCase();
  if (lower === "library" || lower.startsWith("library/")) {
    return "macos-library";
  }
  const seg = lower.split("/")[0] ?? "";
  const dirTier = segmentTier(seg);
  if (dirTier !== null) {
    return dirTier;
  }
  if (lower === ".claude.json" || lower === ".claude/settings.json") {
    return "settings";
  }
  return personalTier(restHome, base, seg);
}

function secretsTier(base: string): Tier | null {
  if (isSecretBasename(base) || SECRETS_BASENAMES.has(base.toLowerCase())) {
    return "secrets";
  }
  return null;
}

function tierUnderHome(absPath: string, base: string): Tier | null {
  if (!inHome(absPath)) {
    return null;
  }
  return homeTier(absPath.slice(HOME.length + 1), base);
}

function projectSettingsTier(absPath: string): Tier | null {
  const lower = absPath.toLowerCase();
  if (
    lower.endsWith("/.claude/settings.json") ||
    lower.endsWith("/.claude/settings.local.json")
  ) {
    return "settings";
  }
  return null;
}

export type Tier =
  | "secrets"
  | "settings"
  | "git-config"
  | "git-hooks"
  | "personal"
  | "macos-library"
  | "macos-personal";

export function tierOf(absPath: string): Tier | null {
  const base = basename(absPath);
  return (
    gitTier(absPath) ??
    secretsTier(base) ??
    tierUnderHome(absPath, base) ??
    projectSettingsTier(absPath)
  );
}

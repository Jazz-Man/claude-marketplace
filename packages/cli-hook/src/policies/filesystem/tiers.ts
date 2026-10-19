import { basename } from "node:path";

import { HOME } from "./resolve.ts";

// ---- Tier tables ----
// Membership collections are Sets (.has); plain arrays are pattern lists,
// iterated only for suffix/prefix matching (SECRET_SUFFIXES).

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
// No "system" tier: everything outside $HOME ∪ projectRoot is denied by
// the boundary — a point-list of /etc files would change only the reason
// text while misleading readers into thinking it was the gate.
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
// macOS home layout: ~/Library denies everything (Keychains, Safari, Mail,
// Application Support); personal content folders deny writes/deletes, reads
// pass. Matching is case-insensitive — the root APFS volume is
// case-insensitive (/TMP is /tmp).
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

// KISS: every wildcard pattern in the tier tables is a suffix match or a
// .env-family basename — no general glob engine is needed.
const SECRET_SUFFIXES = [".pem", ".key", ".p12", ".pfx", ".secret", ".secrets"];

function isSecretBasename(base: string): boolean {
  const b = base.toLowerCase(); // root APFS is case-insensitive: .ENV is .env
  return (
    b === ".env" ||
    b.startsWith(".env.") ||
    SECRET_SUFFIXES.some((s) => b.endsWith(s))
  );
}

// git internals are location-independent (a repo can live anywhere).
// Comparisons run lowercase: the root APFS volume is case-insensitive, so
// .GIT/hooks IS .git/hooks.
function gitTier(absPath: string): Tier | null {
  const p = absPath.toLowerCase();
  if (p.endsWith("/.git/config")) {
    return "git-config";
  }
  if (p.includes("/.git/hooks/") || p.endsWith("/.git/hooks")) {
    return "git-hooks";
  }
  return null;
}

// Classify a path under $HOME by its first home-relative segment
// (restHome is the path with the home prefix stripped).
function homeTier(restHome: string, base: string): Tier | null {
  const lower = restHome.toLowerCase();
  if (lower === "library" || lower.startsWith("library/")) {
    return "macos-library";
  }
  const seg = lower.split("/")[0] ?? "";
  if (MACOS_PERSONAL_DIRS.has(seg)) {
    return "macos-personal";
  }
  if (SECRETS_SUBPATHS.has(seg)) {
    return "secrets";
  }
  // lower: ~/.CLAUDE.json is ~/.claude.json on the root APFS volume
  if (lower === ".claude.json" || lower === ".claude/settings.json") {
    return "settings";
  }
  if (PERSONAL_BASENAMES.has(base.toLowerCase()) && !restHome.includes("/")) {
    return "personal";
  }
  if (PERSONAL_HOME_SUBPATHS.has(seg)) {
    return "personal";
  }
  return null;
}

export type Tier =
  | "secrets" // read+write denied everywhere
  | "settings" // read+write denied everywhere (self-disable protection)
  | "git-config" // write denied everywhere, read allowed
  | "git-hooks" // ANY reference denied (read/write/execute)
  | "personal" // write denied (home-relative persistence vector), read allowed
  | "macos-library" // ~/Library: read+write denied (Keychains, Safari, Mail)
  | "macos-personal"; // macOS content folders: write/delete denied, read allowed

export function tierOf(absPath: string): Tier | null {
  const base = basename(absPath);
  const git = gitTier(absPath);
  if (git !== null) {
    return git;
  }
  // lowercase lookup: credentials.JSON is credentials.json on root APFS
  if (isSecretBasename(base) || SECRETS_BASENAMES.has(base.toLowerCase())) {
    return "secrets";
  }
  const underHome =
    HOME !== "" && (absPath === HOME || absPath.startsWith(`${HOME}/`));
  if (underHome) {
    const homeTierHit = homeTier(absPath.slice(HOME.length + 1), base);
    if (homeTierHit !== null) {
      return homeTierHit;
    }
  }
  // Settings files outside $HOME (project-level .claude/) — lowercase:
  // .Claude/settings.local.json is the same file on the root APFS volume.
  const lower = absPath.toLowerCase();
  if (
    lower.endsWith("/.claude/settings.json") ||
    lower.endsWith("/.claude/settings.local.json")
  ) {
    return "settings";
  }
  return null;
}

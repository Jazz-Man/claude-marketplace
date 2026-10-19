import { homedir } from "node:os";
import { isAbsolute, join, normalize } from "node:path";

import type { PolicyContext } from "../../core/policy.ts";

// $HOME with a name boundary: $HOMEevil is a DIFFERENT (unset) variable.
const HOME_HEAD = /^\$HOME(?![A-Za-z0-9_])/;
// Flag-headed token: bare flags stay skipped, --flag=value yields its value.
const FLAG_HEAD = /^-/;

function expandHomeToken(t: string): string | null {
  if (HOME === "") {
    return null;
  }
  if (t === "~") {
    return normalize(HOME);
  }
  return normalize(join(HOME, t.slice(2)));
}

// The single `=`-pair splitter. Bun.Cookie.parse splits a token at the
// FIRST `=` exactly as the guard needs; the `includes("=")` check
// short-circuits `=`-less tokens before any parse, so the catch only
// covers the parser's rejected `=`-bearing shapes (empty name or value).
// The value truncates at the first `;` — which MIRRORS curl's own
// `-F f=@file;type=…` field syntax, so `f=@.env;type=text/plain` correctly
// yields the `.env` upload candidate. Conscious cost: a literal
// filename like `--flag=.env;x` also denies (deny-leaning, rare).
interface NameValue {
  name: string;
  value: string;
}

function splitPair(token: string): NameValue | null {
  if (!token.includes("=")) {
    return null;
  }
  try {
    const c = Bun.Cookie.parse(token);
    return { name: c.name, value: c.value };
  } catch {
    return null;
  }
}

// The allowed zone is $HOME ∪ projectRoot: ordinary reads AND writes
// inside it pass; outside it both deny. The /dev/null family is exempt —
// `2>/dev/null` is daily bash plumbing.
const SAFE_DEVICES = new Set([
  "/dev/null",
  "/dev/stdin",
  "/dev/stdout",
  "/dev/stderr",
  "/dev/zero",
  "/dev/urandom",
  "/dev/random",
]);

const TMP_PREFIXES = [
  "/tmp/",
  "/private/tmp/",
  "/var/tmp/",
  "/private/var/tmp/",
];

// ONLY the two exact spellings anchor: `${HOME}` and boundary-checked
// `$HOME` ($HOMEevil is a DIFFERENT, unset variable — name boundary).
// Every other braced form (`${HOMEPATH}`, `${HOMEBREW_PREFIX}`,
// `${HOME:0:1}` which expands to "/") returns null and falls through to
// the raw-$ fail-closed deny — an open `${HOME` prefix strip is a zone
// escape.
export function homeVarToTilde(token: string): string | null {
  if (token.startsWith("${HOME}")) {
    return `~${token.slice(7)}`;
  }
  if (HOME_HEAD.test(token)) {
    return `~${token.slice(5)}`;
  }
  return null;
}

// Tilde-user spellings (~root, ~admin, ~- → $OLDPWD) resolve to OTHER
// users' homes at runtime — only ~ and ~/… belong to this user's zone.
export function tildeUser(token: string): boolean {
  return token.startsWith("~") && token !== "~" && !token.startsWith("~/");
}

// A path-shaped token still carrying a variable after home-anchoring
// cannot be classified lexically — fail closed (Bash channel only; the
// tool channel's file_path is literal, no expansion). GLUED expansions
// (~secret from ${HOME}secret / ${HOME^}secret) expand to a SIBLING of
// home at runtime, not a path under it — one rule covers both families.
export function unresolvedVar(token: string): boolean {
  const anchored = homeVarToTilde(token);
  if (anchored === null) {
    return token.includes("$");
  }
  return (
    anchored.includes("$") || (anchored !== "~" && !anchored.startsWith("~/"))
  );
}

// Path candidates hidden inside glued argument tokens. The `=@` shapes
// matter as much as the bare ones: `curl -d=@/etc/passwd` (flag-glued) and
// `curl -F f=@/etc/hosts` (NAME=@path in a non-flag token) both carry the
// path on the value side. Plain prose `foo=/etc` (no @) stays a value word
// and never decomposes — the spec pins prose mentions as allowed.
export function pathCandidates(arg: string): string[] {
  if (arg.startsWith("@")) {
    return [arg.slice(1)];
  }
  const pair = splitPair(arg);
  if (pair === null) {
    if (FLAG_HEAD.test(arg)) {
      return [];
    }
    return [arg];
  }
  const { name, value } = pair;
  if (FLAG_HEAD.test(name)) {
    let truncated = value;
    if (value.startsWith("@")) {
      truncated = value.slice(1);
    }
    // Deny-union: Cookie.parse truncates the value
    // at the first `;`, so the tail's evidence ($VAR, suffix matches, ..-
    // climbs) survives ONLY in the raw token — when the arg carries a `;`,
    // judge BOTH the truncated candidate and the full value side of arg;
    // the strictest hit wins downstream. (The `;` test runs on arg, not
    // the parsed value — the parsed value can never carry one.)
    if (!arg.includes(";")) {
      return [truncated];
    }
    const full = arg.slice(arg.indexOf("=") + 1);
    if (full.startsWith("@")) {
      return [truncated, full.slice(1)];
    }
    return [truncated, full];
  }
  if (value.startsWith("@")) {
    const truncated = value.slice(1); // NAME=@path upload shape
    if (!arg.includes(";")) {
      return [truncated];
    }
    return [truncated, arg.slice(arg.indexOf("=@") + 2)];
  }
  // Mid-token =@ (a=b=@/etc/passwd): the pair value does not START with @,
  // so the prose branch would swallow the tail — union it back; the prose
  // token itself stays a candidate too.
  const midAt = arg.indexOf("=@");
  if (midAt !== -1) {
    return [arg, arg.slice(midAt + 2)];
  }
  return [arg]; // prose pair (foo=/etc) — not a path carrier
}

export function inAllowedZone(
  absPath: string,
  context: PolicyContext,
): boolean {
  if (SAFE_DEVICES.has(absPath)) {
    return true;
  }
  if (HOME !== "" && (absPath === HOME || absPath.startsWith(`${HOME}/`))) {
    return true;
  }
  const root = normalize(context.projectRoot);
  return absPath === root || absPath.startsWith(`${root}/`);
}

export function isTmpPath(absPath: string): boolean {
  const p = absPath.toLowerCase(); // /TMP is /tmp on the case-insensitive root
  return p === "/tmp" || TMP_PREFIXES.some((pre) => p.startsWith(pre));
}

// Same teaching language as no-inline-scripts (which points script files at
// ./tmp/): scratch files belong at the project root's git-ignored tmp/.
export const TMP_HINT =
  " For scratch files, write to ./tmp/ at the project root — it is git-ignored there.";

// Resolve one shell token to an absolute path, or null when it is not
// path-shaped. ~ and $HOME expand; bare words resolve against cwd (they
// are file arguments of the command being inspected).
export function expandToken(
  token: string,
  context: PolicyContext,
): string | null {
  const t = homeVarToTilde(token) ?? token;
  if (t === "~" || t.startsWith("~/")) {
    return expandHomeToken(t);
  }
  if (isAbsolute(t)) {
    return normalize(t);
  }
  // Path-shaped or bare: both are file arguments of the inspected command
  // and resolve against its working directory.
  return normalize(join(context.cwd, t));
}

// Frozen at module load: home does not change mid-session.
export const HOME = homedir();

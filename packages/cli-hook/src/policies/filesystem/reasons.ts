import { isTmpPath, TMP_HINT } from "./resolve.ts";
import type { Tier } from "./tiers.ts";

export function boundaryReason(token: string, absPath: string): string {
  let reason = `Filesystem policy: "${token}" is outside the allowed zone ($HOME or the project) — reads and writes there are blocked.`;
  if (isTmpPath(absPath)) {
    reason += TMP_HINT;
  }
  return reason;
}

export const TIER_REASONS: Record<Tier, (token: string) => string> = {
  "git-config": (token) =>
    `Filesystem policy: writing "${token}" is blocked — git configuration changes belong to the user (git-readonly owns the CLI path too).`,
  "git-hooks": (token) =>
    `Filesystem policy: "${token}" lives under .git/hooks — reading, writing, or running hook files is blocked (hooks execute as the user, outside the guard).`,
  "macos-library": (token) =>
    `Filesystem policy: "${token}" is inside ~/Library (Keychains, Safari, Mail, app data) — blocked in all channels.`,
  "macos-personal": (token) =>
    `Filesystem policy: writing "${token}" (a macOS personal folder: Desktop, Documents, Downloads, Movies, Music, Pictures, Public) is blocked.`,
  personal: (token) =>
    `Filesystem policy: writing "${token}" (personal config) is blocked — persistence vector.`,
  secrets: (token) =>
    `Filesystem policy: "${token}" is a protected secrets path — reads and writes are blocked in all channels.`,
  settings: (token) =>
    `Filesystem policy: "${token}" is a protected Claude settings file — agents must not read or change the guard's own configuration.`,
};

export const askReason = (verb: string, token: string) =>
  `Filesystem policy: confirm with the user before ${verb} ("${token}"). This call needs explicit user approval.`;

export const pathRuleReason = (bin: string) =>
  `Filesystem policy: running binaries by absolute path ("${bin}") is blocked — commands are on PATH by name.`;

export const unresolvedVarReason = (token: string) =>
  `Filesystem policy: "${token}" contains a shell variable the guard cannot resolve.`;

export const tildeUserReason = (token: string) =>
  `Filesystem policy: "${token}" uses a tilde-user path — only ~ and ~/ are resolvable inside the guard.`;

export const SUDO_REASON =
  "Filesystem policy: sudo is blocked — privilege escalation is never an agent operation; every needed command runs under the user account.";

export const injectionReason = (pattern: string) =>
  `Filesystem policy: command contains a blocked obfuscation/injection pattern ("${pattern}").`;

export const networkReason = (name: string) =>
  `Network command blocked: "${name}" — fetching pages/docs goes through the web MCP tools; anything else, the user runs it and pastes the result.`;

import { isAbsolute } from "node:path";

import type { CommandUnit } from "../../core/ast.ts";
import { ask, deny } from "../../core/decision.ts";
import type {
  Policy,
  PolicyCheckResult,
  PolicyContext,
} from "../../core/policy.ts";
import { injectionHit } from "./guards.ts";
import { type Intent, intentOf, redirectTargets } from "./intents.ts";
import {
  ASK_REASON,
  boundaryReason,
  INJECTION_REASON,
  NETWORK_REASON,
  PATH_RULE_REASON,
  SUDO_REASON,
  TIER_REASONS,
  TILDE_USER_REASON,
  UNRESOLVED_VAR_REASON,
} from "./reasons.ts";
import {
  expandToken,
  HOME,
  inAllowedZone,
  pathCandidates,
  tildeUser,
  unresolvedVar,
} from "./resolve.ts";
import { type Tier, tierOf } from "./tiers.ts";

// Tiers that gate on intent: reads pass, writes/deletes deny. The remaining
// tiers (secrets, settings, git-hooks, macos-library) deny at ANY intent.
const WRITE_ONLY_TIERS = new Set<Tier>([
  "personal",
  "git-config",
  "macos-personal",
]);

// A glued short-flag path value (`tar -C/etc`, `tar -C=/etc`): tar's
// re-rooting directory rides the flag with no space, so pathCandidates sees
// a bare flag.
const GLUED_DIR_FLAG = /^-C.+/;
// The `=` separator a glued `-C=` value keeps after the flag slice.
const LEADING_EQUALS = /^=/;

// Scope rules above the zone boundary: the filesystem root denies for ANY
// intent (reads included), and the home directory as
// a whole denies writes and deletes. Whole-home READS ask instead, at the
// tail of candidateDecision.
function scopeDenyOrAsk(
  intent: Intent,
  abs: string,
  token: string,
): PolicyCheckResult {
  if (abs === "/") {
    return deny(
      `Filesystem policy: "${token}" targets the filesystem root — blocked.`,
    );
  }
  if (abs === HOME && (intent === "write" || intent === "delete")) {
    return deny(
      `Filesystem policy: "${token}" targets the home directory as a whole — ${intent} blocked.`,
    );
  }
  return null;
}

// One resolved path candidate of one argument, judged with the command's
// intent: a decision, or null. Unresolvable $-shapes and tilde-user
// spellings fail closed BEFORE classification — these
// name paths bash resolves outside every lexical class the guard has.
function candidateDecision(
  candidate: string,
  arg: string,
  intent: Intent | null,
  context: PolicyContext,
): PolicyCheckResult {
  if (unresolvedVar(candidate)) {
    return deny(UNRESOLVED_VAR_REASON(arg));
  }
  if (tildeUser(candidate)) {
    return deny(TILDE_USER_REASON(arg));
  }
  const abs = expandToken(candidate, context);
  if (abs === null) {
    return null;
  }
  const tier = tierOf(abs);
  if (tier !== null && !WRITE_ONLY_TIERS.has(tier)) {
    return deny(TIER_REASONS[tier](arg));
  }
  if (tier !== null && (intent === "write" || intent === "delete")) {
    return deny(TIER_REASONS[tier](arg));
  }
  if (intent !== null) {
    const scoped = scopeDenyOrAsk(intent, abs, arg);
    if (scoped !== null) {
      return scoped;
    }
  }
  if (!inAllowedZone(abs, context)) {
    return deny(boundaryReason(arg, abs));
  }
  if (intent === "read" && abs === HOME) {
    return ask(ASK_REASON("reading the home directory as a whole", arg));
  }
  return null;
}

// One argument's path candidates: the glued -C directory value, then the
// standard @/flag-value decomposition. Reasons quote the full original arg.
function argCandidates(arg: string): string[] {
  if (GLUED_DIR_FLAG.test(arg)) {
    // slice(2) keeps a glued `=` separator on the value (`-C=/etc` →
    // "=/etc") — strip it so the value resolves absolute, like
    // pathCandidates' flag=value form.
    return [arg.slice(2).replace(LEADING_EQUALS, "")];
  }
  return pathCandidates(arg);
}

// One argument of one unwrapped command unit: a decision, or null. URLs are
// not path candidates.
function argDecision(
  rest: string[],
  i: number,
  intent: Intent | null,
  context: PolicyContext,
): PolicyCheckResult {
  const arg = rest[i] ?? "";
  if (arg.includes("://")) {
    return null;
  }
  return severityUnion(
    argCandidates(arg).map((candidate) =>
      candidateDecision(candidate, arg, intent, context),
    ),
  );
}

// Severity union over judged decisions: deny wins wherever it appears; a
// first ask must not shadow a later deny on the same command line — under
// bypassPermissions an ask auto-allows, so the shadow is a silent bypass.
function severityUnion(hits: PolicyCheckResult[]): PolicyCheckResult {
  let askHit: PolicyCheckResult = null;
  for (const hit of hits) {
    const out = hit?.hookSpecificOutput;
    if (
      out?.hookEventName === "PreToolUse" &&
      out.permissionDecision === "deny"
    ) {
      return hit;
    }
    if (askHit === null) {
      askHit = hit;
    }
  }
  return askHit;
}

// One command unit: the fail-closed name gates (unresolvable $-shapes,
// tilde-user spellings), then the PATH rule and the sudo and network blanket
// rules, then the intent-aware walk over the unwrapped argument list.
function unitDecision(
  unit: CommandUnit,
  context: PolicyContext,
): PolicyCheckResult {
  if (unresolvedVar(unit.name)) {
    return deny(UNRESOLVED_VAR_REASON(unit.name));
  }
  if (tildeUser(unit.name)) {
    return deny(TILDE_USER_REASON(unit.name));
  }
  if (isAbsolute(unit.name)) {
    return deny(PATH_RULE_REASON(unit.name));
  }
  const { intent, rest, sudo, network } = intentOf(unit.name, unit.args);
  if (sudo) {
    return deny(SUDO_REASON);
  }
  if (network !== null) {
    return deny(NETWORK_REASON(network));
  }
  return severityUnion(
    rest.map((_, i) => argDecision(rest, i, intent, context)),
  );
}

// Tool-channel entry: file_path is a literal path — no $-decomposition,
// no unresolved gate.
export function checkFilePath(
  filePath: string,
  intent: "read" | "write",
  context: PolicyContext,
): PolicyCheckResult {
  const abs = expandToken(filePath, context);
  if (abs === null) {
    return null;
  }
  const tier = tierOf(abs);
  if (tier === null) {
    if (inAllowedZone(abs, context)) {
      return null;
    }
    return deny(boundaryReason(filePath, abs));
  }
  if (WRITE_ONLY_TIERS.has(tier)) {
    if (intent === "write") {
      return deny(TIER_REASONS[tier](filePath));
    }
    // The write-only tier says nothing about reads — the zone boundary
    // still gates them.
    if (!inAllowedZone(abs, context)) {
      return deny(boundaryReason(filePath, abs));
    }
    return null;
  }
  return deny(TIER_REASONS[tier](filePath));
}

export const filesystemPolicy: Policy = {
  check(cmd, context) {
    const injection = injectionHit(cmd.raw);
    if (injection !== null) {
      return deny(INJECTION_REASON(injection));
    }
    const unitHits = cmd.units.map((unit) => unitDecision(unit, context));
    const redirectHits = redirectTargets(cmd).map((r) =>
      candidateDecision(r.token, r.token, r.intent, context),
    );
    return severityUnion([...unitHits, ...redirectHits]);
  },
  name: "filesystem",
};

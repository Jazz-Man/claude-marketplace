import { isAbsolute } from "node:path";

import type { CommandUnit } from "../../core/ast.ts";
import { ask, deny } from "../../core/decision.ts";
import type {
  Policy,
  PolicyCheckResult,
  PolicyContext,
} from "../../core/policy.ts";
import { injectionHit } from "./guards.ts";
import * as intents from "./intents.ts";
import {
  askReason,
  boundaryReason,
  injectionReason,
  networkReason,
  pathRuleReason,
  SUDO_REASON,
  TIER_REASONS,
  tildeUserReason,
  unresolvedVarReason,
} from "./reasons.ts";
import {
  expandToken,
  HOME,
  inAllowedZone,
  pathCandidates,
  tildeUser,
  unresolvedVar,
} from "./resolve.ts";
import * as tiers from "./tiers.ts";

// Tiers that gate on intent: reads pass, writes/deletes deny. The remaining
// tiers (secrets, settings, git-hooks, macos-library) deny at ANY intent.
const WRITE_ONLY_TIERS = new Set<tiers.Tier>([
  "personal",
  "git-config",
  "macos-personal",
]);

// A glued short-flag path value (`tar -C/etc`, `tar -C=/etc`): tar's
// re-rooting directory rides the flag with no space, so pathCandidates sees
// a bare flag.
const GLUED_DIR_FLAG = /^-C.+/u;
// The `=` separator a glued `-C=` value keeps after the flag slice.
const LEADING_EQUALS = /^=/u;

// Scope rules above the zone boundary: the filesystem root denies for ANY
// intent (reads included), and the home directory as
// a whole denies writes and deletes. Whole-home READS ask instead, at the
// tail of candidateDecision.
function scopeDenyOrAsk(
  intent: intents.Intent,
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

interface CandidateInput {
  arg: string;
  candidate: string;
  context: PolicyContext;
  intent: intents.Intent | null;
}

// $-shape and tilde-user gates: fail closed BEFORE classification — these
// name paths bash resolves outside every lexical class the guard has.
function unresolvedGate(candidate: string, arg: string): PolicyCheckResult {
  if (unresolvedVar(candidate)) {
    return deny(unresolvedVarReason(arg));
  }
  if (tildeUser(candidate)) {
    return deny(tildeUserReason(arg));
  }
  return null;
}

// Tier gates: a non-write-only tier denies at any intent; a write-only tier
// denies writes and deletes (null tier = unclassified, no opinion).
function tierGate(
  tier: tiers.Tier | null,
  arg: string,
  intent: intents.Intent | null,
): PolicyCheckResult {
  if (tier === null) {
    return null;
  }
  if (!WRITE_ONLY_TIERS.has(tier)) {
    return deny(TIER_REASONS[tier](arg));
  }
  if (intent === "write" || intent === "delete") {
    return deny(TIER_REASONS[tier](arg));
  }
  return null;
}

// Zone and scope tail of one resolved candidate: scope rules above the
// boundary, then the zone boundary, then the whole-home read ask.
function scopedDecision(input: CandidateInput, abs: string): PolicyCheckResult {
  const { arg, context, intent } = input;
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
    return ask(askReason("reading the home directory as a whole", arg));
  }
  return null;
}

// One resolved path candidate of one argument, judged with the command's
// intent: a decision, or null.
function classifiedDecision(input: CandidateInput): PolicyCheckResult {
  const { arg, candidate, context, intent } = input;
  const abs = expandToken(candidate, context);
  if (abs === null) {
    return null;
  }
  return tierGate(tiers.tierOf(abs), arg, intent) ?? scopedDecision(input, abs);
}

// One resolved path candidate of one argument, judged with the command's
// intent: a decision, or null. Unresolvable $-shapes and tilde-user
// spellings fail closed BEFORE classification.
function candidateDecision(input: CandidateInput): PolicyCheckResult {
  return (
    unresolvedGate(input.candidate, input.arg) ?? classifiedDecision(input)
  );
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
  arg: string,
  intent: intents.Intent | null,
  context: PolicyContext,
): PolicyCheckResult {
  if (arg.includes("://")) {
    return null;
  }
  return severityUnion(
    argCandidates(arg).map((candidate) =>
      candidateDecision({ arg, candidate, context, intent }),
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
    askHit ??= hit;
  }
  return askHit;
}

// The fail-closed name gates one command unit passes before any intent walk:
// unresolvable $-shapes, tilde-user spellings, absolute-path invocations.
function nameGate(name: string): PolicyCheckResult {
  if (unresolvedVar(name)) {
    return deny(unresolvedVarReason(name));
  }
  if (tildeUser(name)) {
    return deny(tildeUserReason(name));
  }
  if (isAbsolute(name)) {
    return deny(pathRuleReason(name));
  }
  return null;
}

// One command unit: the fail-closed name gates (unresolvable $-shapes,
// tilde-user spellings), then the PATH rule and the sudo and network blanket
// rules, then the intent-aware walk over the unwrapped argument list.
function unitDecision(
  unit: CommandUnit,
  context: PolicyContext,
): PolicyCheckResult {
  const gate = nameGate(unit.name);
  if (gate !== null) {
    return gate;
  }
  const { intent, network, rest, sudo } = intents.intentOf(
    unit.name,
    unit.args,
  );
  if (sudo) {
    return deny(SUDO_REASON);
  }
  if (network !== null) {
    return deny(networkReason(network));
  }
  return severityUnion(rest.map((arg) => argDecision(arg, intent, context)));
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
  const tier = tiers.tierOf(abs);
  if (tier === null || (WRITE_ONLY_TIERS.has(tier) && intent === "read")) {
    // An unclassified path gates on the zone alone; under a write-only tier
    // the tier says nothing about reads — the zone boundary still gates them.
    if (inAllowedZone(abs, context)) {
      return null;
    }
    return deny(boundaryReason(filePath, abs));
  }
  return deny(TIER_REASONS[tier](filePath));
}

export const filesystemPolicy: Policy = {
  check(cmd, context) {
    const injection = injectionHit(cmd.raw);
    if (injection !== null) {
      return deny(injectionReason(injection));
    }
    const unitHits = cmd.units.map((unit) => unitDecision(unit, context));
    const redirectHits = intents.redirectTargets(cmd).map((redirect) =>
      candidateDecision({
        arg: redirect.token,
        candidate: redirect.token,
        context,
        intent: redirect.intent,
      }),
    );
    return severityUnion([...unitHits, ...redirectHits]);
  },
  name: "filesystem",
};

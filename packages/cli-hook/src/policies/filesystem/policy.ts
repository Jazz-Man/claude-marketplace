import { isAbsolute } from "node:path";

import type { CommandUnit } from "../../core/ast.ts";
import { ask, deny, permissionOf } from "../../core/decision.ts";
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

export const WRITE_ONLY_TIERS = new Set<tiers.Tier>([
  "personal",
  "git-config",
  "macos-personal",
]);

export const GLUED_DIR_FLAG = /^-C.+/u;
export const LEADING_EQUALS = /^=/u;

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

function tokenGate(token: string, arg: string): PolicyCheckResult {
  if (unresolvedVar(token)) {
    return deny(unresolvedVarReason(arg));
  }
  if (tildeUser(token)) {
    return deny(tildeUserReason(arg));
  }
  return null;
}

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

function classifiedDecision(input: CandidateInput): PolicyCheckResult {
  const { arg, candidate, context, intent } = input;
  const abs = expandToken(candidate, context);
  if (abs === null) {
    return null;
  }
  return tierGate(tiers.tierOf(abs), arg, intent) ?? scopedDecision(input, abs);
}

function candidateDecision(input: CandidateInput): PolicyCheckResult {
  return tokenGate(input.candidate, input.arg) ?? classifiedDecision(input);
}

function argCandidates(arg: string): string[] {
  if (GLUED_DIR_FLAG.test(arg)) {
    return [arg.slice(2).replace(LEADING_EQUALS, "")];
  }
  return pathCandidates(arg);
}

function argDecision(
  arg: string,
  intent: intents.Intent | null,
  context: PolicyContext,
): PolicyCheckResult {
  if (arg.includes("://")) {
    return null;
  }
  let askHit: PolicyCheckResult = null;
  for (const candidate of argCandidates(arg)) {
    const hit = candidateDecision({
      arg,
      candidate,
      context,
      intent,
    });
    if (permissionOf(hit) === "deny") {
      return hit;
    }
    askHit ??= hit;
  }
  return askHit;
}

function nameGate(name: string): PolicyCheckResult {
  const tokenHit = tokenGate(name, name);
  if (tokenHit !== null) {
    return tokenHit;
  }
  if (isAbsolute(name)) {
    return deny(pathRuleReason(name));
  }
  return null;
}

function unitDecision(
  unit: CommandUnit,
  context: PolicyContext,
): PolicyCheckResult {
  const gate = nameGate(unit.name);
  if (gate !== null) {
    return gate;
  }
  const { intent, network, rest } = intents.intentOf(unit.name, unit.args);
  if (network !== null) {
    return deny(networkReason(network));
  }
  let askHit: PolicyCheckResult = null;
  for (const arg of rest) {
    const hit = argDecision(arg, intent, context);
    if (permissionOf(hit) === "deny") {
      return hit;
    }
    askHit ??= hit;
  }
  return askHit;
}

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
    let askHit: PolicyCheckResult = null;
    for (const unit of cmd.units) {
      const hit = unitDecision(unit, context);
      if (permissionOf(hit) === "deny") {
        return hit;
      }
      askHit ??= hit;
    }
    for (const redirect of cmd.redirects) {
      const hit = candidateDecision({
        arg: redirect.target,
        candidate: redirect.target,
        context,
        intent: redirect.operator === "<" ? "read" : "write",
      });
      if (permissionOf(hit) === "deny") {
        return hit;
      }
      askHit ??= hit;
    }
    return askHit;
  },
  name: "filesystem",
};

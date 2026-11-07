/** biome-ignore-all lint/style/noExcessiveLinesPerFile: every arm lives in one file so all arms share the corpus and stay mutually comparable */
/** biome-ignore-all lint/complexity/noExcessiveLinesPerFunction: each arm is one deliberately monolithic measured sweep; splitting it would distort the measurement */
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: the truncated-flow mirror carries its stage gating inline by design */

import { isAbsolute, join, normalize } from "node:path";
import process from "node:process";
import { parseEnv } from "node:util";
import { bench, do_not_optimize, group, run } from "mitata";
import { baseName, type ParsedCommand, parseCommand } from "../src/core/ast.ts";
import { ask, deny, permissionOf } from "../src/core/decision.ts";
import type { PolicyCheckResult, PolicyContext } from "../src/core/policy.ts";
import { SHARED_WRAPPERS } from "../src/core/wrappers.ts";
import {
  INJECTION_SUBSTRINGS,
  injectionHit,
  WORD_SPLIT,
} from "../src/policies/filesystem/guards.ts";
import * as intents from "../src/policies/filesystem/intents.ts";
import {
  filesystemPolicy,
  GLUED_DIR_FLAG,
  LEADING_EQUALS,
  WRITE_ONLY_TIERS,
} from "../src/policies/filesystem/policy.ts";
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
} from "../src/policies/filesystem/reasons.ts";
import {
  expandToken,
  HOME,
  homeVarToTilde,
  inAllowedZone,
  pathCandidates,
  SAFE_DEVICES,
  tildeUser,
  unresolvedVar,
} from "../src/policies/filesystem/resolve.ts";
import * as tiers from "../src/policies/filesystem/tiers.ts";
import {
  ALLOW as FS_ALLOW,
  ASK as FS_ASK,
  DENY as FS_DENY,
} from "../tests/fixtures/filesystem.ts";
import {
  ALLOW as ND_ALLOW,
  DENY as ND_DENY,
} from "../tests/fixtures/no-deps.ts";
import { commands } from "./corpus.ts";

// Corpus: identical to bench/equiv.ts — the 233-command arsenal (two
// placeholder lines substituted), every fixture table, plus the adversarial
// parse set. check() consumes the ParsedCommand, so all arms pre-parse once.
const ADVERSARIAL: string[] = [
  "env FOO=1 python -c 'print(1)'",
  "FOO=bar npm install",
  "export ARR=(1 2)",
  "env A[0]=x cmd arg",
  "diff <(ls) <(ls -a)",
  "echo a<(ls)b",
  "cat <<EOF > f\nhi\nEOF",
  "echo $(cat <<EOF\nhi\nEOF)",
  "for f in 1 2; do echo $f; done",
  "case x in a) echo;; esac",
  "while read l; do echo $l; done",
  "if true; then x; fi",
  "f() { echo hi; }",
  "a=1; b=2 cmd",
  "> f echo hi",
  "cmd <<< str",
  "echo hi >&2",
  "2>&1 cmd",
  "x=$(y)",
  "echo `date`",
  "echo $(date)",
  "time ls",
  "! ls",
  "seq 1 10 | head -1",
  "echo a{1,2}b",
  "make *",
  "echo [a-z]*.ts",
  "v=${x:-default}",
  "echo ${x}; echo ${#x}",
  "x=$((1 + 2))",
  "echo $((1 + 2))",
  "tee >(gzip > f.gz)",
  "exec 3< f",
  "echo 'single' \"double\" $'ansi'",
  "arr[1]=x cmd",
  "watch -n1 'ls -la'",
  "env -i HOME=/tmp sh -c 'echo hi'",
];

const corpus: string[] = [
  ...commands,
  ...FS_ALLOW,
  ...FS_ASK,
  ...FS_DENY,
  ...ND_ALLOW,
  ...ND_DENY,
  ...ADVERSARIAL,
];

const ctx: PolicyContext = { cwd: "/proj", projectRoot: "/proj" };

const parsed: ParsedCommand[] = [];
for (const command of corpus) {
  const cmd = parseCommand(command);
  if (cmd !== null) {
    parsed.push(cmd);
  }
}

// Superset input streams harvested from the corpus for the stage micro arms.
// Rest-args are only knowable after intentOf, so these walk ALL args — a
// superset of what a single in-flow check visits, weighted by real usage.
interface UnitPair {
  args: string[];
  name: string;
}

const unitPairs: UnitPair[] = [];
const candidatesAll: string[] = [];
const eqTokens: string[] = [];
for (const cmd of parsed) {
  for (const unit of cmd.units) {
    unitPairs.push(unit);
    for (const arg of unit.args) {
      if (arg.includes("=")) {
        eqTokens.push(arg);
      }
      candidatesAll.push(...pathCandidates(arg));
    }
  }
  for (const redirect of cmd.redirects) {
    candidatesAll.push(redirect.target);
  }
}

const absAll: string[] = [];
for (const candidate of candidatesAll) {
  const abs = expandToken(candidate, ctx);
  if (abs !== null) {
    absAll.push(abs);
  }
}

// ---------------------------------------------------------------------------
// Verbatim local mirrors of the production decision pipeline (policy.ts
// helpers). Kept as copies so the stage-truncation and old-flow mirrors can
// gate them; equivalence against filesystemPolicy.check is asserted below.
// Tables the mirrors consume verbatim (WRITE_ONLY_TIERS, GLUED_DIR_FLAG,
// LEADING_EQUALS) are imported from the product modules directly.
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

// Stage numbers for the truncated-flow mirror. cutoff N = run production's
// flow through stage N inclusive; deeper stages contribute no work, earlier
// short-circuits (deny) fire exactly as production would.
const INJECTION = 0;
const NAME = 1;
const INTENT = 2;
const CANDIDATES = 3;
const EXPAND = 4;
const TIER = 5;
const TAIL = 6;

interface Unwrapped {
  intent: intents.Intent | null;
  network: string | null;
  rest: string[];
  sudo: boolean;
}

const NEUTRAL: Unwrapped = {
  intent: null,
  network: null,
  rest: [],
  sudo: false,
};

function candidateAt(input: CandidateInput, cutoff: number): PolicyCheckResult {
  const { arg, candidate, context, intent } = input;
  if (cutoff < CANDIDATES) {
    return null;
  }
  const tokenHit = tokenGate(candidate, arg);
  if (tokenHit !== null) {
    return tokenHit;
  }
  if (cutoff < EXPAND) {
    return null;
  }
  const abs = expandToken(candidate, context);
  if (abs === null) {
    return null;
  }
  if (cutoff < TIER) {
    return null;
  }
  const tierHit = tierGate(tiers.tierOf(abs), arg, intent);
  if (tierHit !== null) {
    return tierHit;
  }
  if (cutoff < TAIL) {
    return null;
  }
  return scopedDecision(input, abs);
}

function mirrorCheck(
  cmd: ParsedCommand,
  context: PolicyContext,
  cutoff: number,
): PolicyCheckResult {
  const injection = cutoff >= INJECTION ? injectionHit(cmd.raw) : null;
  if (injection !== null) {
    return deny(injectionReason(injection));
  }
  let askHit: PolicyCheckResult = null;
  for (const unit of cmd.units) {
    const gate = cutoff >= NAME ? nameGate(unit.name) : null;
    if (gate !== null) {
      return gate;
    }
    const { intent, network, rest, sudo } =
      cutoff >= INTENT ? intents.intentOf(unit.name, unit.args) : NEUTRAL;
    if (sudo) {
      return deny(SUDO_REASON);
    }
    if (network !== null) {
      return deny(networkReason(network));
    }
    if (cutoff >= CANDIDATES) {
      for (const arg of rest) {
        if (!arg.includes("://")) {
          let argAsk: PolicyCheckResult = null;
          for (const candidate of argCandidates(arg)) {
            const hit = candidateAt(
              { arg, candidate, context, intent },
              cutoff,
            );
            if (permissionOf(hit) === "deny") {
              return hit;
            }
            argAsk ??= hit;
          }
          askHit ??= argAsk;
        }
      }
    }
  }
  if (cutoff >= CANDIDATES) {
    for (const redirect of cmd.redirects) {
      const hit = candidateAt(
        {
          arg: redirect.target,
          candidate: redirect.target,
          context,
          intent: redirect.operator === "<" ? "read" : "write",
        },
        cutoff,
      );
      if (permissionOf(hit) === "deny") {
        return hit;
      }
      askHit ??= hit;
    }
  }
  return askHit;
}

// ---------------------------------------------------------------------------
// Old-flow mirror: units.map + derived redirectTargets + .map + spread +
// severityUnion. Uses the PRODUCTION guards/intentOf inside so this A/B
// isolates the flow change alone (guards and intentOf have their own pairs).
function severityUnion(hits: PolicyCheckResult[]): PolicyCheckResult {
  let askHit: PolicyCheckResult = null;
  for (const hit of hits) {
    if (permissionOf(hit) === "deny") {
      return hit;
    }
    askHit ??= hit;
  }
  return askHit;
}

function argDecisionOld(
  arg: string,
  intent: intents.Intent | null,
  context: PolicyContext,
): PolicyCheckResult {
  if (arg.includes("://")) {
    return null;
  }
  return severityUnion(
    argCandidates(arg).map((candidate) =>
      candidateDecision({
        arg,
        candidate,
        context,
        intent,
      }),
    ),
  );
}

function unitDecisionOld(
  unit: { args: string[]; name: string },
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
  return severityUnion(rest.map((arg) => argDecisionOld(arg, intent, context)));
}

function checkOld(
  cmd: ParsedCommand,
  context: PolicyContext,
): PolicyCheckResult {
  const injection = injectionHit(cmd.raw);
  if (injection !== null) {
    return deny(injectionReason(injection));
  }
  const unitHits = cmd.units.map((unit) => unitDecisionOld(unit, context));
  const redirectHits: PolicyCheckResult[] = [];
  for (const redirect of cmd.redirects) {
    redirectHits.push(
      candidateDecision({
        arg: redirect.target,
        candidate: redirect.target,
        context,
        intent: redirect.operator === "<" ? "read" : "write",
      }),
    );
  }
  return severityUnion([...unitHits, ...redirectHits]);
}

// ---------------------------------------------------------------------------
// All-old composite: the full pre-optimization pipeline — old guards scan,
// old intentOf, old uncached expandToken, old per-call zone test, old
// map+spread flow. The headline A/B for the whole landed optimization pass.
function scopedDecisionAllOld(
  input: CandidateInput,
  abs: string,
): PolicyCheckResult {
  const { arg, context, intent } = input;
  if (intent !== null) {
    const scoped = scopeDenyOrAsk(intent, abs, arg);
    if (scoped !== null) {
      return scoped;
    }
  }
  if (!inAllowedZoneOld(abs, context)) {
    return deny(boundaryReason(arg, abs));
  }
  if (intent === "read" && abs === HOME) {
    return ask(askReason("reading the home directory as a whole", arg));
  }
  return null;
}

function classifiedDecisionAllOld(input: CandidateInput): PolicyCheckResult {
  const { arg, candidate, context, intent } = input;
  const abs = expandTokenOld(candidate, context);
  if (abs === null) {
    return null;
  }
  return (
    tierGate(tiers.tierOf(abs), arg, intent) ?? scopedDecisionAllOld(input, abs)
  );
}

function candidateDecisionAllOld(input: CandidateInput): PolicyCheckResult {
  return (
    tokenGate(input.candidate, input.arg) ?? classifiedDecisionAllOld(input)
  );
}

function argDecisionAllOld(
  arg: string,
  intent: intents.Intent | null,
  context: PolicyContext,
): PolicyCheckResult {
  if (arg.includes("://")) {
    return null;
  }
  return severityUnion(
    argCandidates(arg).map((candidate) =>
      candidateDecisionAllOld({
        arg,
        candidate,
        context,
        intent,
      }),
    ),
  );
}

function unitDecisionAllOld(
  unit: { args: string[]; name: string },
  context: PolicyContext,
): PolicyCheckResult {
  const gate = nameGate(unit.name);
  if (gate !== null) {
    return gate;
  }
  const { intent, network, rest, sudo } = intentOfOld(unit.name, unit.args);
  if (sudo) {
    return deny(SUDO_REASON);
  }
  if (network !== null) {
    return deny(networkReason(network));
  }
  return severityUnion(
    rest.map((arg) => argDecisionAllOld(arg, intent, context)),
  );
}

function checkAllOld(
  cmd: ParsedCommand,
  context: PolicyContext,
): PolicyCheckResult {
  const injection = injectionHitOld(cmd.raw);
  if (injection !== null) {
    return deny(injectionReason(injection));
  }
  const unitHits = cmd.units.map((unit) => unitDecisionAllOld(unit, context));
  const redirectHits: PolicyCheckResult[] = [];
  for (const redirect of cmd.redirects) {
    redirectHits.push(
      candidateDecisionAllOld({
        arg: redirect.target,
        candidate: redirect.target,
        context,
        intent: redirect.operator === "<" ? "read" : "write",
      }),
    );
  }
  return severityUnion([...unitHits, ...redirectHits]);
}

// ---------------------------------------------------------------------------
// Old guards mirror: two separate passes over raw — for..of codePointAt
// control scan, then for..of per-char regex + includes whitespace scan.
// ASCII_WHITESPACE/ANY_WHITESPACE existed only in the old guards; the shared
// needle table comes from the product module.
const ASCII_WHITESPACE = " \t\n\r";
const ANY_WHITESPACE = /\s/u;

const isControlByte = (code: number) =>
  (code >= 1 && code <= 8) || (code >= 14 && code <= 31) || code === 127;

function substringHitOld(raw: string) {
  for (const needle of INJECTION_SUBSTRINGS) {
    if (raw.includes(needle)) {
      return needle;
    }
  }
  if (raw.includes("\0")) {
    return "null byte";
  }
  return null;
}

function controlHitOld(raw: string) {
  for (const char of raw) {
    if (isControlByte(char.codePointAt(0) ?? 0)) {
      return "control characters";
    }
  }
  return null;
}

function whitespaceHitOld(raw: string) {
  for (const char of raw) {
    if (ANY_WHITESPACE.test(char) && !ASCII_WHITESPACE.includes(char)) {
      return "non-ASCII whitespace";
    }
  }
  return null;
}

function pathOverrideHitOld(raw: string) {
  for (const word of raw.split(WORD_SPLIT)) {
    if (word.startsWith("PATH=") && !word.includes("$PATH")) {
      return "PATH override";
    }
  }
  return null;
}

const injectionHitOld = (raw: string) =>
  substringHitOld(raw) ??
  controlHitOld(raw) ??
  pathOverrideHitOld(raw) ??
  whitespaceHitOld(raw);

// ---------------------------------------------------------------------------
// Old resolve mirrors: uncached home expansion and per-call normalize +
// template-concat zone test.
function inHomeOld(absPath: string): boolean {
  return HOME !== "" && (absPath === HOME || absPath.startsWith(`${HOME}/`));
}

function inAllowedZoneOld(absPath: string, context: PolicyContext): boolean {
  if (SAFE_DEVICES.has(absPath)) {
    return true;
  }
  if (inHomeOld(absPath)) {
    return true;
  }
  const root = normalize(context.projectRoot);
  return absPath === root || absPath.startsWith(`${root}/`);
}

function expandHomeTokenOld(token: string): string | null {
  if (HOME === "") {
    return null;
  }
  if (token === "~") {
    return normalize(HOME);
  }
  return normalize(join(HOME, token.slice(2)));
}

function expandTokenOld(token: string, context: PolicyContext): string | null {
  const anchored = homeVarToTilde(token) ?? token;
  if (anchored === "~" || anchored.startsWith("~/")) {
    return expandHomeTokenOld(anchored);
  }
  if (isAbsolute(anchored)) {
    return normalize(anchored);
  }
  return normalize(join(context.cwd, anchored));
}

// ---------------------------------------------------------------------------
// Old intents mirror: ungated isAssignment (parseEnv on every non-flag
// token) and double baseName in resolveToken. The name tables are imported
// from the product module so they cannot drift.
function isAssignmentOld(token: string): boolean {
  return Object.keys(parseEnv(token)).length > 0;
}

const isScanNoiseOld = (token: string) =>
  token.startsWith("-") || isAssignmentOld(token);

function resolveTokenOld(
  token: string,
  network: string | null,
): {
  intent: intents.Intent | null;
  network: string | null;
} {
  const known = intents.INTENTS.get(baseName(token));
  if (known !== undefined) {
    return {
      intent: known,
      network,
    };
  }
  // Deliberate double baseName call — the old code computed it per branch.
  if (network === null && intents.NETWORK_TOOLS.has(baseName(token))) {
    return {
      intent: null,
      network: baseName(token),
    };
  }
  return {
    intent: null,
    network,
  };
}

function unwrapScanOld(
  args: string[],
  sudoIn: boolean,
  networkIn: string | null,
): Unwrapped {
  let sudo = sudoIn;
  let network = networkIn;
  for (const [index, token] of args.entries()) {
    sudo ||= token === "sudo";
    if (token !== "sudo" && !isScanNoiseOld(token)) {
      const resolved = resolveTokenOld(token, network);
      if (resolved.intent !== null) {
        const rest = args.slice(index + 1);
        return {
          intent: adjustForFlagsOld(baseName(token), resolved.intent, rest),
          network: resolved.network,
          rest,
          sudo,
        };
      }
      ({ network } = resolved);
    }
  }
  return {
    intent: null,
    network,
    rest: args,
    sudo,
  };
}

function adjustForFlagsOld(
  base: string,
  intent: intents.Intent | null,
  args: readonly string[],
): intents.Intent | null {
  if (base === "find" && args.includes("-delete")) {
    return "delete";
  }
  if (
    (base === "sed" || base === "perl") &&
    args.some((arg) => intents.IN_PLACE_CLUSTER.test(arg))
  ) {
    return "write";
  }
  return intent;
}

function intentOfOld(name: string, args: string[]): Unwrapped {
  const base = baseName(name);
  const intent: intents.Intent | null = intents.INTENTS.get(base) ?? null;
  let network: string | null = null;
  if (intents.NETWORK_TOOLS.has(base)) {
    network = base;
  }
  const sudo = name === "sudo";
  if (!SHARED_WRAPPERS.has(name) && name !== "sudo") {
    return {
      intent: adjustForFlagsOld(base, intent, args),
      network,
      rest: args,
      sudo,
    };
  }
  return unwrapScanOld(args, sudo, network);
}

// ---------------------------------------------------------------------------
// Exploratory mirrors for the next optimization round. Each is equivalence-
// checked against its production counterpart over the corpus in the
// self-check below before it is benchmarked. The control/whitespace classes
// below ARE the experiment \u2014 a native regex scan for exactly the bytes the
// JS charCode loop tests.
// biome-ignore lint/suspicious/noControlCharactersInRegex: deliberate \u2014 matches control bytes natively, mirroring isControlByte
const CONTROL_RE = /[\x01-\x08\x0e-\x1f\x7f]/u;
const WEIRD_WS_RE =
  // biome-ignore lint/suspicious/noControlCharactersInRegex: deliberate \u2014 the non-ASCII whitespace set, same bytes isNonAsciiWhitespace tests
  /[\x0b\x0c\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/u;

function isNonAsciiWhitespaceCopy(code: number): boolean {
  return (
    code === 11 ||
    code === 12 ||
    code === 0xa0 ||
    code === 0x16_80 ||
    (code >= 0x20_00 && code <= 0x20_0a) ||
    code === 0x20_28 ||
    code === 0x20_29 ||
    code === 0x20_2f ||
    code === 0x20_5f ||
    code === 0x30_00 ||
    code === 0xfe_ff
  );
}

function scanRawMirror(raw: string): { control: boolean; weirdWs: boolean } {
  let weirdWs = false;
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    if (isControlByte(code)) {
      return { control: true, weirdWs };
    }
    if (!weirdWs && isNonAsciiWhitespaceCopy(code)) {
      weirdWs = true;
    }
  }
  return { control: false, weirdWs };
}

// E1: skip the split-based PATH scan when the raw has no PATH= at all.
function pathOverrideHitGated(raw: string): string | null {
  if (!raw.includes("PATH=")) {
    return null;
  }
  for (const word of raw.split(WORD_SPLIT)) {
    if (word.startsWith("PATH=") && !word.includes("$PATH")) {
      return "PATH override";
    }
  }
  return null;
}

const injectionHitGated = (raw: string): string | null => {
  const hit = substringHitOld(raw);
  if (hit !== null) {
    return hit;
  }
  const scan = scanRawMirror(raw);
  if (scan.control) {
    return "control characters";
  }
  const override = pathOverrideHitGated(raw);
  if (override !== null) {
    return override;
  }
  return scan.weirdWs ? "non-ASCII whitespace" : null;
};

// E2: replace the JS charCode loop with two native regex tests. Precedence is
// preserved: control (wherever it occurs) outranks weird whitespace.
const injectionHitRegex = (raw: string): string | null => {
  const hit = substringHitOld(raw);
  if (hit !== null) {
    return hit;
  }
  if (CONTROL_RE.test(raw)) {
    return "control characters";
  }
  const override = pathOverrideHitOld(raw);
  if (override !== null) {
    return override;
  }
  return WEIRD_WS_RE.test(raw) ? "non-ASCII whitespace" : null;
};

// ---------------------------------------------------------------------------
// Manual split-pair parser, built from probed Bun.Cookie.parse semantics:
// token must be HTTP-header-value shaped (no leading/trailing SP/HTAB, no
// CR/LF anywhere); only the first ;-delimited segment parses; name/value
// split at the segment's first "="; [ \t\f] trimmed from both parts; empty
// name rejects; name chars must be printable ASCII (0x21-0x7e).
interface NameValue {
  name: string;
  value: string;
}

const trimOws = (s: string) => s.replace(/^[ \t\f]+|[ \t\f]+$/gu, "");

function splitPairManual(token: string): NameValue | null {
  if (!token.includes("=")) {
    return null;
  }
  const first = token.charCodeAt(0);
  const last = token.charCodeAt(token.length - 1);
  if (first === 32 || first === 9 || last === 32 || last === 9) {
    return null;
  }
  if (token.includes("\n") || token.includes("\r")) {
    return null;
  }
  const semi = token.indexOf(";");
  const segment = semi === -1 ? token : token.slice(0, semi);
  const eq = segment.indexOf("=");
  if (eq <= 0) {
    return null;
  }
  const name = trimOws(segment.slice(0, eq));
  if (name === "") {
    return null;
  }
  for (let i = 0; i < name.length; i += 1) {
    const code = name.charCodeAt(i);
    if (code <= 32 || code >= 127) {
      return null;
    }
  }
  return { name, value: trimOws(segment.slice(eq + 1)) };
}

// splitPair verbatim copy of production (resolve.ts) for the differential.
function splitPairBun(token: string): NameValue | null {
  if (!token.includes("=")) {
    return null;
  }
  try {
    const cookie = Bun.Cookie.parse(token);
    return {
      name: cookie.name,
      value: cookie.value,
    };
  } catch {
    return null;
  }
}

// pathCandidates with the manual splitter swapped in; the candidate-shaping
// helpers are verbatim copies of resolve.ts.
function proseCandidatesM(arg: string): string[] {
  if (arg.startsWith("-")) {
    return [];
  }
  return [arg];
}

function unionFullValueM(arg: string, truncated: string): string[] {
  const full = arg.slice(arg.indexOf("=") + 1);
  if (full.startsWith("@")) {
    return [truncated, full.slice(1)];
  }
  return [truncated, full];
}

function flagPairCandidatesM(arg: string, value: string): string[] {
  let truncated = value;
  if (value.startsWith("@")) {
    truncated = value.slice(1);
  }
  if (!arg.includes(";")) {
    return [truncated];
  }
  return unionFullValueM(arg, truncated);
}

function midAtCandidatesM(arg: string): string[] {
  const midAt = arg.indexOf("=@");
  if (midAt !== -1) {
    return [arg, arg.slice(midAt + 2)];
  }
  return [arg];
}

function valuePairCandidatesM(arg: string, value: string): string[] {
  if (!value.startsWith("@")) {
    return midAtCandidatesM(arg);
  }
  const truncated = value.slice(1);
  if (!arg.includes(";")) {
    return [truncated];
  }
  return [truncated, arg.slice(arg.indexOf("=@") + 2)];
}

function pairCandidatesM(arg: string, pair: NameValue): string[] {
  const { name, value } = pair;
  if (name.startsWith("-")) {
    return flagPairCandidatesM(arg, value);
  }
  return valuePairCandidatesM(arg, value);
}

function pathCandidatesManual(arg: string): string[] {
  if (arg.startsWith("@")) {
    return [arg.slice(1)];
  }
  const pair = splitPairManual(arg);
  if (pair === null) {
    return proseCandidatesM(arg);
  }
  return pairCandidatesM(arg, pair);
}

// ---------------------------------------------------------------------------
// Self-check: the stage mirror at full depth, the old-flow mirror, and the
// all-old composite must be JSON-identical to the production policy, and the
// exploratory mirrors identical to their production counterparts, over the
// whole corpus — anything else aborts before benchmarking.
let mirrorMismatches = 0;
for (const cmd of parsed) {
  const want = filesystemPolicy.check(cmd, ctx);
  const wantJson = JSON.stringify(want);
  if (JSON.stringify(mirrorCheck(cmd, ctx, TAIL)) !== wantJson) {
    mirrorMismatches += 1;
    console.log(`MIRROR MISMATCH: ${cmd.raw}`);
  }
  if (JSON.stringify(checkOld(cmd, ctx)) !== wantJson) {
    mirrorMismatches += 1;
    console.log(`OLD-FLOW MISMATCH: ${cmd.raw}`);
  }
  if (JSON.stringify(checkAllOld(cmd, ctx)) !== wantJson) {
    mirrorMismatches += 1;
    console.log(`ALL-OLD MISMATCH: ${cmd.raw}`);
  }
}
for (const command of corpus) {
  const want = injectionHit(command);
  if (injectionHitGated(command) !== want) {
    mirrorMismatches += 1;
    console.log(`E1 MISMATCH: ${command}`);
  }
  if (injectionHitRegex(command) !== want) {
    mirrorMismatches += 1;
    console.log(`E2 MISMATCH: ${command}`);
  }
}
if (mirrorMismatches > 0) {
  console.log(`SELF-CHECK FAILED: ${mirrorMismatches} mismatches — aborting`);
  process.exit(1);
}
console.log(
  `self-check: stage mirror + old-flow + all-old composites identical to filesystemPolicy.check; E1-E2 mirrors identical to production; over ${parsed.length} commands`,
);
console.log(
  `corpus: ${corpus.length} commands (${parsed.length} parsed), ${unitPairs.length} units, ${eqTokens.length} "=" args, ${candidatesAll.length} candidates, ${absAll.length} abs paths`,
);

// ---------------------------------------------------------------------------
// Differential: Bun.Cookie.parse vs manual split over (1) every corpus "="
// arg and (2) an adversarial set. Divergence is reported at BOTH levels —
// {name,value} and the pathCandidates the policy actually consumes.
const ADVERSARIAL_PAIRS: string[] = [
  "a=b",
  "a==b",
  "=v",
  "v=",
  "-=x",
  "--flag=v",
  "-C=./sub",
  "a= b",
  "a =b",
  "a=\tb",
  "a=b\t",
  "a=b ",
  "a=b;c=d",
  "a=b; c=d",
  "a=b;",
  "a;=b",
  "a;b=c",
  ";a=b",
  "a=b;;",
  "x=@f",
  "a=@f;x",
  "out=@/tmp/f",
  "-o=@build/x;echo x",
  "PATH=/usr/bin:/bin",
  "PATH=$PATH",
  "HISTSIZE=0",
  "LD_PRELOAD=/tmp/x.so",
  "FOO=bar baz",
  'a="b c"',
  '"q"=v',
  'a=b"c',
  "ü=ö",
  "a=ü",
  "a= b",
  "a=　b",
  "x=y ",
  "x=y　",
  "a=\u0001c",
  "a\u0001b=c",
  "a=\u000bb",
  "a=\fb",
  "a=b\f",
  "a=b\nc",
  "a=b\rc",
  " x=y",
  "x=y ",
  "\tx=y",
  "1=2",
  "a.b=c.d",
  "a-b=c_d",
  "a$b=c",
  "[]=x",
  "a[0]=x",
  "a= b",
  "a= b",
  "a= b",
  "a= b",
  "a=﻿b",
];

const eqUnique = [...new Set(eqTokens)];
const pairOf = (nv: NameValue | null) =>
  nv === null
    ? "null"
    : `${JSON.stringify(nv.name)}/${JSON.stringify(nv.value)}`;

let corpusDivergences = 0;
let adversarialDivergences = 0;
let candidateDivergences = 0;

const runDifferential = (tokens: string[], label: string): void => {
  console.log(`\ncookie differential — ${label} (${tokens.length} tokens):`);
  for (const token of tokens) {
    const bun = splitPairBun(token);
    const manual = splitPairManual(token);
    if (pairOf(bun) !== pairOf(manual)) {
      if (label === "corpus") {
        corpusDivergences += 1;
      } else {
        adversarialDivergences += 1;
      }
      const candBun = pathCandidates(token);
      const candManual = pathCandidatesManual(token);
      const candidatesDiffer =
        JSON.stringify(candBun) !== JSON.stringify(candManual);
      if (candidatesDiffer) {
        candidateDivergences += 1;
      }
      console.log(
        `  ${JSON.stringify(token)} bun=${pairOf(bun)} manual=${pairOf(manual)}` +
          (candidatesDiffer
            ? ` CANDIDATES differ: ${JSON.stringify(candBun)} vs ${JSON.stringify(candManual)}`
            : " candidates identical"),
      );
    }
  }
};

runDifferential(eqUnique, "corpus");
runDifferential(ADVERSARIAL_PAIRS, "adversarial");
console.log(
  `cookie differential verdict: ${corpusDivergences} corpus divergences, ${adversarialDivergences} adversarial divergences, ${candidateDivergences} with policy-visible candidate impact`,
);

// ---------------------------------------------------------------------------
// Arms.
function checkPreparsedAll(): void {
  for (const cmd of parsed) {
    do_not_optimize(filesystemPolicy.check(cmd, ctx));
  }
}

function fullCycleAll(): void {
  for (const command of corpus) {
    const cmd = parseCommand(command);
    if (cmd !== null) {
      do_not_optimize(filesystemPolicy.check(cmd, ctx));
    }
  }
}

function stageAll(cutoff: number): () => void {
  return () => {
    for (const cmd of parsed) {
      do_not_optimize(mirrorCheck(cmd, ctx, cutoff));
    }
  };
}

function flowOldAll(): void {
  for (const cmd of parsed) {
    do_not_optimize(checkOld(cmd, ctx));
  }
}

function flowAllOldAll(): void {
  for (const cmd of parsed) {
    do_not_optimize(checkAllOld(cmd, ctx));
  }
}

function injectionGatedAll(): void {
  for (const command of corpus) {
    do_not_optimize(injectionHitGated(command));
  }
}

function injectionRegexAll(): void {
  for (const command of corpus) {
    do_not_optimize(injectionHitRegex(command));
  }
}

function injectionOldAll(): void {
  for (const command of corpus) {
    do_not_optimize(injectionHitOld(command));
  }
}

function injectionNewAll(): void {
  for (const command of corpus) {
    do_not_optimize(injectionHit(command));
  }
}

function zoneOldAll(): void {
  for (const abs of absAll) {
    do_not_optimize(inAllowedZoneOld(abs, ctx));
  }
}

function zoneNewWarmAll(): void {
  for (const abs of absAll) {
    do_not_optimize(inAllowedZone(abs, ctx));
  }
}

function zoneNewColdAll(): void {
  for (const abs of absAll) {
    do_not_optimize(inAllowedZone(abs, { cwd: "/proj", projectRoot: "/proj" }));
  }
}

function expandOldAll(): void {
  for (const candidate of candidatesAll) {
    do_not_optimize(expandTokenOld(candidate, ctx));
  }
}

function expandNewAll(): void {
  for (const candidate of candidatesAll) {
    do_not_optimize(expandToken(candidate, ctx));
  }
}

function intentOldAll(): void {
  for (const unit of unitPairs) {
    do_not_optimize(intentOfOld(unit.name, unit.args));
  }
}

function intentNewAll(): void {
  for (const unit of unitPairs) {
    do_not_optimize(intents.intentOf(unit.name, unit.args));
  }
}

function splitBunAll(): void {
  for (const token of eqTokens) {
    do_not_optimize(splitPairBun(token));
  }
}

function splitManualAll(): void {
  for (const token of eqTokens) {
    do_not_optimize(splitPairManual(token));
  }
}

function candidatesProdAll(): void {
  for (const token of eqTokens) {
    do_not_optimize(pathCandidates(token));
  }
}

function candidatesManualAll(): void {
  for (const token of eqTokens) {
    do_not_optimize(pathCandidatesManual(token));
  }
}

group(`A end-to-end: ${parsed.length} commands`, () => {
  bench("A1 check only (pre-parsed)", checkPreparsedAll).gc("inner");
  bench("A2 full cycle parse+check", fullCycleAll).gc("inner");
});

group(
  `B stage attribution (cumulative mirror): ${parsed.length} commands`,
  () => {
    bench("B0 injectionHit (raw scan)", stageAll(INJECTION)).gc("inner");
    bench("B1 + unit nameGate", stageAll(NAME)).gc("inner");
    bench("B2 + intentOf/unwrapScan", stageAll(INTENT)).gc("inner");
    bench("B3 + candidate resolution", stageAll(CANDIDATES)).gc("inner");
    bench("B4 + expandToken", stageAll(EXPAND)).gc("inner");
    bench("B5 + tierOf/tierGate", stageAll(TIER)).gc("inner");
    bench("B6 + scoped decision tail", stageAll(TAIL)).gc("inner");
    bench("B* production check (mirror sanity)", checkPreparsedAll).gc("inner");
  },
);

group("C optimization A/B (same run)", () => {
  bench("C0 everything old (composite pipeline)", flowAllOldAll).gc("inner");
  bench("C1a guards old: 2-pass for..of+regex+includes", injectionOldAll).gc(
    "inner",
  );
  bench("C1b guards new: fused charCode scan", injectionNewAll).gc("inner");
  bench("C2a zone old: normalize+template-concat per call", zoneOldAll).gc(
    "inner",
  );
  bench("C2b zone new: WeakMap warm ctx", zoneNewWarmAll).gc("inner");
  bench("C2c zone new: WeakMap cold ctx", zoneNewColdAll).gc("inner");
  bench("C3a expandToken old: uncached home expand", expandOldAll).gc("inner");
  bench("C3b expandToken new: memoized", expandNewAll).gc("inner");
  bench("C4a flow old: map+spread+severityUnion", flowOldAll).gc("inner");
  bench("C4b flow new: production early-deny loops", checkPreparsedAll).gc(
    "inner",
  );
  bench(
    "C5a intentOf old: ungated parseEnv + double baseName",
    intentOldAll,
  ).gc("inner");
  bench("C5b intentOf new: gated + single baseName", intentNewAll).gc("inner");
});

group(`D splitPair: ${eqTokens.length} "=" args`, () => {
  bench("D1 splitPair Bun.Cookie.parse (product)", splitBunAll).gc("inner");
  bench("D2 splitPair manual split (alt semantics)", splitManualAll).gc(
    "inner",
  );
  bench("D3 pathCandidates product pair", candidatesProdAll).gc("inner");
  bench("D4 pathCandidates manual pair", candidatesManualAll).gc("inner");
});

group("E exploratory (next-round candidates, same run)", () => {
  bench("E1 injectionHit: PATH= pre-gate", injectionGatedAll).gc("inner");
  bench("E2 injectionHit: native regex control/ws", injectionRegexAll).gc(
    "inner",
  );
});

const { benchmarks } = await run({ format: "markdown" });

const measured = benchmarks
  .flatMap((trial) => trial.runs)
  .flatMap((entry) =>
    entry.stats === undefined ? [] : [{ name: entry.name, stats: entry.stats }],
  );
measured.sort((a, b) => b.stats.avg - a.stats.avg);
console.log("\nslowest benches (µs/iter avg, whole corpus per iter):");
for (const { name, stats } of measured) {
  console.log(`  ${(stats.avg / 1000).toFixed(2).padStart(9)} µs  ${name}`);
}

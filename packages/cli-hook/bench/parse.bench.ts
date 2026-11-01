/** biome-ignore-all lint/style/noExcessiveLinesPerFile: every variant arm lives in one file so all arms share the harness and stay mutually comparable */
/** biome-ignore-all lint/complexity/noExcessiveLinesPerFunction: each arm is one deliberately monolithic measured walk; splitting it would distort the measurement */
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: the fused single-pass walks carry their case analysis inline by design */
import { bench, do_not_optimize, group, run } from "mitata";
import {
  type Command,
  forEachChild,
  type HereDocDelimiter,
  type ParsedScript,
  parse,
  type Redirection,
  type SyntaxNode,
  type Word,
} from "unbash";
import { parseCommand } from "../src/core/ast.ts";
import commandList from "../src/mutable-commands.txt";

const EXEMPLARS: Record<string, string> = {
  "deno run <url>": "deno run https://example.com/x.ts",
  "go run <pkg>@<version>": "go run example.com/pkg@latest",
};

const commands = commandList
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line !== "")
  .map((line) => EXEMPLARS[line] ?? line);

interface WordLike {
  text: string;
  value: string;
}

function wordLike(node: object): node is WordLike {
  return (
    "text" in node &&
    typeof node.text === "string" &&
    "value" in node &&
    typeof node.value === "string"
  );
}

const WHOLE_WORD_SUBST =
  /^(?:\$\([\s\S]*\)|`[\s\S]*`|<\([\s\S]*\)|>\([\s\S]*\))$/u;

interface CommandRedirect {
  operator: string;
  target: string;
}

interface CommandUnit {
  args: string[];
  name: string;
}

interface Parsed {
  functionDefs: string[];
  redirects: CommandRedirect[];
  units: CommandUnit[];
  words: string[];
}

function redirectWord(
  redirect: Redirection,
): Word | HereDocDelimiter | undefined {
  if (redirect.type === "HereDoc") {
    return redirect.delimiter;
  }
  return redirect.target;
}

function collectRedirects(command: Command, out: CommandRedirect[]): void {
  for (const redirect of command.redirects) {
    const word = redirectWord(redirect);
    if (word !== undefined && wordLike(word)) {
      out.push({
        operator: redirect.operator,
        target: word.value,
      });
    }
  }
}

function parseOrNull(command: string): ParsedScript | null {
  try {
    return parse(command);
  } catch {
    return null;
  }
}

function wordValuesCurrent(node: unknown): string[] {
  if (node === null || typeof node !== "object") {
    return [];
  }
  if (wordLike(node)) {
    if (WHOLE_WORD_SUBST.test(node.value)) {
      return [];
    }
    return [node.value];
  }
  if ("type" in node && node.type === "Redirect") {
    return [];
  }
  return Object.values(node).flatMap((value) => wordValuesCurrent(value));
}

function wordValuesOut(node: unknown, out: string[]): void {
  if (node === null || typeof node !== "object") {
    return;
  }
  if (wordLike(node)) {
    if (!WHOLE_WORD_SUBST.test(node.value)) {
      out.push(node.value);
    }
    return;
  }
  if ("type" in node && node.type === "Redirect") {
    return;
  }
  for (const value of Object.values(node)) {
    wordValuesOut(value, out);
  }
}

function* wordValuesGen(node: unknown): Generator<string> {
  if (node === null || typeof node !== "object") {
    return;
  }
  if (wordLike(node)) {
    if (!WHOLE_WORD_SUBST.test(node.value)) {
      yield node.value;
    }
    return;
  }
  if ("type" in node && node.type === "Redirect") {
    return;
  }
  for (const value of Object.values(node)) {
    yield* wordValuesGen(value);
  }
}

// unbash hides Assignment/ArrayValue/HereDocBody children behind prototype
// getters, so Object.values-based wordValues collects nothing from them; a
// forEachChild walk must prune those types (plus Redirect) to stay equivalent.
function isPruned(type: unknown): boolean {
  return (
    type === "Redirect" ||
    type === "Assignment" ||
    type === "ArrayValue" ||
    type === "HereDocBody"
  );
}

function wordValuesFCC(node: unknown, out: string[]): void {
  if (node === null || typeof node !== "object") {
    return;
  }
  if (wordLike(node)) {
    if (!WHOLE_WORD_SUBST.test(node.value)) {
      out.push(node.value);
    }
    return;
  }
  if ("type" in node && isPruned(node.type)) {
    return;
  }
  if (Array.isArray(node)) {
    for (const element of node) {
      wordValuesFCC(element, out);
    }
    return;
  }
  forEachChild(node as SyntaxNode, (child) => wordValuesFCC(child, out));
}

// V1: one generator per suffix, explicit pending-node stack, zero yield*.
function* suffixArgsGen(suffix: readonly unknown[]): Generator<string> {
  const stack: unknown[] = [];
  for (let i = suffix.length - 1; i >= 0; i--) {
    stack.push(suffix[i]);
  }
  while (stack.length > 0) {
    const node: unknown = stack.pop();
    if (node === null || typeof node !== "object") {
      continue;
    }
    if (wordLike(node)) {
      if (!WHOLE_WORD_SUBST.test(node.value)) {
        yield node.value;
      }
      continue;
    }
    const type = (node as { type?: unknown }).type;
    if (isPruned(type)) {
      continue;
    }
    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i--) {
        stack.push(node[i]);
      }
      continue;
    }
    const children: unknown[] = [];
    forEachChild(node as SyntaxNode, (child) => {
      children.push(child);
    });
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push(children[i]);
    }
  }
}

// WHOLE_WORD_SUBST can only match when the first char is $, `, <, or > — a
// charCode gate skips the regex for ordinary words.
function isSubst(value: string): boolean {
  const c = value.charCodeAt(0);
  return (
    (c === 36 || c === 96 || c === 60 || c === 62) &&
    WHOLE_WORD_SUBST.test(value)
  );
}

function parseCommandFused(command: string, substGate: boolean): Parsed {
  const parsed = parseOrNull(command);
  if (parsed === null) {
    return { functionDefs: [], redirects: [], units: [], words: [] };
  }
  const units: CommandUnit[] = [];
  const words: string[] = [];
  const redirects: CommandRedirect[] = [];
  const functionDefs: string[] = [];
  const argStack: (string[] | null)[] = [];
  const keep = substGate
    ? (value: string) => !isSubst(value)
    : (value: string) => !WHOLE_WORD_SUBST.test(value);
  const visit = (node: SyntaxNode): void => {
    const args = argStack.length === 0 ? null : argStack[argStack.length - 1];
    if (wordLike(node)) {
      words.push(node.value);
      if (args !== null && keep(node.value)) {
        args.push(node.value);
      }
      if (args === null) {
        forEachChild(node, visit);
      } else {
        argStack.push(null);
        forEachChild(node, visit);
        argStack.pop();
      }
      return;
    }
    const type = node.type;
    if (type === "Command") {
      const { name } = node;
      if (name === undefined) {
        collectRedirects(node, redirects);
        forEachChild(node, visit);
      } else {
        const unit: CommandUnit = { args: [], name: name.value };
        units.push(unit);
        collectRedirects(node, redirects);
        argStack.push(null);
        for (const child of node.prefix) {
          visit(child);
        }
        argStack.pop();
        visit(name);
        argStack.push(unit.args);
        for (const child of node.suffix) {
          visit(child);
        }
        argStack.pop();
      }
      return;
    }
    if (args !== null && isPruned(type)) {
      argStack.push(null);
      forEachChild(node, visit);
      argStack.pop();
      return;
    }
    if (type === "Function") {
      functionDefs.push(node.name.value);
    }
    forEachChild(node, visit);
  };
  visit(parsed as SyntaxNode);
  return { functionDefs, redirects, units, words };
}

// Best-combo candidates beyond V4. Levels:
//  - gate: charCode-gated WHOLE_WORD_SUBST
//  - read-once: node.value read once per wordLike node (not twice via getter)
//  - inline redirects: collect from prefix/suffix directly instead of the
//    derived command.redirects getter (skips one intermediate array per Command)
//  - type wordLike: closed-set type check instead of the structural probe
const TYPE_WORD_LIKE = new Set([
  "Word",
  "Literal",
  "Glob",
  "SingleQuoted",
  "AnsiCQuoted",
  "HereDocDelimiter",
]);

function pushRedirect(redirect: Redirection, out: CommandRedirect[]): void {
  const word = redirectWord(redirect);
  if (word !== undefined && wordLike(word)) {
    out.push({
      operator: redirect.operator,
      target: word.value,
    });
  }
}

function collectRedirectsInline(
  command: Command,
  out: CommandRedirect[],
): void {
  for (const item of command.prefix) {
    if (item.type !== "Assignment") {
      pushRedirect(item, out);
    }
  }
  for (const item of command.suffix) {
    if (item.type !== "Word" && item.type !== "Assignment") {
      pushRedirect(item, out);
    }
  }
}

interface ComboFlags {
  gate: boolean;
  inlineRedirects: boolean;
  lazyKeep: boolean;
  readOnce: boolean;
  typeWordLike: boolean;
}

function parseCommandCombo(
  command: string,
  { gate, readOnce, inlineRedirects, typeWordLike, lazyKeep }: ComboFlags,
): Parsed {
  const parsed = parseOrNull(command);
  if (parsed === null) {
    return { functionDefs: [], redirects: [], units: [], words: [] };
  }
  const units: CommandUnit[] = [];
  const words: string[] = [];
  const redirects: CommandRedirect[] = [];
  const functionDefs: string[] = [];
  const argStack: (string[] | null)[] = [];
  const collect = inlineRedirects ? collectRedirectsInline : collectRedirects;
  const visit = (node: SyntaxNode): void => {
    const args = argStack.length === 0 ? null : argStack[argStack.length - 1];
    const type = node.type;
    const isWord = typeWordLike
      ? TYPE_WORD_LIKE.has(type)
      : wordLike(node as object);
    if (isWord) {
      if (lazyKeep) {
        // read value once, evaluate the filter only inside a collector zone
        if (args === null) {
          words.push((node as unknown as WordLike).value);
        } else {
          const value = (node as unknown as WordLike).value;
          words.push(value);
          const keep = gate ? !isSubst(value) : !WHOLE_WORD_SUBST.test(value);
          if (keep) {
            args.push(value);
          }
        }
      } else {
        const value = (node as unknown as WordLike).value;
        words.push(value);
        const keep = gate ? !isSubst(value) : !WHOLE_WORD_SUBST.test(value);
        if (args !== null && keep) {
          if (readOnce) {
            args.push(value);
          } else {
            args.push((node as unknown as WordLike).value);
          }
        }
      }
      if (args === null) {
        forEachChild(node, visit);
      } else {
        argStack.push(null);
        forEachChild(node, visit);
        argStack.pop();
      }
      return;
    }
    if (type === "Command") {
      const { name } = node;
      if (name === undefined) {
        collect(node, redirects);
        forEachChild(node, visit);
      } else {
        const unit: CommandUnit = { args: [], name: name.value };
        units.push(unit);
        collect(node, redirects);
        argStack.push(null);
        for (const child of node.prefix) {
          visit(child);
        }
        argStack.pop();
        visit(name);
        argStack.push(unit.args);
        for (const child of node.suffix) {
          visit(child);
        }
        argStack.pop();
      }
      return;
    }
    if (args !== null && isPruned(type)) {
      argStack.push(null);
      forEachChild(node, visit);
      argStack.pop();
      return;
    }
    if (type === "Function") {
      functionDefs.push(node.name.value);
    }
    forEachChild(node, visit);
  };
  visit(parsed as SyntaxNode);
  return { functionDefs, redirects, units, words };
}

function parseCommandFusedReadOnce(command: string): Parsed {
  const parsed = parseOrNull(command);
  if (parsed === null) {
    return { functionDefs: [], redirects: [], units: [], words: [] };
  }
  const units: CommandUnit[] = [];
  const words: string[] = [];
  const redirects: CommandRedirect[] = [];
  const functionDefs: string[] = [];
  const argStack: (string[] | null)[] = [];
  const visit = (node: SyntaxNode): void => {
    const args = argStack.length === 0 ? null : argStack[argStack.length - 1];
    if (wordLike(node)) {
      if (args === null) {
        words.push(node.value);
      } else {
        const value = node.value;
        words.push(value);
        if (!isSubst(value)) {
          args.push(value);
        }
      }
      if (args === null) {
        forEachChild(node, visit);
      } else {
        argStack.push(null);
        forEachChild(node, visit);
        argStack.pop();
      }
      return;
    }
    const type = node.type;
    if (type === "Command") {
      const { name } = node;
      if (name === undefined) {
        collectRedirects(node, redirects);
        forEachChild(node, visit);
      } else {
        const unit: CommandUnit = { args: [], name: name.value };
        units.push(unit);
        collectRedirects(node, redirects);
        argStack.push(null);
        for (const child of node.prefix) {
          visit(child);
        }
        argStack.pop();
        visit(name);
        argStack.push(unit.args);
        for (const child of node.suffix) {
          visit(child);
        }
        argStack.pop();
      }
      return;
    }
    if (args !== null && isPruned(type)) {
      argStack.push(null);
      forEachChild(node, visit);
      argStack.pop();
      return;
    }
    if (type === "Function") {
      functionDefs.push(node.name.value);
    }
    forEachChild(node, visit);
  };
  visit(parsed as SyntaxNode);
  return { functionDefs, redirects, units, words };
}

function fccOutGatedAll(): void {
  for (const command of commands) {
    const parsed = parseOrNull(command);
    if (parsed !== null) {
      do_not_optimize(
        walkVariant(parsed, (node) => {
          const args: string[] = [];
          for (const element of node.suffix) {
            wordValuesFCCGated(element, args);
          }
          return args;
        }),
      );
    }
  }
}

function wordValuesFCCGated(node: unknown, out: string[]): void {
  if (node === null || typeof node !== "object") {
    return;
  }
  if (wordLike(node)) {
    const value = node.value;
    if (!isSubst(value)) {
      out.push(value);
    }
    return;
  }
  if ("type" in node && isPruned(node.type)) {
    return;
  }
  if (Array.isArray(node)) {
    for (const element of node) {
      wordValuesFCCGated(element, out);
    }
    return;
  }
  forEachChild(node as SyntaxNode, (child) => wordValuesFCCGated(child, out));
}

function walkVariant(
  parsed: ParsedScript,
  collectArgs: (command: Command) => string[],
): Parsed {
  const units: CommandUnit[] = [];
  const words: string[] = [];
  const redirects: CommandRedirect[] = [];
  const functionDefs: string[] = [];
  const visit = (node: SyntaxNode): void => {
    if (wordLike(node)) {
      words.push(node.value);
    }
    if (node.type === "Command") {
      const { name } = node;
      if (name !== undefined) {
        units.push({
          args: collectArgs(node),
          name: name.value,
        });
      }
      collectRedirects(node, redirects);
    }
    if (node.type === "Function") {
      functionDefs.push(node.name.value);
    }
    forEachChild(node, visit);
  };
  visit(parsed);
  return { functionDefs, redirects, units, words };
}

function unbashOnly(): void {
  for (const command of commands) {
    do_not_optimize(parseOrNull(command));
  }
}

function currentAll(): void {
  for (const command of commands) {
    do_not_optimize(parseCommand(command));
  }
}

function flatMapAll(): void {
  for (const command of commands) {
    const parsed = parseOrNull(command);
    if (parsed !== null) {
      do_not_optimize(
        walkVariant(parsed, (node) => wordValuesCurrent(node.suffix)),
      );
    }
  }
}

function outAccumulatorAll(): void {
  for (const command of commands) {
    const parsed = parseOrNull(command);
    if (parsed !== null) {
      do_not_optimize(
        walkVariant(parsed, (node) => {
          const args: string[] = [];
          wordValuesOut(node.suffix, args);
          return args;
        }),
      );
    }
  }
}

function generatorAll(): void {
  for (const command of commands) {
    const parsed = parseOrNull(command);
    if (parsed !== null) {
      do_not_optimize(
        walkVariant(parsed, (node) => [...wordValuesGen(node.suffix)]),
      );
    }
  }
}

function visitOnlyAll(): void {
  for (const command of commands) {
    const parsed = parseOrNull(command);
    if (parsed !== null) {
      do_not_optimize(walkVariant(parsed, () => []));
    }
  }
}

function genStackAll(): void {
  for (const command of commands) {
    const parsed = parseOrNull(command);
    if (parsed !== null) {
      do_not_optimize(
        walkVariant(parsed, (node) => [...suffixArgsGen(node.suffix)]),
      );
    }
  }
}

function fccOutAll(): void {
  for (const command of commands) {
    const parsed = parseOrNull(command);
    if (parsed !== null) {
      do_not_optimize(
        walkVariant(parsed, (node) => {
          const args: string[] = [];
          wordValuesFCC(node.suffix, args);
          return args;
        }),
      );
    }
  }
}

function fusionAll(): void {
  for (const command of commands) {
    do_not_optimize(parseCommandFused(command, false));
  }
}

function fusionGateAll(): void {
  for (const command of commands) {
    do_not_optimize(parseCommandFused(command, true));
  }
}

function fusionReadOnceAll(): void {
  for (const command of commands) {
    do_not_optimize(parseCommandFusedReadOnce(command));
  }
}

function comboAll(flags: ComboFlags): () => void {
  return () => {
    for (const command of commands) {
      do_not_optimize(parseCommandCombo(command, flags));
    }
  };
}

group(`parseCommand internals: ${commands.length} commands`, () => {
  bench("unbash parse only", unbashOnly).gc("inner");
  bench("current parseCommand", currentAll).gc("inner");
  bench("walk: flatMap (current copy)", flatMapAll).gc("inner");
  bench("walk: out-accumulator", outAccumulatorAll).gc("inner");
  bench("walk: generator yield", generatorAll).gc("inner");
  bench("walk: visit only (no args)", visitOnlyAll).gc("inner");
});

group(`parseCommand variants: ${commands.length} commands`, () => {
  bench("V1 gen-stack args", genStackAll).gc("inner");
  bench("V2 fcc-out args", fccOutAll).gc("inner");
  bench("V3 fusion single-pass", fusionAll).gc("inner");
  bench("V4 fusion + subst gate", fusionGateAll).gc("inner");
  bench("V4b fused+gate+read1", fusionReadOnceAll).gc("inner");
  bench("V5 fcc-out + gate", fccOutGatedAll).gc("inner");
  bench(
    "V6 fusion+gate+read1",
    comboAll({
      gate: true,
      inlineRedirects: false,
      lazyKeep: false,
      readOnce: true,
      typeWordLike: false,
    }),
  ).gc("inner");
  bench(
    "V7 +inline redirects",
    comboAll({
      gate: true,
      inlineRedirects: true,
      lazyKeep: false,
      readOnce: true,
      typeWordLike: false,
    }),
  ).gc("inner");
  bench(
    "V8 +type wordLike",
    comboAll({
      gate: true,
      inlineRedirects: true,
      lazyKeep: false,
      readOnce: true,
      typeWordLike: true,
    }),
  ).gc("inner");
  bench(
    "V9 fusion+gate+lazy-read1",
    comboAll({
      gate: true,
      inlineRedirects: false,
      lazyKeep: true,
      readOnce: false,
      typeWordLike: false,
    }),
  ).gc("inner");
});

const { benchmarks } = await run({ format: "markdown" });

const measured = benchmarks
  .flatMap((trial) => trial.runs)
  .flatMap((entry) =>
    entry.stats === undefined ? [] : [{ name: entry.name, stats: entry.stats }],
  );
measured.sort((a, b) => b.stats.avg - a.stats.avg);
console.log("\nslowest benches (ns/iter avg, whole arsenal per iter):");
for (const { name, stats } of measured.slice(0, 6)) {
  console.log(`  ${stats.avg.toFixed(0).padStart(9)} ns  ${name}`);
}

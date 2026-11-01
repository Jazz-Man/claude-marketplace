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

group(`parseCommand internals: ${commands.length} commands`, () => {
  bench("unbash parse only", unbashOnly).gc("inner");
  bench("current parseCommand", currentAll).gc("inner");
  bench("walk: flatMap (current copy)", flatMapAll).gc("inner");
  bench("walk: out-accumulator", outAccumulatorAll).gc("inner");
  bench("walk: generator yield", generatorAll).gc("inner");
  bench("walk: visit only (no args)", visitOnlyAll).gc("inner");
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

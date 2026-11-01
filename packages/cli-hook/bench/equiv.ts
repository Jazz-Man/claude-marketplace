/** biome-ignore-all lint/style/noExcessiveLinesPerFile: one gate file mirrors every bench variant verbatim so the checked code is the measured code */
/** biome-ignore-all lint/complexity/noExcessiveLinesPerFunction: variant bodies are copies of the bench arms; splitting them would diverge from what is measured */
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: each variant walk is a single fused traversal by design */
// Equivalence gate: every bench variant must produce JSON-identical output to
// the production parseCommand over the 233-command arsenal, every fixture
// table, and an adversarial set exercising the lazy-getter pruning traps
// (Assignment/ArrayValue/HereDocBody hide children behind prototype getters,
// so Object.values-based wordValues collects nothing from them).
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
import {
  ALLOW as FS_ALLOW,
  ASK as FS_ASK,
  DENY as FS_DENY,
} from "../tests/fixtures/filesystem.ts";
import {
  ALLOW as GIT_ALLOW,
  DENY as GIT_DENY,
} from "../tests/fixtures/git-readonly.ts";
import {
  ALLOW as ND_ALLOW,
  DENY as ND_DENY,
} from "../tests/fixtures/no-deps.ts";
import {
  ALLOW as NIS_ALLOW,
  DENY as NIS_DENY,
  FUNCTIONS as NIS_FN,
} from "../tests/fixtures/no-inline-scripts.ts";
import { commands as arsenal } from "./corpus.ts";

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
  ...arsenal,
  ...FS_ALLOW,
  ...FS_ASK,
  ...FS_DENY,
  ...GIT_ALLOW,
  ...GIT_DENY,
  ...ND_ALLOW,
  ...ND_DENY,
  ...NIS_ALLOW,
  ...NIS_DENY,
  ...NIS_FN,
  ...ADVERSARIAL,
];

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

function isSubst(value: string): boolean {
  const c = value.charCodeAt(0);
  return (
    (c === 36 || c === 96 || c === 60 || c === 62) &&
    WHOLE_WORD_SUBST.test(value)
  );
}

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
  raw: string;
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

// Current production wordValues (Object.values + flatMap) for reference.
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

// Lazy-getter-hidden subtrees: Object.values sees none of these children, so a
// forEachChild walk must prune them to stay equivalent.
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
  if (
    "type" in node &&
    (node.type === "Redirect" ||
      node.type === "Assignment" ||
      node.type === "ArrayValue" ||
      node.type === "HereDocBody")
  ) {
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

// V1: one generator per suffix, explicit stack, zero yield*-delegation.
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
    const type = (node as { type?: string }).type;
    if (
      type === "Redirect" ||
      type === "Assignment" ||
      type === "ArrayValue" ||
      type === "HereDocBody"
    ) {
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

function walkVariant(
  parsed: ParsedScript,
  raw: string,
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
  return { functionDefs, raw, redirects, units, words };
}

// V3/V4: fused single-pass walk. args semantics mirror wordValues exactly:
// collect at wordLike nodes (subst-filtered), terminate beneath them, prune
// Redirect/Assignment/ArrayValue/HereDocBody subtrees, suffix only.
function parseCommandFused(command: string, substGate: boolean): Parsed | null {
  const parsed = parseOrNull(command);
  if (parsed === null) {
    return null;
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
    if (
      args !== null &&
      (type === "Redirect" ||
        type === "Assignment" ||
        type === "ArrayValue" ||
        type === "HereDocBody")
    ) {
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
  visit(parsed);
  return { functionDefs, raw: command, redirects, units, words };
}

type Variant = (command: string) => Parsed | null;

const TYPE_WORD_LIKE = new Set([
  "Word",
  "Literal",
  "Glob",
  "SingleQuoted",
  "AnsiCQuoted",
  "HereDocDelimiter",
]);

function wordValuesFCCGated(node: unknown, out: string[]): void {
  if (node === null || typeof node !== "object") {
    return;
  }
  if (wordLike(node)) {
    if (!isSubst(node.value)) {
      out.push(node.value);
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
  { gate, inlineRedirects, typeWordLike, lazyKeep }: ComboFlags,
): Parsed | null {
  const parsed = parseOrNull(command);
  if (parsed === null) {
    return null;
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
        if (args === null) {
          words.push((node as WordLike).value);
        } else {
          const value = (node as WordLike).value;
          words.push(value);
          const keep = gate ? !isSubst(value) : !WHOLE_WORD_SUBST.test(value);
          if (keep) {
            args.push(value);
          }
        }
      } else {
        const value = (node as WordLike).value;
        words.push(value);
        const keep = gate ? !isSubst(value) : !WHOLE_WORD_SUBST.test(value);
        if (args !== null && keep) {
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
    if (
      args !== null &&
      (type === "Redirect" ||
        type === "Assignment" ||
        type === "ArrayValue" ||
        type === "HereDocBody")
    ) {
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
  visit(parsed);
  return { functionDefs, raw: command, redirects, units, words };
}

const variants: Record<string, Variant> = {
  "reference current-copy": (command) => {
    const parsed = parseOrNull(command);
    return parsed === null
      ? null
      : walkVariant(parsed, command, (node) => wordValuesCurrent(node.suffix));
  },
  "V1 gen-stack": (command) => {
    const parsed = parseOrNull(command);
    return parsed === null
      ? null
      : walkVariant(parsed, command, (node) => [...suffixArgsGen(node.suffix)]);
  },
  "V2 fcc-out": (command) => {
    const parsed = parseOrNull(command);
    return parsed === null
      ? null
      : walkVariant(parsed, command, (node) => {
          const args: string[] = [];
          wordValuesFCC(node.suffix, args);
          return args;
        });
  },
  "V3 fusion": (command) => parseCommandFused(command, false),
  "V4 fusion+gate": (command) => parseCommandFused(command, true),
  "V5 fcc-out+gate": (command) => {
    const parsed = parseOrNull(command);
    return parsed === null
      ? null
      : walkVariant(parsed, command, (node) => {
          const args: string[] = [];
          for (const element of node.suffix) {
            wordValuesFCCGated(element, args);
          }
          return args;
        });
  },
  "V6 fusion+gate+read1": (command) =>
    parseCommandCombo(command, {
      gate: true,
      inlineRedirects: false,
      lazyKeep: false,
      readOnce: true,
      typeWordLike: false,
    }),
  "V7 +inline-redirects": (command) =>
    parseCommandCombo(command, {
      gate: true,
      inlineRedirects: true,
      lazyKeep: false,
      readOnce: true,
      typeWordLike: false,
    }),
  "V8 +type-wordLike": (command) =>
    parseCommandCombo(command, {
      gate: true,
      inlineRedirects: true,
      lazyKeep: false,
      readOnce: true,
      typeWordLike: true,
    }),
  "V9 fusion+gate+lazy-read1": (command) =>
    parseCommandCombo(command, {
      gate: true,
      inlineRedirects: false,
      lazyKeep: true,
      readOnce: false,
      typeWordLike: false,
    }),
};

let failures = 0;
const failed = new Set<string>();
for (const command of corpus) {
  const expected = parseCommand(command);
  for (const [name, variant] of Object.entries(variants)) {
    let actual: unknown;
    try {
      actual = variant(command);
    } catch (error) {
      console.log(`THROW ${name}: ${command} -> ${String(error)}`);
      failures += 1;
      failed.add(name);
      continue;
    }
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      failures += 1;
      failed.add(name);
      console.log(`MISMATCH ${name}`);
      console.log(`  cmd:   ${JSON.stringify(command)}`);
      console.log(`  want:  ${JSON.stringify(expected)}`);
      console.log(`  got:   ${JSON.stringify(actual)}`);
    }
  }
}

// Structural census: which node types pass wordLike in this corpus.
const wordLikeTypes = new Set<string>();
const suffixElementTypes = new Set<string>();
const prefixElementTypes = new Set<string>();
for (const command of corpus) {
  const parsed = parseOrNull(command);
  if (parsed === null) {
    continue;
  }
  const visit = (node: SyntaxNode): void => {
    if (wordLike(node as object)) {
      wordLikeTypes.add(node.type);
    }
    if (node.type === "Command") {
      for (const element of node.prefix) {
        prefixElementTypes.add(element.type);
      }
      for (const element of node.suffix) {
        suffixElementTypes.add(element.type);
      }
    }
    forEachChild(node, visit);
  };
  visit(parsed);
}
const byAlpha = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
console.log(`corpus: ${corpus.length} commands`);
console.log(
  `wordLike node types: ${[...wordLikeTypes].sort(byAlpha).join(", ")}`,
);
console.log(
  `suffix element types: ${[...suffixElementTypes].sort(byAlpha).join(", ")}`,
);
console.log(
  `prefix element types: ${[...prefixElementTypes].sort(byAlpha).join(", ")}`,
);
console.log(
  failures === 0
    ? "EQUIVALENCE: all variants match on full corpus"
    : `EQUIVALENCE: ${failures} mismatches in variants: ${[...failed].join(", ")}`,
);

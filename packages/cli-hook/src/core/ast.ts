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

const VERSION_SUFFIX = /\d+(?:\.\d+)*$/u;

const WHOLE_WORD_SUBST =
  /^(?:\$\([\s\S]*\)|`[\s\S]*`|<\([\s\S]*\)|>\([\s\S]*\))$/u;

function isPruned(type: unknown): boolean {
  return (
    type === "Redirect" ||
    type === "Assignment" ||
    type === "ArrayValue" ||
    type === "HereDocBody"
  );
}

function isSubst(value: string): boolean {
  const first = value.charCodeAt(0);
  return (
    (first === 36 || first === 96 || first === 60 || first === 62) &&
    WHOLE_WORD_SUBST.test(value)
  );
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

export interface CommandUnit {
  args: string[];
  name: string;
}

export interface CommandRedirect {
  operator: string;
  target: string;
}

export interface ParsedCommand {
  functionDefs: string[];
  raw: string;
  redirects: CommandRedirect[];
  units: CommandUnit[];
  words: string[];
}

interface WalkState {
  argStack: (string[] | null)[];
  functionDefs: string[];
  redirects: CommandRedirect[];
  units: CommandUnit[];
  words: string[];
}

function walkCommand(node: SyntaxNode, state: WalkState): void {
  const command = node as Command;
  const { name } = command;
  const { argStack, redirects, units } = state;
  if (name === undefined) {
    collectRedirects(command, redirects);
    forEachChild(node, (child) => visit(child, state));
    return;
  }
  const unit: CommandUnit = { args: [], name: name.value };
  units.push(unit);
  collectRedirects(command, redirects);
  argStack.push(null);
  for (const child of command.prefix) {
    visit(child, state);
  }
  argStack.pop();
  visit(name, state);
  argStack.push(unit.args);
  for (const child of command.suffix) {
    visit(child, state);
  }
  argStack.pop();
}

function visit(node: SyntaxNode, state: WalkState): void {
  const { argStack, functionDefs, words } = state;
  const args = argStack.at(-1) ?? null;
  if (wordLike(node)) {
    words.push(node.value);
    if (args !== null && !isSubst(node.value)) {
      args.push(node.value);
    }
    if (args === null) {
      forEachChild(node, (child) => visit(child, state));
    } else {
      argStack.push(null);
      forEachChild(node, (child) => visit(child, state));
      argStack.pop();
    }
    return;
  }
  const { type } = node;
  if (type === "Command") {
    walkCommand(node, state);
    return;
  }
  if (args !== null && isPruned(type)) {
    argStack.push(null);
    forEachChild(node, (child) => visit(child, state));
    argStack.pop();
    return;
  }
  if (type === "Function") {
    functionDefs.push(node.name.value);
  }
  forEachChild(node, (child) => visit(child, state));
}

export function parseCommand(command: string): ParsedCommand | null {
  const parsed = parseOrNull(command);
  if (parsed === null) {
    return null;
  }
  const state: WalkState = {
    argStack: [],
    functionDefs: [],
    redirects: [],
    units: [],
    words: [],
  };
  visit(parsed, state);
  return {
    functionDefs: state.functionDefs,
    raw: command,
    redirects: state.redirects,
    units: state.units,
    words: state.words,
  };
}

export function baseName(name: string): string {
  return name.replace(VERSION_SUFFIX, "");
}

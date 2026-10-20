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

function wordValues(node: unknown): string[] {
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
  return Object.values(node).flatMap((value) => wordValues(value));
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

export function parseCommand(command: string): ParsedCommand | null {
  const parsed = parseOrNull(command);
  if (parsed === null) {
    return null;
  }
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
          args: wordValues(node.suffix),
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
  return {
    functionDefs,
    raw: command,
    redirects,
    units,
    words,
  };
}

export function baseName(name: string): string {
  return name.replace(VERSION_SUFFIX, "");
}

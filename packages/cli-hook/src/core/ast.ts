import {
  forEachChild,
  parse,
  type ParsedScript,
  type SyntaxNode,
} from "unbash";

function wordLike(obj: Record<string, unknown>): boolean {
  return typeof obj.text === "string" && typeof obj.value === "string";
}

// Strip a trailing version suffix from a command name: python3.13 → python,
// node20 → node, perl5.34 → perl. Policies look tools up by this base name so
// versioned binaries cannot sidestep a table keyed on the plain name.
const VERSION_SUFFIX = /\d+(?:\.\d+)*$/;

// A word value that IS a whole-token substitution: command substitution
// ($(...), arithmetic $((...)) matches the same shape), legacy backticks,
// process substitution (<(...), >(...)). ONLY whole words drop from the
// args view: the substitution's own Command units are walked in full, so
// the raw text is already represented — and left in place it would trip
// the filesystem policy's raw-$ fail-closed deny on daily commands
// (`echo $(git log --oneline)`). A substitution SPLICED into a larger
// word (`/etc/pass$(echo wd)`) must KEEP riding the arg: the concatenated
// path exists in no unit's args, and the fail-closed gate must see it.
// Plain $VAR/${VAR} stay: the fail-closed variable gate classifies THOSE.
const WHOLE_WORD_SUBST =
  /^(?:\$\([\s\S]*\)|`[\s\S]*`|<\([\s\S]*\)|>\([\s\S]*\))$/;

function wordValues(node: unknown): string[] {
  if (node === null || typeof node !== "object") {
    return [];
  }
  const obj = node as Record<string, unknown>;
  if (wordLike(obj)) {
    if (WHOLE_WORD_SUBST.test(obj.value as string)) {
      return [];
    }
    return [obj.value as string];
  }
  // Redirect targets are never arguments: the Redirect node nests inside the
  // same `suffix` array, and the structured `redirects` view already carries
  // them.
  if (obj.type === "Redirect") {
    return [];
  }
  return Object.values(obj).flatMap(wordValues);
}

// Redirection targets of one command, from Command.redirects (prefix and
// suffix redirect nodes in source order). Redirect targets stay out of unit
// args (wordValues skips Redirect nodes), so this view is additive to the
// args view, not double-counting; the walk visits each redirect once.
function collectRedirects(
  node: Record<string, unknown>,
  out: CommandRedirect[],
): void {
  const list = node.redirects;
  if (!Array.isArray(list)) {
    return;
  }
  for (const r of list) {
    if (r !== null && typeof r === "object") {
      const redirect = r as Record<string, unknown>;
      const { operator, target, delimiter } = redirect;
      // Heredocs are a Redirection with NO target — the wordLike
      // HereDocDelimiter rides `.delimiter` instead (value is the UNQUOTED
      // delimiter, `quoted` flags the <<'EOF' form; `<<-` folds into the
      // operator). Emitting it with the same {operator, target} record keeps
      // one redirection view downstream.
      const word = (target ?? delimiter) as Record<string, unknown> | null;
      if (
        typeof operator === "string" &&
        word !== null &&
        typeof word === "object" &&
        wordLike(word)
      ) {
        out.push({ operator, target: word.value as string });
      }
    }
  }
}

export interface CommandUnit {
  args: string[];
  name: string;
}

// One redirection of one command: the direction lives in the operator
// (`>`/`>>`/`2>` write, `<` read) and the target is the word redirected to.
// These are NOT arguments — CommandUnit deliberately excludes them.
export interface CommandRedirect {
  operator: string;
  target: string;
}

export interface ParsedCommand {
  functionDefs: string[]; // inline function definition names (any form)
  raw: string;
  redirects: CommandRedirect[];
  units: CommandUnit[];
  words: string[];
}

// One unbash parse, two views: `units` (name+args per Command node) and
// `words` (every word-like string). unbash never throws on malformed input —
// best-effort scripts are walked (a typo'd quote must not let /etc/passwd
// through); null is returned only on an actual throw. Past the parser's
// nesting limit the tree truncates; no verdict hangs on the `errors` array —
// returning null would map to allow for the whole command in the hook's
// fail-open catch. Invariants the walk relies on:
//   - forEachChild yields canonical children once; the derived args/redirects
//     Command views alias the same nodes — walking them too would double-emit
//     every arg-position subtree.
//   - Embedded syntax resolves lazily on access; quoted-delimiter heredoc
//     bodies have no parts and reach neither units nor words (owned by
//     no-inline-scripts' heredoc-fed rule).
//   - Heredoc delimiters are wordLike and ride unit args, so heredoc-fed
//     detection keys on redirect target == arg.
//   - `words` is a diagnostic view; containment is the only safe
//     consumption.
export function parseCommand(command: string): ParsedCommand | null {
  let ast: ParsedScript;
  try {
    ast = parse(command);
  } catch {
    return null;
  }
  const units: CommandUnit[] = [];
  const words: string[] = [];
  const redirects: CommandRedirect[] = [];
  const functionDefs: string[] = [];
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the branches mirror the collected views; extracting them would reorder the units/words traversal
  const visit = (node: unknown): void => {
    if (node === null || typeof node !== "object") {
      return;
    }
    const obj = node as Record<string, unknown>;
    if (wordLike(obj)) {
      words.push(obj.value as string);
    }
    if (
      obj.type === "Command" &&
      obj.name !== null &&
      typeof obj.name === "object"
    ) {
      const name = obj.name as Record<string, unknown>;
      if (typeof name.value === "string") {
        units.push({ args: wordValues(obj.suffix), name: name.value });
      }
      collectRedirects(obj, redirects);
    }
    // unbash types EVERY definition form (parens, named, `function` keyword,
    // mutual) as a Function node — one branch covers them all.
    if (obj.type === "Function") {
      const fname = obj.name as Record<string, unknown> | null;
      if (fname !== null && typeof fname.value === "string") {
        functionDefs.push(fname.value);
      }
    }
    forEachChild(node as SyntaxNode, visit);
  };
  visit(ast);
  return { functionDefs, raw: command, redirects, units, words };
}

export function baseName(name: string): string {
  return name.replace(VERSION_SUFFIX, "");
}

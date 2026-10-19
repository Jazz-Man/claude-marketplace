import * as unbash from "unbash";

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

// Strip a trailing version suffix from a command name: python3.13 → python,
// node20 → node, perl5.34 → perl. Policies look tools up by this base name so
// versioned binaries cannot sidestep a table keyed on the plain name.
const VERSION_SUFFIX = /\d+(?:\.\d+)*$/u;

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
  redirect: unbash.Redirection,
): unbash.Word | unbash.HereDocDelimiter | undefined {
  if (redirect.type === "HereDoc") {
    return redirect.delimiter;
  }
  return redirect.target;
}

// Redirection targets of one command, from Command.redirects (prefix and
// suffix redirect nodes in source order). Redirect targets stay out of unit
// args (wordValues skips Redirect nodes), so this view is additive to the
// args view, not double-counting; the walk visits each redirect once.
function collectRedirects(
  command: unbash.Command,
  out: CommandRedirect[],
): void {
  for (const redirect of command.redirects) {
    const word = redirectWord(redirect);
    if (word !== undefined && wordLike(word)) {
      out.push({ operator: redirect.operator, target: word.value });
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

function parseOrNull(command: string): unbash.ParsedScript | null {
  try {
    return unbash.parse(command);
  } catch {
    return null;
  }
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
  const parsed = parseOrNull(command);
  if (parsed === null) {
    return null;
  }
  const units: CommandUnit[] = [];
  const words: string[] = [];
  const redirects: CommandRedirect[] = [];
  const functionDefs: string[] = [];
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the branches mirror the collected views; extracting them would reorder the units/words traversal
  const visit = (node: unbash.SyntaxNode): void => {
    if (wordLike(node)) {
      words.push(node.value);
    }
    if (node.type === "Command") {
      const { name } = node;
      if (name !== undefined) {
        units.push({ args: wordValues(node.suffix), name: name.value });
      }
      collectRedirects(node, redirects);
    }
    if (node.type === "Function") {
      functionDefs.push(node.name.value);
    }
    unbash.forEachChild(node, visit);
  };
  visit(parsed);
  return { functionDefs, raw: command, redirects, units, words };
}

export function baseName(name: string): string {
  return name.replace(VERSION_SUFFIX, "");
}

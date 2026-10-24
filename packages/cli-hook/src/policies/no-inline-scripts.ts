import { parseEnv } from "node:util";

import * as ast from "../core/ast.ts";
import { deny } from "../core/decision.ts";
import type { Policy } from "../core/policy.ts";
import { SHARED_WRAPPERS } from "../core/wrappers.ts";

const INTERPRETERS: Record<
  string,
  {
    longs: readonly string[];
    shorts: readonly string[];
  }
> = {
  bash: {
    longs: [],
    shorts: ["c"],
  },
  bun: {
    longs: ["--eval"],
    shorts: ["e"],
  },
  dash: {
    longs: [],
    shorts: ["c"],
  },
  fish: {
    longs: [],
    shorts: ["c"],
  },
  ksh: {
    longs: [],
    shorts: ["c"],
  },
  node: {
    longs: ["--eval", "--print"],
    shorts: ["e", "p"],
  },
  osascript: {
    longs: [],
    shorts: ["e"],
  },
  perl: {
    longs: [],
    shorts: ["e", "E"],
  },
  php: {
    longs: [],
    shorts: ["r"],
  },
  python: {
    longs: [],
    shorts: ["c"],
  },
  python3: {
    longs: [],
    shorts: ["c"],
  },
  ruby: {
    longs: [],
    shorts: ["e"],
  },
  sh: {
    longs: [],
    shorts: ["c"],
  },
  zsh: {
    longs: [],
    shorts: ["c"],
  },
};

const SHORT_FLAG_CLUSTER = /^-[A-Za-z]+$/u;

const EVAL_SUBCOMMANDS = new Set(["deno"]);

const WRAPPERS = new Set([...SHARED_WRAPPERS, "find"]);

function isInlineArg(lname: string, arg: string): boolean {
  const table = INTERPRETERS[lname];
  if (table === undefined) {
    return false;
  }
  if (table.longs.includes(arg)) {
    return true;
  }
  return (
    SHORT_FLAG_CLUSTER.test(arg) &&
    table.shorts.some((short) => arg.includes(short))
  );
}

const readsStdinScript = (args: readonly string[]) =>
  args.length === 0 || args.includes("-");

const isAssignment = (token: string) => Object.keys(parseEnv(token)).length > 0;

const FED_OPERATORS = new Set(["<<", "<<-", "<<<"]);

const heredocFed = (
  args: readonly string[],
  redirects: readonly ast.CommandRedirect[],
) =>
  redirects.some(
    (redirect) =>
      FED_OPERATORS.has(redirect.operator) && args.includes(redirect.target),
  );

function wrapperHeredocViolates(
  lname: string,
  args: readonly string[],
  redirects: readonly ast.CommandRedirect[],
): boolean {
  if (!WRAPPERS.has(lname)) {
    return false;
  }
  const wrapped = args.find(
    (token) =>
      !(token.startsWith("-") || isAssignment(token)) &&
      INTERPRETERS[ast.baseName(token.toLowerCase())] !== undefined,
  );
  return wrapped !== undefined && heredocFed(args, redirects);
}

function interpreterViolates(
  name: string,
  args: readonly string[],
  redirects: readonly ast.CommandRedirect[],
): boolean {
  if (EVAL_SUBCOMMANDS.has(name)) {
    return args[0] === "eval";
  }
  if (INTERPRETERS[name] === undefined) {
    return false;
  }
  if (heredocFed(args, redirects)) {
    return true;
  }
  return args.some((arg) => isInlineArg(name, arg)) || readsStdinScript(args);
}

function wrapperViolates(lname: string, args: readonly string[]): boolean {
  if (!WRAPPERS.has(lname)) {
    return false;
  }
  return args.some((arg, index) => {
    const next = args[index + 1];
    if (next === undefined) {
      return false;
    }
    const candidate = ast.baseName(arg.toLowerCase());
    if (candidate === "eval") {
      return true;
    }
    if (EVAL_SUBCOMMANDS.has(candidate)) {
      return next === "eval";
    }
    return (
      INTERPRETERS[candidate] !== undefined && isInlineArg(candidate, next)
    );
  });
}

function unitViolates(
  unit: ast.CommandUnit,
  redirects: readonly ast.CommandRedirect[],
): boolean {
  const lname = unit.name.toLowerCase();
  if (lname === "eval") {
    return true;
  }
  return (
    interpreterViolates(ast.baseName(lname), unit.args, redirects) ||
    wrapperViolates(lname, unit.args) ||
    wrapperHeredocViolates(lname, unit.args, redirects)
  );
}

export const REASON =
  "Inline scripts are blocked (interpreter -e/-c/--eval, shell -c/eval, stdin-fed scripts): inline code cannot be reviewed for safety. Write the script to a file under ./tmp/ and run that file instead — project linters and checkers can then review it.";

export const FUNCTION_REASON =
  "Inline function definitions are blocked: shell code belongs in a file — write the script under ./tmp/ at the project root and run that file. This also covers every fork-bomb signature (a function that spawns itself or another defined function).";

export const noInlineScriptsPolicy: Policy = {
  check(cmd) {
    if (cmd.functionDefs.length > 0) {
      return deny(FUNCTION_REASON);
    }
    for (const unit of cmd.units) {
      if (unitViolates(unit, cmd.redirects)) {
        return deny(REASON);
      }
    }
    return null;
  },
  name: "no-inline-scripts",
};

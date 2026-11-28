import { join, resolve } from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import { rootDirectoriesOutsideIgnore, rows } from "./config-rows.ts";
import {
  configProblems,
  isMapping,
  listOfStrings,
  shapeOf,
} from "./config-shape.ts";

const DEFAULT_CONFIG = ".grepai/config.yaml";

const USAGE =
  "usage: bun validate-config.ts [project-root] [--config path/to/config.yaml]";

const PARSE_HINTS: Record<string, string> = {
  "Tab characters": "indent with spaces only",
  "Unexpected token": "look for an unquoted colon or a broken list item",
  "Unresolved alias": 'an unquoted * opens an alias; quote globs ("*.pb.go")',
};

type Cli =
  | { exitCode: number; message: string; path?: never; root?: never }
  | { path: string; root: string };

type Parsed =
  | { config: Record<string, unknown>; problem?: never }
  | { config?: never; problem: string };

function parseCli(): Cli {
  try {
    const { positionals, values } = parseArgs({
      allowPositionals: true,
      options: {
        config: { type: "string" },
        help: { short: "h", type: "boolean" },
      },
    });
    if (values.help) {
      return { exitCode: 0, message: USAGE };
    }
    if (positionals.length > 1) {
      return {
        exitCode: 1,
        message: `one project root expected, got ${positionals.length}\n${USAGE}`,
      };
    }
    const [project] = positionals;
    return {
      path: configPathFor(values.config, project),
      root: resolve(project ?? "."),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { exitCode: 1, message: `${reason}\n${USAGE}` };
  }
}

function configPathFor(
  flag: string | undefined,
  project: string | undefined,
): string {
  return flag === undefined
    ? join(resolve(project ?? "."), DEFAULT_CONFIG)
    : resolve(flag);
}

function parseConfig(text: string): Parsed {
  let parsed: unknown;
  try {
    parsed = Bun.YAML.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const hint = Object.entries(PARSE_HINTS).find(([fragment]) =>
      message.includes(fragment),
    )?.[1];
    return {
      problem: hint === undefined ? message : `${message} (${hint})`,
    };
  }
  if (isMapping(parsed)) {
    return { config: parsed };
  }
  if (Array.isArray(parsed) && /^---\s*$/mu.test(text)) {
    return {
      problem: "the file holds several YAML documents; grepai reads one",
    };
  }
  return {
    problem: `the top level must be one block of keys, but holds ${shapeOf(parsed)}`,
  };
}

async function reportValid(
  path: string,
  root: string,
  config: Record<string, unknown>,
): Promise<number> {
  const status = await rows(config, root);
  const open = status.filter((item) => !item.ok);
  console.log(`${path}: valid`);
  for (const { detail, name, ok } of status) {
    console.log(`  ${name.padEnd(22)} ${ok ? "ok  " : "open"} ${detail}`);
  }
  const outside = await rootDirectoriesOutsideIgnore(
    root,
    listOfStrings(config.ignore),
  );
  if (outside.length > 0) {
    console.log(`  root directories outside ignore: ${outside.join(", ")}`);
  }
  if (open.length === 0) {
    console.log("complete");
    return 0;
  }
  console.log(`open rows: ${open.map((item) => item.name).join(", ")}`);
  return 1;
}

async function main(): Promise<number> {
  const cli = parseCli();
  if (cli.path === undefined) {
    console.log(cli.message);
    return cli.exitCode;
  }
  const { path, root } = cli;
  if (!(await Bun.file(path).exists())) {
    console.log(
      `${path}: invalid — not found; run \`grepai init --yes\` in the project first`,
    );
    return 1;
  }
  const text = await Bun.file(path).text();
  const parsed = parseConfig(text);
  if (parsed.problem !== undefined) {
    console.log(`${path}: invalid — ${parsed.problem}`);
    return 1;
  }
  const problems = configProblems(text, parsed.config);
  if (problems.length > 0) {
    console.log(`${path}: invalid`);
    for (const problem of problems) {
      console.log(`  - ${problem}`);
    }
    return 1;
  }
  return reportValid(path, root, parsed.config);
}

process.exitCode = await main();

import { bench, do_not_optimize, group, run } from "mitata";
import { baseName, parseCommand } from "../src/core/ast.ts";
import commandList from "../src/mutable-commands.txt";
import { noDepsPolicy } from "../src/policies/no-deps.ts";

const CONTEXT = { cwd: "/proj", projectRoot: "/proj" };

const EXEMPLARS: Record<string, string> = {
  "deno run <url>": "deno run https://example.com/x.ts",
  "go run <pkg>@<version>": "go run example.com/pkg@latest",
};

const commands = commandList
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line !== "")
  .map((line) => EXEMPLARS[line] ?? line);

const parsed = commands
  .map((command) => parseCommand(command))
  .filter((cmd): cmd is NonNullable<typeof cmd> => cmd !== null);

function sweep(): void {
  for (const command of commands) {
    const cmd = parseCommand(command);
    if (cmd !== null) {
      do_not_optimize(noDepsPolicy.check(cmd, CONTEXT));
    }
  }
}

function checkAll(): void {
  for (const cmd of parsed) {
    do_not_optimize(noDepsPolicy.check(cmd, CONTEXT));
  }
}

group(`full arsenal: ${commands.length} commands`, () => {
  bench("full cycle: parseCommand + check (real policy)", sweep).gc("inner");
  bench("check only (pre-parsed)", checkAll).gc("inner");
});

group("per command: full cycle (real policy)", () => {
  bench("$command", function* (state: { get(name: string): unknown }) {
    const command = state.get("command") as string;
    yield () => {
      const cmd = parseCommand(command);
      if (cmd !== null) {
        do_not_optimize(noDepsPolicy.check(cmd, CONTEXT));
      }
    };
  }).args("command", commands);
});

const { benchmarks } = await run({
  format: "markdown",
});

const measured = benchmarks
  .flatMap((trial) => trial.runs)
  .flatMap((entry) =>
    entry.stats === undefined ? [] : [{ name: entry.name, stats: entry.stats }],
  );
measured.sort((a, b) => b.stats.avg - a.stats.avg);
console.log("\nmitata-measured top 10 slowest (real policy, ns/iter avg):");
for (const { name, stats } of measured.slice(0, 10)) {
  console.log(`  ${stats.avg.toFixed(0).padStart(7)} ns  ${name}`);
}

// Attributed mirror of src/policies/no-deps.ts: same stages, timed apart.
const ALIASES: Record<string, string> = {
  bundler: "bundle",
  yarnpkg: "yarn",
};

type Pattern = readonly string[];

const toolCache = new Map<string, string>();
function toolOf(name: string): string {
  const cached = toolCache.get(name);
  if (cached !== undefined) {
    return cached;
  }
  const raw = name.toLowerCase();
  const tool = baseName(ALIASES[raw] ?? raw);
  toolCache.set(name, tool);
  return tool;
}

const RUNNERS = new Set<string>();
const source = new Map<string, Set<string>>();
const lines = commandList
  .split("\n")
  .map((line) => line.trim().toLowerCase())
  .filter((line) => line !== "" && !line.includes("<"));
for (const line of lines) {
  const [name, ...pattern] = line.split(/\s+/u);
  const tool = toolOf(name ?? "");
  if (pattern.length === 0) {
    RUNNERS.add(tool);
  } else {
    const joined = source.get(tool) ?? new Set<string>();
    joined.add(pattern.join(" "));
    source.set(tool, joined);
  }
}
const DENY = new Map<string, readonly Pattern[]>(
  [...source].map(([tool, joined]) => [
    tool,
    [...joined].map((pattern) => pattern.split(" ")),
  ]),
);

function startsWithTokens(tokens: readonly string[], args: string[]): boolean {
  return (
    tokens.length <= args.length &&
    tokens.every((token, index) => token === args[index]?.toLowerCase())
  );
}

function isUrl(value: string): boolean {
  return URL.canParse(value);
}

function isModuleRef(value: string): boolean {
  const at = value.lastIndexOf("@");
  if (at <= 0) {
    return false;
  }
  const prefix = `https://${value.slice(0, at)}`;
  if (!URL.canParse(prefix)) {
    return false;
  }
  const { host } = new URL(prefix);
  return host !== "" && host !== ".";
}

function fetches(tool: string, args: string[]): boolean {
  if (tool === "go") {
    const spec = args[1];
    return (
      spec !== undefined && startsWithTokens(["run"], args) && isModuleRef(spec)
    );
  }
  if (tool === "deno") {
    const spec = args[1];
    return spec !== undefined && startsWithTokens(["run"], args) && isUrl(spec);
  }
  return false;
}

type Row = {
  command: string;
  parse: number;
  toolOf: number;
  lookup: number;
  scan: number;
  fetch: number;
  total: number;
  real: number;
};

const ITERS = 2000;

function timed(fn: () => void): number {
  const start = performance.now();
  for (let i = 0; i < ITERS; i += 1) {
    fn();
  }
  return ((performance.now() - start) * 1e6) / ITERS;
}

function measureStages(command: string): Row {
  const v0 = timed(() => {
    do_not_optimize(parseCommand(command));
  });
  const v1 = timed(() => {
    const cmd = parseCommand(command);
    if (cmd !== null) {
      for (const unit of cmd.units) {
        do_not_optimize(toolOf(unit.name));
      }
    }
  });
  const v2 = timed(() => {
    const cmd = parseCommand(command);
    if (cmd !== null) {
      for (const unit of cmd.units) {
        const tool = toolOf(unit.name);
        do_not_optimize(RUNNERS.has(tool) ? true : DENY.get(tool));
      }
    }
  });
  const v3 = timed(() => {
    const cmd = parseCommand(command);
    if (cmd !== null) {
      for (const unit of cmd.units) {
        const tool = toolOf(unit.name);
        if (RUNNERS.has(tool)) {
          do_not_optimize(true);
          continue;
        }
        const patterns = DENY.get(tool);
        do_not_optimize(patterns?.some((p) => startsWithTokens(p, unit.args)));
      }
    }
  });
  const v4 = timed(() => {
    const cmd = parseCommand(command);
    if (cmd === null) {
      return;
    }
    for (const unit of cmd.units) {
      const tool = toolOf(unit.name);
      if (RUNNERS.has(tool)) {
        do_not_optimize(true);
        break;
      }
      const patterns = DENY.get(tool);
      if (patterns?.some((p) => startsWithTokens(p, unit.args))) {
        do_not_optimize(true);
        break;
      }
      do_not_optimize(fetches(tool, unit.args));
    }
  });
  const real = timed(() => {
    const cmd = parseCommand(command);
    if (cmd !== null) {
      do_not_optimize(noDepsPolicy.check(cmd, CONTEXT));
    }
  });
  return {
    command,
    fetch: v4 - v3,
    lookup: v2 - v1,
    parse: v0,
    real,
    scan: v3 - v2,
    toolOf: v1 - v0,
    total: v4,
  };
}

const rows = commands.map((command) => measureStages(command));

function fmt(value: number): string {
  return value.toFixed(0).padStart(7);
}

rows.sort((a, b) => b.total - a.total);
console.log("\ntop 15 slowest commands — stage breakdown (ns/iter):");
console.log("   total   parse  toolOf  lookup    scan   fetch  command");
for (const row of rows.slice(0, 15)) {
  console.log(
    `${fmt(row.total)}${fmt(row.parse)}${fmt(row.toolOf)}${fmt(row.lookup)}${fmt(row.scan)}${fmt(row.fetch)}  ${row.command}`,
  );
}

const byParse = [...rows].sort((a, b) => b.parse - a.parse);
console.log("\ntop 5 by parseCommand alone (ns/iter):");
for (const row of byParse.slice(0, 5)) {
  console.log(`${fmt(row.parse)}  ${row.command}`);
}

const sum = (pick: (row: Row) => number): number =>
  rows.reduce((acc, row) => acc + pick(row), 0);
const totalAll = sum((row) => row.total);
const parts: [string, number][] = [
  ["parseCommand", sum((row) => row.parse)],
  ["toolOf", sum((row) => row.toolOf)],
  ["lookup (RUNNERS/DENY)", sum((row) => row.lookup)],
  ["scan (startsWithTokens)", sum((row) => row.scan)],
  ["fetch (isUrl/isModuleRef)", sum((row) => row.fetch)],
];
console.log(
  `\naggregate across ${rows.length} commands (share of ${totalAll.toFixed(0)} ns total):`,
);
for (const [name, value] of parts) {
  const share = ((value / totalAll) * 100).toFixed(1);
  console.log(
    `  ${name.padEnd(24)} ${value.toFixed(0).padStart(9)} ns  ${share.padStart(5)}%`,
  );
}

const divergence = Math.max(
  ...rows.map((row) => Math.abs(row.total - row.real)),
);
console.log(
  `\nmirror-vs-real sanity: max |mirror - real| = ${divergence.toFixed(0)} ns (mean real total ${(
    sum((row) => row.real) / rows.length
  ).toFixed(0)} ns)`,
);

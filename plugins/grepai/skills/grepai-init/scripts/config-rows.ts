import type { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";

import { isMapping, listOfStrings } from "./config-shape.ts";

const BASELINE = { dimensions: 1024, model: "bge-m3", strategy: "ast" };

const AGENT_NAMES = [
  "CLAUDE.md",
  "AGENTS.md",
  ".claude",
  ".agents",
  ".zed",
  ".idea",
];

const SHIPPED_LANGUAGES = [
  ".go",
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".vue",
  ".py",
  ".php",
  ".lua",
  ".gd",
  ".rb",
  ".c",
  ".h",
  ".cpp",
  ".hpp",
  ".cc",
  ".cxx",
  ".hxx",
  ".rs",
  ".zig",
  ".cs",
  ".java",
  ".fs",
  ".fsx",
  ".fsi",
  ".pas",
  ".dpr",
];

const isEnabled = (value: unknown): boolean =>
  isMapping(value) && value.enabled === true;

const ruleCount = (rules: Record<string, unknown>, key: string): number =>
  Array.isArray(rules[key]) ? rules[key].length : 0;

const row = (name: string, ok: boolean, detail: string): Row => ({
  detail,
  name,
  ok,
});

async function externalGitignoreRow(
  config: Record<string, unknown>,
): Promise<Row> {
  const value =
    typeof config.external_gitignore === "string"
      ? config.external_gitignore.trim()
      : "";
  if (value === "") {
    return row("external_gitignore", false, "not set");
  }
  try {
    await Bun.file(value.replace(/^~(?=$|\/)/u, homedir())).text();
    return row("external_gitignore", true, value);
  } catch {
    return row("external_gitignore", false, `${value} (no such file)`);
  }
}

async function agentNamesRow(ignore: string[], root: string): Promise<Row> {
  const ignored = await Promise.all(
    AGENT_NAMES.map((name) => gitIgnores(root, name)),
  );
  const missing = AGENT_NAMES.filter(
    (name, index) => !(ignore.includes(name) || ignored[index]),
  );
  const count = `${ignore.length} entries; `;
  return missing.length === 0
    ? row("ignore", true, `${count}agent and editor names in`)
    : row("ignore", false, `${count}missing ${missing.join(", ")}`);
}

function boostRow(search: Record<string, unknown>): Row {
  const rules = isMapping(search.boost) ? search.boost : {};
  const on = isEnabled(search.boost);
  const detail = on
    ? `enabled; ${ruleCount(rules, "penalties")} penalties, ${ruleCount(rules, "bonuses")} bonuses`
    : "disabled";
  return row("search.boost", on, detail);
}

function switchRow(search: Record<string, unknown>, key: string): Row {
  const on = isEnabled(search[key]);
  return row(`search.${key}`, on, on ? "enabled" : "disabled");
}

function languagesRow(trace: unknown): Row {
  const languages = isMapping(trace)
    ? listOfStrings(trace.enabled_languages)
    : [];
  const shipped =
    languages.length === SHIPPED_LANGUAGES.length &&
    SHIPPED_LANGUAGES.every((item) => languages.includes(item));
  return shipped
    ? row(
        "trace.enabled_languages",
        false,
        `${languages.length} entries: the shipped set, not this project's languages`,
      )
    : row(
        "trace.enabled_languages",
        true,
        `${languages.length} entries: ${languages.join(" ")}`,
      );
}

function baselineRow(config: Record<string, unknown>): Row {
  const embedder = isMapping(config.embedder) ? config.embedder : {};
  const chunking = isMapping(config.chunking) ? config.chunking : {};
  const ok =
    embedder.model === BASELINE.model &&
    embedder.dimensions === BASELINE.dimensions &&
    chunking.strategy === BASELINE.strategy;
  return row(
    "embedder/chunking",
    ok,
    `${String(embedder.model)}, ${String(embedder.dimensions)}d, ${String(chunking.strategy)}`,
  );
}

export interface Row {
  detail: string;
  name: string;
  ok: boolean;
}

export async function gitIgnores(root: string, name: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(
      ["git", "-C", root, "check-ignore", "-q", "--", name],
      { stderr: "ignore", stdout: "ignore" },
    );
    return (await proc.exited) === 0;
  } catch {
    return false;
  }
}

export async function rows(
  config: Record<string, unknown>,
  root: string,
): Promise<Row[]> {
  const search = isMapping(config.search) ? config.search : {};
  const rpgOn = isMapping(config.rpg) && config.rpg.enabled === true;
  return [
    await externalGitignoreRow(config),
    await agentNamesRow(listOfStrings(config.ignore), root),
    boostRow(search),
    switchRow(search, "hybrid"),
    switchRow(search, "dedup"),
    languagesRow(config.trace),
    row("rpg", rpgOn, rpgOn ? "enabled" : "disabled"),
    baselineRow(config),
  ];
}

export async function rootDirectoriesOutsideIgnore(
  root: string,
  ignore: string[],
): Promise<string[]> {
  let entries: Dirent[] = [];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const candidates = entries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name.startsWith(".") &&
        ![".git", ".grepai"].includes(entry.name) &&
        !ignore.includes(entry.name),
    )
    .map((entry) => entry.name);
  const ignored = await Promise.all(
    candidates.map((name) => gitIgnores(root, name)),
  );
  return candidates.filter((_, index) => !ignored[index]).sort();
}

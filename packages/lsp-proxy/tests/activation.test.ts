import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { activeServers } from "../src/activation.ts";
import type { ServerConfig } from "../src/config.ts";

const plain: ServerConfig = {
  command: "plain",
  extensionToLanguage: { ".ts": "typescript" },
  name: "plain",
};
const biome: ServerConfig = {
  command: "biome",
  configFiles: ["biome.json", "biome.jsonc"],
  extensionToLanguage: { ".ts": "typescript" },
  name: "biome",
};

const roots: string[] = [];
const fileUri = (dir: string): string => pathToFileURL(dir).href;

function makeRoot(...markers: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "lsp proxy activation "));
  roots.push(dir);
  for (const marker of markers) {
    writeFileSync(join(dir, marker), "{}");
  }
  return dir;
}

function started(
  servers: ServerConfig[],
  initParams: Record<string, unknown> = {},
  logs: string[] = [],
): string[] {
  const active = activeServers({ servers }, initParams, (line) =>
    logs.push(line),
  );
  return active.map((server) => server.name);
}

afterEach(() => {
  for (const dir of roots.splice(0)) {
    rmSync(dir, { force: true, recursive: true });
  }
});

describe("activeServers: which servers start", () => {
  it("starts a server without configFiles in any project", () => {
    expect(started([plain], {})).toEqual(["plain"]);
    expect(started([plain], { rootPath: makeRoot() })).toEqual(["plain"]);
  });

  it("starts a gated server when the project root holds any listed file", () => {
    expect(started([biome], { rootPath: makeRoot("biome.json") })).toEqual([
      "biome",
    ]);
    expect(started([biome], { rootPath: makeRoot("biome.jsonc") })).toEqual([
      "biome",
    ]);
  });

  it("skips a gated server and logs why when no listed file is in the root", () => {
    const logs: string[] = [];
    const root = makeRoot("package.json");
    expect(started([plain, biome], { rootPath: root }, logs)).toEqual([
      "plain",
    ]);
    expect(logs).toEqual([
      `server biome: not started, none of [biome.json, biome.jsonc] in ${root}`,
    ]);
  });

  it("looks only at the project root, not below it", () => {
    const root = makeRoot();
    const nested = join(root, "packages", "app");
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(nested, "biome.json"), "{}");
    expect(started([biome], { rootPath: root })).toEqual([]);
  });
});

describe("activeServers: project root", () => {
  it("takes the root from the first workspace folder over rootUri", () => {
    const bare = makeRoot();
    const configured = makeRoot("biome.json");
    const folder = (dir: string) => ({ name: "project", uri: fileUri(dir) });
    expect(
      started([biome], {
        rootUri: fileUri(configured),
        workspaceFolders: [folder(bare)],
      }),
    ).toEqual([]);
    expect(
      started([biome], { workspaceFolders: [folder(configured)] }),
    ).toEqual(["biome"]);
  });

  it("falls back to rootUri (decoded) and then rootPath", () => {
    const configured = makeRoot("biome.json");
    expect(started([biome], { rootUri: fileUri(configured) })).toEqual([
      "biome",
    ]);
    expect(started([biome], { rootPath: configured, rootUri: null })).toEqual([
      "biome",
    ]);
  });

  it("uses the working directory when the client names no root", () => {
    const configured = makeRoot("biome.json");
    const previous = process.cwd();
    process.chdir(configured);
    try {
      expect(started([biome], {})).toEqual(["biome"]);
    } finally {
      process.chdir(previous);
    }
  });
});

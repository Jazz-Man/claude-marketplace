import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import process from "node:process";

import { runHook } from "../src/run-hook.ts";
import { decisionOf, reasonOf } from "./helpers/policy.ts";
import { bashPayload, filePayload, spawnHook } from "./helpers/utils.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hookDecision(raw: string) {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) {
    return null;
  }
  const { hookSpecificOutput } = parsed;
  if (!isRecord(hookSpecificOutput)) {
    return null;
  }
  const { permissionDecision, permissionDecisionReason } = hookSpecificOutput;
  if (
    typeof permissionDecision !== "string" ||
    typeof permissionDecisionReason !== "string"
  ) {
    return null;
  }
  return {
    permissionDecision,
    permissionDecisionReason,
  };
}

function isolateProjectDir() {
  let savedProjectDir: string | undefined;
  beforeEach(() => {
    savedProjectDir = process.env.CLAUDE_PROJECT_DIR;
    delete process.env.CLAUDE_PROJECT_DIR;
  });
  afterEach(() => {
    if (savedProjectDir === undefined) {
      delete process.env.CLAUDE_PROJECT_DIR;
    } else {
      process.env.CLAUDE_PROJECT_DIR = savedProjectDir;
    }
  });
}

function decisionOfBash(command: string) {
  return decisionOf(runHook(bashPayload(command)));
}

describe("runHook (unit)", () => {
  it("denies git writes through the router", () => {
    expect(decisionOfBash("git push")).toBe("deny");
  });

  it("returns the FIRST policy's reason on dual violations", () => {
    expect(reasonOf(runHook(bashPayload("npm install /etc/passwd")))).toContain(
      "Dependency install/update blocked",
    );
  });

  it("denies filesystem escapes", () => {
    expect(decisionOfBash("cat /etc/passwd")).toBe("deny");
  });
});

describe("runHook (unit — routing)", () => {
  it("allows ordinary commands", () => {
    expect(runHook(bashPayload("ls -la"))).toBeNull();
  });

  it("ignores non-Bash tools and non-PreToolUse events", () => {
    expect(
      runHook({
        ...bashPayload("git push"),
        tool_name: "Read",
      }),
    ).toBeNull();
    expect(
      runHook({
        ...bashPayload("git push"),
        hook_event_name: "PostToolUse",
      }),
    ).toBeNull();
  });
});

describe("runHook (unit — fail-open)", () => {
  it("fails open on non-object input and missing/empty command", () => {
    expect(runHook("{not json")).toBeNull();
    expect(runHook(42)).toBeNull();
    expect(
      runHook({
        hook_event_name: "PreToolUse",
        tool_input: {},
        tool_name: "Bash",
      }),
    ).toBeNull();
    expect(runHook(bashPayload(""))).toBeNull();
  });
});

describe("router v2", () => {
  it("filesystem ask propagates through the router", () => {
    expect(decisionOfBash("ls ~")).toBe("ask");
  });

  it("absolute-policy deny wins over a filesystem ask on the same command", () => {
    expect(decisionOfBash("npm install /tmp/x")).toBe("deny");
  });

  it("no-inline fires before the filesystem injection guard on bash -c /dev/tcp", () => {
    const result = runHook(bashPayload("bash -c 'echo x > /dev/tcp/host/80'"));
    expect(decisionOf(result)).toBe("deny");
    expect(reasonOf(result)).toContain("Inline scripts are blocked");
  });
});

describe("projectRoot resolution (CLAUDE_PROJECT_DIR unset)", () => {
  isolateProjectDir();

  it("uses the payload cwd for filesystem decisions", () => {
    const withCwd = {
      ...bashPayload("cat /payload-root/f"),
      cwd: "/payload-root",
    };
    expect(runHook(withCwd)).toBeNull();
    const outsideCwd = {
      ...bashPayload("cat /usr/local/lib/f"),
      cwd: "/payload-root",
    };
    const decision = decisionOf(runHook(outsideCwd));
    expect(decision).toBe("deny");
  });

  it("falls back to cwd when CLAUDE_PROJECT_DIR is unset", () => {
    expect(runHook(bashPayload("tee /proj/out x"))).toBeNull();
  });

  it("allows Write inside the project via the tool channel", () => {
    expect(runHook(filePayload("Write", "/proj/src/x.ts"))).toBeNull();
  });
});

describe("projectRoot resolution (CLAUDE_PROJECT_DIR zone)", () => {
  isolateProjectDir();

  it.each([
    [
      "projectRoot carves an allowed zone outside $HOME",
      "/workspace/repo",
      "/workspace/repo",
      "tee /workspace/repo/x y",
    ],
    [
      "CLAUDE_PROJECT_DIR feeds projectRoot, not the cwd fallback",
      "/zone-a",
      "/zone-b",
      "tee /zone-a/out",
    ],
  ])("%s", (_, projectDir, cwd, command) => {
    process.env.CLAUDE_PROJECT_DIR = projectDir;
    expect(runHook({ ...bashPayload(command), cwd })).toBeNull();
  });
});

describe("tool channel", () => {
  it.each([
    ["Read of a system file denies", "Read", "/etc/passwd"],
    [
      "Edit of home shell rc denies (personal config write)",
      "Edit",
      "~/.zshrc",
    ],
    [
      "Read of .git/hooks denies (any reference)",
      "Read",
      "/proj/.git/hooks/pre-commit",
    ],
  ])("%s", (_, tool_name, filePath) => {
    const decision = decisionOf(runHook(filePayload(tool_name, filePath)));
    expect(decision).toBe("deny");
  });
});

describe("tool channel (allows and fail-open)", () => {
  it("Read of an out-of-zone write-only tier hits the boundary", () => {
    const decision = decisionOf(
      runHook(filePayload("Read", "/opt/repo/.git/config")),
    );
    expect(decision).toBe("deny");
  });

  it("Read of in-zone .git/config allows (write-only tier, read passes)", () => {
    expect(runHook(filePayload("Read", "/proj/.git/config"))).toBeNull();
  });

  it("non-file tools fail open", () => {
    expect(runHook(filePayload("Grep", "/etc/passwd"))).toBeNull();
    expect(
      runHook({
        cwd: "/proj",
        hook_event_name: "PreToolUse",
        tool_input: {},
        tool_name: "Glob",
      }),
    ).toBeNull();
  });

  it("Read without file_path fails open", () => {
    expect(
      runHook({
        cwd: "/proj",
        hook_event_name: "PreToolUse",
        tool_input: {},
        tool_name: "Read",
      }),
    ).toBeNull();
  });
});

describe("runHook (e2e via spawned main.ts)", () => {
  it.each([
    [
      "emits nothing and exits 0 for an allowed command",
      JSON.stringify(bashPayload("ls -la")),
    ],
    ["emits nothing for invalid JSON", "{not json"],
    ["emits nothing and exits 0 for empty stdin", ""],
    ["emits nothing and exits 0 for valid-JSON non-object input", "42"],
  ])("%s", async (_, raw) => {
    const { code, stdout } = await spawnHook(raw);
    expect(code).toBe(0);
    expect(stdout).toBe("");
  });

  it("emits the deny JSON for a git write", async () => {
    const { code, stdout } = await spawnHook(
      JSON.stringify(bashPayload("git push")),
    );
    expect(code).toBe(0);
    const output = hookDecision(stdout);
    expect(output?.permissionDecision).toBe("deny");
    expect(output?.permissionDecisionReason).toContain("read-only policy");
  });
});

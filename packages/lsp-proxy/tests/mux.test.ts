import { describe, expect, it } from "bun:test";

import { RequestMux } from "../src/mux.ts";

describe("RequestMux", () => {
  it("assigns independent per-server id sequences to one client id", () => {
    const mux = new RequestMux();
    const idHover = mux.assign(10, "vtsls", "textDocument/hover");
    const idFormat = mux.assign(10, "biome", "textDocument/formatting");
    expect(idHover).toBe(1);
    expect(idFormat).toBe(1);
    const second = mux.assign(11, "vtsls", "textDocument/hover");
    expect(second).toBe(2);
  });

  it("resolves responses in any arrival order back to the right client entry", () => {
    const mux = new RequestMux();
    const forBiome = mux.assign(10, "biome", "textDocument/hover");
    const forVtsls = mux.assign(10, "vtsls", "textDocument/hover");
    const late = mux.lookup("vtsls", forVtsls);
    const early = mux.lookup("biome", forBiome);
    expect(early?.clientId).toBe(10);
    expect(early?.server).toBe("biome");
    expect(late?.clientId).toBe(10);
    expect(late?.server).toBe("vtsls");
  });

  it("releases entries so ids can be reused without ghost lookups", () => {
    const mux = new RequestMux();
    const serverId = mux.assign(10, "vtsls", "textDocument/hover");
    const entry = mux.lookup("vtsls", serverId);
    expect(entry).toBeDefined();
    if (entry) {
      mux.release(entry);
    }
    expect(mux.lookup("vtsls", serverId)).toBeUndefined();
    expect(mux.clientPending(10)).toEqual([]);
  });

  it("tracks pending fan-out per client id for cancellations", () => {
    const mux = new RequestMux();
    mux.assign(42, "vtsls", "textDocument/completion");
    mux.assign(42, "biome", "textDocument/completion");
    const pending = mux.clientPending(42);
    expect(pending).toEqual([
      { server: "vtsls", serverId: 1 },
      { server: "biome", serverId: 1 },
    ]);
  });
});

import { describe, expect, it } from "bun:test";

import { ServerSide } from "../src/proxy-server.ts";
import { makeHostFixture } from "./helpers/proxy-harness.ts";

const RESET_MS = 50;

describe("handleServerExit deaths reset", () => {
  it("resets the death counter after a stable interval", async () => {
    const { host, logs } = makeHostFixture();
    const side = new ServerSide(host, RESET_MS);
    await side.handleServerExit("stub", 1);
    expect(logs).toEqual(["server stub died (1); respawning"]);
    await side.handleServerExit("stub", 1);
    expect(logs).toEqual([
      "server stub died (1); respawning",
      "server stub died (1) a second time; giving up",
    ]);
    await Bun.sleep(RESET_MS * 3);
    await side.handleServerExit("stub", 1);
    expect(logs.at(2)).toBe("server stub died (1); respawning");
  });
});

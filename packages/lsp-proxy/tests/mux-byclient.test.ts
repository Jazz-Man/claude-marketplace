import { describe, expect, it } from "bun:test";

import { RequestMux } from "../src/mux.ts";

describe("RequestMux byClient", () => {
  it("keeps a later same-server generation pending after releasing the earlier one", () => {
    const mux = new RequestMux();
    const first = mux.assign(5, "a", "m");
    const second = mux.assign(5, "a", "m");
    expect(second).toBe(first + 1);
    const entry = mux.lookup("a", first);
    expect(entry).toBeDefined();
    if (entry) {
      mux.release(entry);
    }
    expect(mux.clientPending(5)).toEqual([{ server: "a", serverId: second }]);
  });
});

import { expect, it } from "bun:test";

import {
  openDocument,
  responseFor,
  stub,
  TS,
  withProxy,
} from "./helpers/proxy-harness.ts";
import { waitFor } from "./helpers/wait.ts";

const SWEEP_LOG = /swept [12] pending requests for fragile/u;

it("sweep: pending hover resolves with error when server dies mid-request", async () => {
  await withProxy(
    [
      stub("fragile", { exitOnDidOpen: true }, TS),
      stub("healthy", { hover: "alive" }, TS),
    ],
    async (proxy) => {
      openDocument(proxy, "file:///proj/s.ts", "typescript");
      proxy.push({
        id: 2,
        jsonrpc: "2.0",
        method: "textDocument/hover",
        params: { textDocument: { uri: "file:///proj/s.ts" } },
      });
      const swept = () => SWEEP_LOG.test(proxy.stderr());
      await waitFor(
        () =>
          proxy.clientMessages.some((message) => message.id === 2) && swept(),
      );
      const response = responseFor(proxy, 2);
      expect(response).toBeDefined();
    },
  );
}, 20_000);

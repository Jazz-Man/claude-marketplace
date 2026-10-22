import { expect, it } from "bun:test";

import { boot, responseFor, stub } from "./helpers/proxy-harness.ts";
import { waitFor } from "./helpers/wait.ts";

const SWEEP_LOG = /swept [12] pending requests for fragile/;

const TS = { ".ts": "typescript" };

it("sweep: pending hover resolves with error when server dies mid-request", async () => {
  const proxy = await boot([
    stub("fragile", { exitOnDidOpen: true }, TS),
    stub("healthy", { hover: "alive" }, TS),
  ]);
  // Open a document (kills fragile) then immediately hover
  proxy.push({
    jsonrpc: "2.0",
    method: "textDocument/didOpen",
    params: {
      textDocument: {
        languageId: "typescript",
        text: "const x = 1;\n",
        uri: "file:///proj/s.ts",
      },
    },
  });
  proxy.push({
    id: 2,
    jsonrpc: "2.0",
    method: "textDocument/hover",
    params: { textDocument: { uri: "file:///proj/s.ts" } },
  });
  // The fragile server will die; its pending hover must resolve (not hang).
  // The sweep log on stderr is direct proof the waiter was swept by
  // failAllFor — a flipped routing-vs-exit race becomes a loud failure.
  const swept = () => SWEEP_LOG.test(proxy.stderr());
  await waitFor(
    () =>
      proxy.clientMessages.some((message) => message.id === 2) && swept(),
  );
  const response = responseFor(proxy, 2);
  expect(response).toBeDefined();
  await proxy.stop();
}, 20_000);

import { uriOf } from "./boundary.ts";
import type { DocumentStore } from "./docstore.ts";
import type { Downstream } from "./downstream.ts";
import type { JsonRpcMessage } from "./framing.ts";
import { isRecord } from "./guards/index.ts";
import type { ServerCapabilities } from "./router.ts";

function isFullSync(sync: unknown): boolean {
  return sync === 1 || (isRecord(sync) && sync.change === 1);
}

export function didChangeFrame(
  message: JsonRpcMessage,
  sync: unknown,
  fullText: string | undefined,
): JsonRpcMessage {
  if (
    message.method !== "textDocument/didChange" ||
    !isFullSync(sync) ||
    fullText === undefined
  ) {
    return message;
  }
  const textDocument = isRecord(message.params)
    ? message.params.textDocument
    : undefined;
  return {
    jsonrpc: "2.0",
    method: message.method,
    params: {
      contentChanges: [{ text: fullText }],
      textDocument: isRecord(textDocument) ? textDocument : { uri: "" },
    },
  };
}

export function broadcast(
  message: JsonRpcMessage,
  recipients: Downstream[],
): void {
  for (const downstream of recipients) {
    downstream.send({ ...message, id: undefined });
  }
}

export function broadcastDocument(
  message: JsonRpcMessage,
  recipients: Downstream[],
  syncs: Map<string, ServerCapabilities>,
  docs: DocumentStore,
): void {
  const uri = uriOf(message.params);
  for (const downstream of recipients) {
    const sync = syncs.get(downstream.name)?.textDocumentSync;
    const frame = didChangeFrame(message, sync, docs.get(uri)?.text);
    downstream.send({ ...frame, id: undefined });
  }
}

import type { ProxyConfig } from "./config.ts";
import { LspErrorCode, TimeoutMs } from "./constants/index.ts";
import type { Downstream } from "./downstream.ts";
import type { JsonRpcMessage } from "./framing.ts";
import {
  itemsOf,
  type MergeOutcome,
  mergeOutcomes,
  originOfCodeAction,
  type ServerOutcome,
} from "./merge.ts";
import { policyFor } from "./methods/index.ts";
import { RequestMux } from "./mux.ts";

export interface Waiter {
  resolve: (outcome: ServerOutcome) => void;
}

export function toOutcome(
  message: JsonRpcMessage,
  server: string,
): ServerOutcome {
  if (message.error !== undefined) {
    return { error: message.error, server };
  }
  return { result: message.result ?? null, server };
}

export interface RequestHost {
  config: ProxyConfig;
  log: (line: string) => void;
  notify: (message: JsonRpcMessage) => void;
  replyErrorTo: (
    id: number | string | null,
    code: number,
    message: string,
    data?: unknown,
  ) => void;
  replyTo: (id: number | string | null, result: unknown) => void;
  servers: Map<string, Downstream>;
}

const PSEUDO_CLIENT_ID = -1;

export class RequestBroker {
  private readonly mux = new RequestMux();
  private readonly waiters = new Map<string, Waiter>();
  private readonly host: RequestHost;

  constructor(host: RequestHost) {
    this.host = host;
  }

  async askSequentially(
    message: JsonRpcMessage,
    method: string,
    recipients: Downstream[],
  ): Promise<void> {
    const askNext = async (index: number): Promise<void> => {
      const downstream = recipients[index];
      if (downstream === undefined) {
        this.host.replyTo(message.id ?? null, null);
        return;
      }
      const outcome = await this.askOnce(message, method, downstream);
      if (
        outcome.error === undefined &&
        outcome.result !== null &&
        outcome.result !== undefined
      ) {
        this.host.replyTo(message.id ?? null, outcome.result);
        return;
      }
      await askNext(index + 1);
    };
    await askNext(0);
  }

  async askAllAndMerge(
    message: JsonRpcMessage,
    method: string,
    recipients: Downstream[],
  ): Promise<void> {
    const outcomes = await Promise.all(
      recipients.map((downstream) => this.askOnce(message, method, downstream)),
    );
    const merged = mergeOutcomes(
      method,
      outcomes,
      this.host.config.servers.map((server) => server.name),
    );
    this.replyOutcome(message, merged);
  }

  cancel(params: { id: number | string }): void {
    for (const { server, serverId } of this.mux.clientPending(params.id)) {
      const downstream = this.host.servers.get(server);
      const waiterKey = `${server}:${serverId}`;
      const entry = this.mux.lookup(server, serverId);
      downstream?.send({
        id: serverId,
        jsonrpc: "2.0",
        method: "$/cancelRequest",
      });
      const waiter = this.waiters.get(waiterKey);
      if (waiter !== undefined && entry !== undefined) {
        this.waiters.delete(waiterKey);
        waiter.resolve({
          error: { code: -32_800, message: "cancelled" },
          server,
        });
        this.mux.release(entry);
      }
    }
  }

  failAllFor(server: string, reason: string): number {
    const prefix = `${server}:`;
    const matching = [...this.waiters.keys()].filter((key) =>
      key.startsWith(prefix),
    );
    for (const key of matching) {
      this.sweepOne(
        server,
        Number(key.slice(prefix.length)),
        `server ${server} died: ${reason}`,
      );
    }
    return matching.length;
  }

  resolveCodeAction(message: JsonRpcMessage): void {
    const origin = originOfCodeAction(message.params);
    const [fallback] = this.host.servers.keys();
    const target =
      origin !== undefined && this.host.servers.has(origin) ? origin : fallback;
    const downstream =
      target === undefined ? undefined : this.host.servers.get(target);
    if (downstream === undefined) {
      this.host.replyErrorTo(
        message.id ?? null,
        -32_601,
        "no server for codeAction/resolve",
      );
      return;
    }
    const serverId = this.mux.assign(
      message.id ?? 0,
      downstream.name,
      message.method ?? "",
    );
    const outcome = this.pending(downstream.name, serverId);
    downstream.send({
      id: serverId,
      jsonrpc: "2.0",
      method: message.method,
      params: message.params,
    });
    outcome
      .then((resolved) => {
        this.replyOutcome(message, resolved);
      })
      .catch((reason: unknown) => {
        this.host.log(`codeAction/resolve: ${String(reason)}`);
      });
  }

  pullDiagnostics(uri: string, method: string, recipients: Downstream[]): void {
    if (policyFor(method)?.triggersPull !== true) {
      return;
    }
    for (const downstream of recipients) {
      this.sendPull(downstream, uri);
    }
  }

  resolveServerResponse(
    server: string,
    serverId: number,
    message: JsonRpcMessage,
  ): boolean {
    const waiterKey = `${server}:${serverId}`;
    const waiter = this.waiters.get(waiterKey);
    if (waiter === undefined) {
      return false;
    }
    this.waiters.delete(waiterKey);
    const entry = this.mux.lookup(server, serverId);
    if (entry !== undefined) {
      this.mux.release(entry);
    }
    waiter.resolve(toOutcome(message, server));
    return true;
  }

  private sendPull(downstream: Downstream, uri: string): void {
    const serverId = this.mux.assign(
      PSEUDO_CLIENT_ID,
      downstream.name,
      "textDocument/diagnostic",
      uri,
    );
    const outcome = this.pending(downstream.name, serverId);
    downstream.send({
      id: serverId,
      jsonrpc: "2.0",
      method: "textDocument/diagnostic",
      params: { textDocument: { uri } },
    });
    outcome
      .then((resolved) => {
        if (resolved.error !== undefined) {
          this.host.log(
            `${downstream.name}: pull diagnostics failed: ${resolved.error.message}`,
          );
          return;
        }
        this.host.notify({
          jsonrpc: "2.0",
          method: "textDocument/publishDiagnostics",
          params: { diagnostics: itemsOf(resolved.result), uri },
        });
      })
      .catch((reason: unknown) => {
        this.host.log(
          `pull diagnostics for ${downstream.name}: ${String(reason)}`,
        );
      });
  }

  private async askOnce(
    message: JsonRpcMessage,
    method: string,
    downstream: Downstream,
  ): Promise<ServerOutcome> {
    const serverId = this.mux.assign(message.id ?? 0, downstream.name, method);
    const outcome = this.pending(downstream.name, serverId);
    downstream.send({
      id: serverId,
      jsonrpc: "2.0",
      method,
      params: message.params,
    });
    const timer = setTimeout(() => {
      this.sweepOne(
        downstream.name,
        serverId,
        `request timeout after ${String(TimeoutMs.request)}ms`,
      );
    }, TimeoutMs.request);
    try {
      return await outcome;
    } finally {
      clearTimeout(timer);
    }
  }

  private pending(server: string, serverId: number): Promise<ServerOutcome> {
    return new Promise((resolve) => {
      this.waiters.set(`${server}:${serverId}`, { resolve });
    });
  }

  private sweepOne(server: string, serverId: number, message: string): void {
    const waiterKey = `${server}:${serverId}`;
    const waiter = this.waiters.get(waiterKey);
    if (waiter === undefined) {
      return;
    }
    this.waiters.delete(waiterKey);
    const entry = this.mux.lookup(server, serverId);
    if (entry !== undefined) {
      this.mux.release(entry);
    }
    waiter.resolve({
      error: { code: LspErrorCode.InternalError, message },
      server,
    });
  }

  private replyOutcome(message: JsonRpcMessage, outcome: MergeOutcome): void {
    if (outcome.error !== undefined) {
      this.host.replyErrorTo(
        message.id ?? null,
        outcome.error.code,
        outcome.error.message,
        outcome.error.data,
      );
      return;
    }
    this.host.replyTo(message.id ?? null, outcome.result ?? null);
  }
}

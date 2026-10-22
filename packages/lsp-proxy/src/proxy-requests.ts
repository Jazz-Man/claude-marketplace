import type { ProxyConfig } from "./config.ts";
import type { Downstream } from "./downstream.ts";
import type { JsonRpcError, JsonRpcMessage } from "./framing.ts";
import {
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
  ) => void;
  replyTo: (id: number | string | null, result: unknown) => void;
  servers: Map<string, Downstream>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function itemsOf(result: unknown): unknown[] {
  if (isRecord(result) && Array.isArray(result.items)) {
    return result.items;
  }
  return [];
}

export class RequestBroker {
  mux = new RequestMux();
  waiters = new Map<string, Waiter>();
  private readonly host: RequestHost;

  constructor(host: RequestHost) {
    this.host = host;
  }

  async askSequentially(
    message: JsonRpcMessage,
    method: string,
    recipients: Downstream[],
  ): Promise<void> {
    const [downstream, ...rest] = recipients;
    if (downstream === undefined) {
      this.host.replyTo(message.id ?? null, null);
      return Promise.resolve();
    }
    const outcome = await this.askOnce(message, method, downstream);
    if (
      outcome.error === undefined &&
      outcome.result !== null &&
      outcome.result !== undefined
    ) {
      this.host.replyTo(message.id ?? null, outcome.result);
      return Promise.resolve();
    }
    return await this.askSequentially(message, method, rest);
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
    if (merged.error !== undefined) {
      this.host.replyErrorTo(
        message.id ?? null,
        merged.error.code,
        merged.error.message,
      );
      return;
    }
    this.host.replyTo(message.id ?? null, merged.result ?? null);
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

  resolveCodeAction(message: JsonRpcMessage): void {
    const origin = originOfCodeAction(message.params);
    const [fallback] = this.host.servers.keys();
    let target = fallback;
    if (origin !== undefined && this.host.servers.has(origin)) {
      target = origin;
    }
    let downstream: Downstream | undefined;
    if (target !== undefined) {
      downstream = this.host.servers.get(target);
    }
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
    const outcome = new Promise<ServerOutcome>((resolve) => {
      this.waiters.set(`${downstream.name}:${serverId}`, { resolve });
    });
    downstream.send({
      id: serverId,
      jsonrpc: "2.0",
      method: message.method,
      params: message.params,
    });
    outcome
      .then((resolved) => {
        if (resolved.error !== undefined) {
          this.replyError(resolved.error, message);
          return;
        }
        this.host.replyTo(message.id ?? null, resolved.result ?? null);
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
      0,
      downstream.name,
      "textDocument/diagnostic",
      uri,
    );
    const outcome = new Promise<ServerOutcome>((resolve) => {
      this.waiters.set(`${downstream.name}:${serverId}`, { resolve });
    });
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

  private askOnce(
    message: JsonRpcMessage,
    method: string,
    downstream: Downstream,
  ): Promise<ServerOutcome> {
    const clientId = message.id ?? 0;
    const serverId = this.mux.assign(clientId, downstream.name, method);
    const outcome = new Promise<ServerOutcome>((resolve) => {
      this.waiters.set(`${downstream.name}:${serverId}`, { resolve });
    });
    downstream.send({
      id: serverId,
      jsonrpc: "2.0",
      method,
      params: message.params,
    });
    return outcome;
  }

  private replyError(error: JsonRpcError, message: JsonRpcMessage): void {
    this.host.replyErrorTo(message.id ?? null, error.code, error.message);
  }
}

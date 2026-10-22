import type { ProxyConfig, ServerConfig } from "./config.ts";
import { TimeoutMs } from "./constants/index.ts";
import type { DocumentStore } from "./docstore.ts";
import { Downstream } from "./downstream.ts";
import type { JsonRpcMessage } from "./framing.ts";
import {
  type RequestBroker,
  toOutcome,
  type Waiter,
} from "./proxy-requests.ts";
import { type ServerCapabilities, serversForDocument } from "./router.ts";

const ANSWERED_SERVER_REQUESTS = new Set([
  "client/registerCapability",
  "window/workDoneProgress/create",
]);

export interface ProxyHost {
  broker: RequestBroker;
  clientParams: Record<string, unknown>;
  config: ProxyConfig;
  docs: DocumentStore;
  dropServer: (server: string) => void;
  isStopped: () => boolean;
  log: (line: string) => void;
  servers: Map<string, Downstream>;
  write: (message: JsonRpcMessage) => void;
}

function coerceResponseId(id: number | string | null | undefined): number {
  if (typeof id === "string") {
    return Number(id);
  }
  return id ?? 0;
}

export class ServerSide {
  capabilities = new Map<string, ServerCapabilities>();
  private readonly initializeIds = new Map<string, number>();
  private readonly initializeWaiters = new Map<string, Waiter>();
  private readonly deaths = new Map<string, number>();
  private readonly host: ProxyHost;
  private nextServerId = 0;
  private readonly rejected = new Set<string>();

  constructor(host: ProxyHost) {
    this.host = host;
  }

  nextId(): number {
    this.nextServerId += 1;
    return this.nextServerId;
  }

  reject(server: string): void {
    this.rejected.add(server);
  }

  pullCapable(downstreams: Downstream[]): Downstream[] {
    return downstreams.filter(
      (downstream) =>
        this.capabilities.get(downstream.name)?.diagnosticProvider !==
        undefined,
    );
  }

  prepareReply(server: string): { id: number; reply: Promise<void> } {
    return this.registerReply(server, false);
  }

  async shutdownServers(): Promise<void> {
    const replies = [...this.host.servers.values()].map(async (downstream) => {
      const { id, reply } = this.prepareReply(downstream.name);
      downstream.send({ id, jsonrpc: "2.0", method: "shutdown" });
      await reply;
    });
    await Promise.all(replies);
  }

  onServerMessage(server: string, message: JsonRpcMessage): void {
    if (
      message.method !== undefined &&
      message.id !== undefined &&
      message.id !== null
    ) {
      this.handleServerRequest(server, message);
      return;
    }
    if (message.method !== undefined) {
      this.handleServerNotification(server, message);
      return;
    }
    this.handleServerResponse(server, message);
  }

  startServer(
    serverConfig: ServerConfig,
    initParams: Record<string, unknown>,
  ): Promise<void> {
    const { name } = serverConfig;
    const downstream = new Downstream(serverConfig, {
      onExit: (exitCode) => {
        this.handleServerExit(name, exitCode).catch((reason: unknown) => {
          this.host.log(`exit handler for ${name}: ${String(reason)}`);
        });
      },
      onMessage: (message) => {
        this.onServerMessage(name, message);
      },
    });
    this.host.servers.set(name, downstream);
    downstream.start();
    const childPid = downstream.pid;
    if (childPid !== undefined) {
      this.host.log(`spawned ${name} pid=${String(childPid)}`);
    }
    const { id, reply } = this.registerReply(name, true);
    downstream.send({
      id,
      jsonrpc: "2.0",
      method: "initialize",
      params: {
        ...initParams,
        initializationOptions: serverConfig.initializationOptions ?? {},
      },
    });
    return reply;
  }

  async handleServerExit(server: string, code: number | null): Promise<void> {
    if (this.host.isStopped()) {
      return;
    }
    if (this.rejected.has(server)) {
      return;
    }
    const deaths = (this.deaths.get(server) ?? 0) + 1;
    this.deaths.set(server, deaths);
    this.capabilities.delete(server);
    this.host.dropServer(server);
    const swept = this.host.broker.failAllFor(
      server,
      `exit code ${String(code)}`,
    );
    if (swept > 0) {
      this.host.log(`swept ${String(swept)} pending requests for ${server}`);
    }
    if (deaths > 1) {
      this.host.log(`server ${server} died (${code}) a second time; giving up`);
      return;
    }
    this.host.log(`server ${server} died (${code}); respawning`);
    const serverConfig = this.host.config.servers.find(
      (entry) => entry.name === server,
    );
    if (serverConfig === undefined) {
      return;
    }
    await this.startServer(serverConfig, this.host.clientParams);
    this.replayDocuments(serverConfig);
  }

  private registerReply(
    server: string,
    storeCapabilities: boolean,
  ): { id: number; reply: Promise<void> } {
    const id = this.nextId();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<void>((_, reject) => {
      timer = setTimeout(() => {
        if (this.initializeIds.get(server) === id) {
          this.initializeWaiters.delete(server);
          this.initializeIds.delete(server);
        }
        reject(
          new Error(
            `initialize timeout after ${String(TimeoutMs.initialize)}ms`,
          ),
        );
      }, TimeoutMs.initialize);
    });
    const reply = new Promise<void>((resolve) => {
      this.initializeWaiters.set(server, {
        resolve: (outcome) => {
          if (storeCapabilities && outcome.result !== undefined) {
            const caps =
              (outcome.result as { capabilities?: ServerCapabilities })
                .capabilities ?? {};
            this.capabilities.set(server, caps);
          }
          clearTimeout(timer);
          resolve();
        },
      });
      this.initializeIds.set(server, id);
    });
    return { id, reply: Promise.race([reply, timedOut]) };
  }

  private replayDocuments(serverConfig: ServerConfig): void {
    const relevant = this.host.docs
      .entries()
      .filter((entry) =>
        serversForDocument(this.host.config, entry.uri).some(
          (server) => server.name === serverConfig.name,
        ),
      );
    for (const entry of relevant) {
      const downstream = this.host.servers.get(serverConfig.name);
      downstream?.send({
        jsonrpc: "2.0",
        method: "textDocument/didOpen",
        params: {
          textDocument: {
            languageId: entry.languageId,
            text: entry.text,
            uri: entry.uri,
          },
        },
      });
    }
  }

  private handleServerResponse(server: string, message: JsonRpcMessage): void {
    const serverId = coerceResponseId(message.id);
    if (this.host.broker.resolveServerResponse(server, serverId, message)) {
      return;
    }
    const initializeWaiter = this.initializeWaiters.get(server);
    if (
      initializeWaiter !== undefined &&
      this.initializeIds.get(server) === serverId
    ) {
      this.initializeWaiters.delete(server);
      initializeWaiter.resolve(toOutcome(message, server));
    }
  }

  private handleServerNotification(
    server: string,
    message: JsonRpcMessage,
  ): void {
    const method = message.method ?? "";
    if (method === "textDocument/publishDiagnostics") {
      this.host.write(message);
      return;
    }
    if (method === "window/logMessage" || method === "window/showMessage") {
      this.host.log(`${server}: ${method}`);
      return;
    }
    if (method.startsWith("$/")) {
      this.host.log(`${server}: dropped ${method}`);
    }
  }

  private handleServerRequest(server: string, message: JsonRpcMessage): void {
    const method = message.method ?? "";
    const downstream = this.host.servers.get(server);
    if (downstream === undefined) {
      this.host.log(`${server} sent ${method} after exiting; dropped`);
      return;
    }
    const serverConfig = this.host.config.servers.find(
      (entry) => entry.name === server,
    );
    if (
      method === "workspace/configuration" &&
      serverConfig &&
      message.params !== undefined
    ) {
      const items = (message.params as { items?: unknown[] }).items ?? [];
      downstream.send({
        id: message.id ?? null,
        jsonrpc: "2.0",
        result: items.map(() => serverConfig.settings ?? null),
      });
      return;
    }
    if (ANSWERED_SERVER_REQUESTS.has(method)) {
      downstream.send({ id: message.id ?? null, jsonrpc: "2.0", result: null });
      return;
    }
    downstream.send({
      error: { code: -32_601, message: `lsp-proxy does not forward ${method}` },
      id: message.id ?? null,
      jsonrpc: "2.0",
    });
  }
}

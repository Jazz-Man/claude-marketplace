import { cancelIdOf, changesOf, textDocumentOf, uriOf } from "./boundary.ts";
import { mergeCapabilities } from "./capabilities.ts";
import type { ProxyConfig, ServerConfig } from "./config.ts";
import { LspErrorCode, VERSION } from "./constants/index.ts";
import { DocumentStore } from "./docstore.ts";
import type { Downstream } from "./downstream.ts";
import {
  createDecoder,
  encodeFrame,
  type JsonRpcError,
  type JsonRpcMessage,
} from "./framing.ts";
import { isRecord } from "./guards/index.ts";
import { policyFor } from "./methods/index.ts";
import { RequestBroker } from "./proxy-requests.ts";
import { ServerSide } from "./proxy-server.ts";
import { serversForDocument, serversForRequest } from "./router.ts";

export interface ProxyIO {
  readChunks: () => AsyncIterable<Uint8Array>;
  stdout: {
    flush: () => void;
    write: (chunk: Uint8Array) => number | Promise<number>;
  };
}

type Phase = "starting" | "ready" | "shutDown" | "stopped";

export class LspProxy {
  broker: RequestBroker;
  clientParams: Record<string, unknown> = {};
  config: ProxyConfig;
  docs = new DocumentStore();
  private readonly finish: () => void;
  servers = new Map<string, Downstream>();
  private readonly io: ProxyIO;
  log: (line: string) => void;
  private phase: Phase = "starting";
  private readonly serverSide: ServerSide;

  constructor(
    config: ProxyConfig,
    io: ProxyIO,
    log: (line: string) => void,
    finish: () => void,
  ) {
    this.config = config;
    this.io = io;
    this.log = log;
    this.finish = finish;
    this.broker = new RequestBroker({
      config,
      log: (line) => this.log(line),
      notify: (message) => this.write(message),
      replyErrorTo: (id, code, message, data) =>
        this.replyErrorTo(id, code, message, data),
      replyTo: (id, result) => this.replyTo(id, result),
      servers: this.servers,
    });
    this.serverSide = new ServerSide(this);
  }

  async run(): Promise<void> {
    const decode = createDecoder((message) => {
      try {
        this.onClientMessage(message);
      } catch (error) {
        this.log(`client message dispatch error: ${String(error)}`);
      }
    }, this.logFailure("client stream"));
    try {
      for await (const chunk of this.io.readChunks()) {
        decode(chunk);
      }
    } catch (error) {
      this.log(`client loop error: ${String(error)}`);
    }
    await this.cascadeShutdown("client stdin closed");
  }

  async cascadeShutdown(reason: string): Promise<void> {
    if (this.phase === "stopped") {
      return;
    }
    this.phase = "stopped";
    this.log(`shutting down: ${reason}`);
    const stragglers = [...this.servers.values()];
    for (const downstream of stragglers) {
      downstream.send({
        id: this.serverSide.nextId(),
        jsonrpc: "2.0",
        method: "shutdown",
      });
      downstream.kill("SIGTERM");
    }
    this.servers.clear();
    const allExited = Promise.all(
      stragglers.map((downstream) => downstream.exited()),
    ).catch(() => -1);
    const escalation = new Promise<void>((resolve) => {
      setTimeout(() => {
        for (const downstream of stragglers) {
          downstream.kill("SIGKILL");
        }
        resolve();
      }, 2000);
    });
    await Promise.race([allExited, escalation]);
  }

  isStopped(): boolean {
    return this.phase === "stopped" || this.phase === "shutDown";
  }

  write(message: JsonRpcMessage): void {
    this.io.stdout.write(encodeFrame(message));
    this.io.stdout.flush();
  }

  replyTo(id: number | string | null, result: unknown): void {
    this.write({ id, jsonrpc: "2.0", result });
  }

  replyErrorTo(
    id: number | string | null,
    code: number,
    message: string,
    data?: unknown,
  ): void {
    const error: JsonRpcError =
      data === undefined ? { code, message } : { code, data, message };
    this.write({ error, id, jsonrpc: "2.0" });
  }

  dropServer(server: string): void {
    this.servers.get(server)?.kill();
    this.servers.delete(server);
  }

  private logFailure(prefix: string): (reason: unknown) => void {
    return (reason: unknown) => this.log(`${prefix}: ${String(reason)}`);
  }

  private onClientMessage(message: JsonRpcMessage): void {
    if (message.method === undefined) {
      return;
    }
    if (message.method === "initialize") {
      this.handleInitialize(message).catch(this.logFailure("initialize"));
      return;
    }
    if (message.method === "initialized") {
      this.broadcast(message, [...this.servers.values()]);
      return;
    }
    if (message.method === "shutdown") {
      this.handleShutdown(message).catch(this.logFailure("shutdown"));
      return;
    }
    if (message.method === "exit") {
      this.cascadeShutdown("exit")
        .catch(this.logFailure("shutdown cascade"))
        .then(this.finish);
      return;
    }
    if (message.method === "$/cancelRequest") {
      const id = cancelIdOf(message.params);
      if (id !== undefined) {
        this.broker.cancel({ id });
      }
      return;
    }
    if (policyFor(message.method)?.isDocumentNotification === true) {
      this.handleDocumentNotification(message);
      return;
    }
    if (message.id !== undefined && message.id !== null) {
      this.handleClientRequest(message).catch((reason: unknown) => {
        this.log(`request ${String(message.id)}: ${String(reason)}`);
        this.replyErrorTo(message.id ?? null, -32_603, "internal error");
      });
    }
  }

  private async handleInitialize(message: JsonRpcMessage): Promise<void> {
    if (isRecord(message.params)) {
      this.clientParams = message.params;
    }
    try {
      await Promise.all(
        this.config.servers.map((serverConfig) =>
          this.serverSide.startServer(serverConfig, this.clientParams),
        ),
      );
    } catch (error) {
      this.log(`initialize failed: ${String(error)}`);
      this.replyErrorTo(
        message.id ?? null,
        LspErrorCode.InternalError,
        `failed to start servers: ${String(error)}`,
      );
      return;
    }
    const merge = mergeCapabilities(
      [...this.serverSide.capabilities.entries()].map(([server, entry]) => ({
        capabilities: entry,
        server,
      })),
      this.config.servers.map((server) => server.name),
    );
    for (const rejected of merge.rejected) {
      this.log(`rejecting server ${rejected.server}: ${rejected.reason}`);
      this.serverSide.reject(rejected.server);
      this.serverSide.capabilities.delete(rejected.server);
      this.dropServer(rejected.server);
    }
    this.phase = "ready";
    this.replyTo(message.id ?? null, {
      capabilities: merge.merged,
      serverInfo: { name: "lsp-proxy", version: VERSION },
    });
  }

  private liveRecipients(recipients: ServerConfig[]): Downstream[] {
    return recipients.flatMap((serverConfig) => {
      const downstream = this.servers.get(serverConfig.name);
      return downstream === undefined ? [] : [downstream];
    });
  }

  private handleDocumentNotification(message: JsonRpcMessage): void {
    const { params } = message;
    const uri = uriOf(params);
    if (message.method === "textDocument/didOpen") {
      this.openDocument(uri, params);
    }
    if (message.method === "textDocument/didChange") {
      this.docs.change(uri, changesOf(params));
    }
    if (message.method === "textDocument/didClose") {
      this.docs.close(uri);
    }
    const live = this.liveRecipients(serversForDocument(this.config, uri));
    this.broadcast(message, live);
    this.broker.pullDiagnostics(
      uri,
      message.method ?? "",
      this.serverSide.pullCapable(live),
    );
  }

  private openDocument(uri: string, params: unknown): void {
    if (!(isRecord(params) && isRecord(params.textDocument))) {
      return;
    }
    const { languageId = "", text = "" } = params.textDocument;
    if (typeof languageId !== "string" || typeof text !== "string") {
      return;
    }
    this.docs.open(uri, languageId, text);
  }

  private broadcast(message: JsonRpcMessage, recipients: Downstream[]): void {
    for (const downstream of recipients) {
      downstream.send({ ...message, id: undefined });
    }
  }

  private async handleClientRequest(message: JsonRpcMessage): Promise<void> {
    if (this.phase !== "ready") {
      this.replyErrorTo(message.id ?? null, -32_002, "server not initialized");
      return;
    }
    const method = message.method ?? "";
    const { uri } = textDocumentOf(message.params);
    if (method === "codeAction/resolve") {
      this.broker.resolveCodeAction(message);
      return;
    }
    const recipients = this.liveRecipients(
      serversForRequest(this.config, this.serverSide.capabilities, uri, method),
    );
    if (recipients.length === 0) {
      this.replyTo(message.id ?? null, null);
      return;
    }
    if (policyFor(method)?.isSingleResult === true) {
      await this.broker.askSequentially(message, method, recipients);
      return;
    }
    await this.broker.askAllAndMerge(message, method, recipients);
  }

  private async handleShutdown(message: JsonRpcMessage): Promise<void> {
    await this.serverSide.shutdownServers();
    this.phase = "shutDown";
    this.replyTo(message.id ?? null, null);
  }
}

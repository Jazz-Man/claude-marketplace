import process from "node:process";

import { cancelIdOf, changesOf, textDocumentOf, uriOf } from "./boundary.ts";
import { mergeCapabilities } from "./capabilities.ts";
import type { ProxyConfig, ServerConfig } from "./config.ts";
import { DocumentStore } from "./docstore.ts";
import type { Downstream } from "./downstream.ts";
import { createDecoder, encodeFrame, type JsonRpcMessage } from "./framing.ts";
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
  servers = new Map<string, Downstream>();
  private readonly io: ProxyIO;
  log: (line: string) => void;
  private phase: Phase = "starting";
  private readonly serverSide: ServerSide;

  constructor(config: ProxyConfig, io: ProxyIO, log: (line: string) => void) {
    this.config = config;
    this.io = io;
    this.log = log;
    this.broker = new RequestBroker({
      config,
      log: (line) => this.log(line),
      notify: (message) => this.write(message),
      replyErrorTo: (id, code, message) => this.replyErrorTo(id, code, message),
      replyTo: (id, result) => this.replyTo(id, result),
      servers: this.servers,
    });
    this.serverSide = new ServerSide(this);
  }

  async run(): Promise<void> {
    const decode = createDecoder(
      (message) => {
        this.onClientMessage(message);
      },
      (reason) => {
        this.log(`client stream: ${reason}`);
      },
    );
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
    process.exit(0);
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
  ): void {
    this.write({ error: { code, message }, id, jsonrpc: "2.0" });
  }

  dropServer(server: string): void {
    const downstream = this.servers.get(server);
    if (downstream !== undefined) {
      downstream.kill();
      this.servers.delete(server);
    }
  }

  private onClientMessage(message: JsonRpcMessage): void {
    if (message.method === undefined) {
      return;
    }
    if (message.method === "initialize") {
      this.handleInitialize(message).catch((reason: unknown) => {
        this.log(`initialize: ${String(reason)}`);
      });
      return;
    }
    if (message.method === "initialized") {
      this.broadcastNotification(message, [...this.servers.values()]);
      return;
    }
    if (message.method === "shutdown") {
      this.handleShutdown(message).catch((reason: unknown) => {
        this.log(`shutdown: ${String(reason)}`);
      });
      return;
    }
    if (message.method === "exit") {
      this.cascadeShutdown("exit").catch((reason: unknown) => {
        this.log(`shutdown cascade: ${String(reason)}`);
      });
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
    await Promise.all(
      this.config.servers.map((serverConfig) =>
        this.serverSide.startServer(serverConfig, this.clientParams),
      ),
    );
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
      serverInfo: { name: "lsp-proxy", version: "0.1.0" },
    });
  }

  private liveRecipients(recipients: ServerConfig[]): Downstream[] {
    const live: Downstream[] = [];
    for (const serverConfig of recipients) {
      const downstream = this.servers.get(serverConfig.name);
      if (downstream !== undefined) {
        live.push(downstream);
      }
    }
    return live;
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
    const recipients = serversForDocument(this.config, uri);
    const live = this.liveRecipients(recipients);
    this.broadcastNotification(message, live);
    this.broker.pullDiagnostics(
      uri,
      message.method ?? "",
      this.serverSide.pullCapable(live),
    );
  }

  private openDocument(uri: string, params: unknown): void {
    if (!isRecord(params)) {
      return;
    }
    const { textDocument } = params;
    if (!isRecord(textDocument)) {
      return;
    }
    const { languageId = "", text = "" } = textDocument;
    if (typeof languageId !== "string") {
      return;
    }
    if (typeof text !== "string") {
      return;
    }
    this.docs.open(uri, languageId, text);
  }

  private broadcastNotification(
    message: JsonRpcMessage,
    recipients: Downstream[],
  ): void {
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

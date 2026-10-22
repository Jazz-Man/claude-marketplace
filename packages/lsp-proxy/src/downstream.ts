import process from "node:process";
import type { Subprocess } from "bun";

import type { ServerConfig } from "./config.ts";
import { createDecoder, encodeFrame, type JsonRpcMessage } from "./framing.ts";

const EXIT_UNKNOWN = -1;

export interface DownstreamHandlers {
  onExit: (
    exitCode: number | null,
    signalCode: NodeJS.Signals | number | null,
  ) => void;
  onMessage: (message: JsonRpcMessage) => void;
}

export interface DownstreamOptions {
  log?: (line: string) => void;
}

export class Downstream {
  readonly name: string;
  private readonly config: ServerConfig;
  private readonly handlers: DownstreamHandlers;
  private readonly log: (line: string) => void;
  private child: Subprocess<"pipe", "pipe", "inherit"> | undefined;

  constructor(
    config: ServerConfig,
    handlers: DownstreamHandlers,
    options?: DownstreamOptions,
  ) {
    this.config = config;
    this.handlers = handlers;
    this.log = options?.log ?? ((line) => console.error(line));
    this.name = config.name;
  }

  get pid(): number | undefined {
    return this.child?.pid;
  }

  start(): void {
    const child = Bun.spawn({
      cmd: [this.config.command, ...(this.config.args ?? [])],
      env: { ...process.env, ...this.config.env },
      onExit: (_subprocess, exitCode, signalCode) => {
        this.child = undefined;
        this.handlers.onExit(exitCode, signalCode);
      },
      stderr: "inherit",
      stdin: "pipe",
      stdout: "pipe",
    });
    this.child = child;
    this.readLoop(child).catch((reason: unknown) => {
      this.streamError(reason);
    });
  }

  send(message: JsonRpcMessage): void {
    const { child } = this;
    if (child === undefined || child.exitCode !== null) {
      return;
    }
    child.stdin.write(encodeFrame(message));
    child.stdin.flush();
  }

  kill(signal: number | NodeJS.Signals = "SIGTERM"): void {
    this.child?.kill(signal);
  }

  exited(): Promise<number> {
    return this.child?.exited ?? Promise.resolve(EXIT_UNKNOWN);
  }

  private streamError(reason: unknown): void {
    this.log(`[${this.name}] stream: ${String(reason)}`);
  }

  private async readLoop(
    child: Subprocess<"pipe", "pipe", "inherit">,
  ): Promise<void> {
    const decode = createDecoder(
      (message) => {
        try {
          this.handlers.onMessage(message);
        } catch (error) {
          this.log(`[${this.name}] message dispatch error: ${String(error)}`);
        }
      },
      (reason) => this.streamError(reason),
    );
    for await (const chunk of child.stdout) {
      decode(chunk);
    }
  }
}

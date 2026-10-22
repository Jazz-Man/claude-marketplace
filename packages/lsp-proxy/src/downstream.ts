import process from "node:process";
import type { Subprocess } from "bun";

import type { ServerConfig } from "./config.ts";
import { createDecoder, encodeFrame, type JsonRpcMessage } from "./framing.ts";

export interface DownstreamHandlers {
  onExit: (
    exitCode: number | null,
    signalCode: NodeJS.Signals | number | null,
  ) => void;
  onMessage: (message: JsonRpcMessage) => void;
}

export class Downstream {
  readonly name: string;
  private readonly config: ServerConfig;
  private readonly handlers: DownstreamHandlers;
  private child: Subprocess<"pipe", "pipe", "inherit"> | undefined;

  constructor(config: ServerConfig, handlers: DownstreamHandlers) {
    this.config = config;
    this.handlers = handlers;
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
      console.error(`[${this.name}] stream: ${String(reason)}`);
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
    return this.child?.exited ?? Promise.resolve(-1);
  }

  private async readLoop(
    child: Subprocess<"pipe", "pipe", "inherit">,
  ): Promise<void> {
    const decode = createDecoder(
      (message) => {
        try {
          this.handlers.onMessage(message);
        } catch (error) {
          console.error(
            `[${this.name}] message dispatch error: ${String(error)}`,
          );
        }
      },
      (reason) => console.error(`[${this.name}] stream: ${reason}`),
    );
    for await (const chunk of child.stdout) {
      decode(chunk);
    }
  }
}

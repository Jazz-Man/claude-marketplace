import { describe, expect, it } from "bun:test";

import {
  createDecoder,
  encodeFrame,
  type JsonRpcMessage,
} from "../src/framing.ts";

const SAMPLE: JsonRpcMessage = {
  jsonrpc: "2.0",
  method: "textDocument/publishDiagnostics",
  params: { uri: "file:///proj/тест.ts" },
};

function collect(): {
  errors: string[];
  messages: JsonRpcMessage[];
  push: (chunk: Uint8Array) => void;
} {
  const messages: JsonRpcMessage[] = [];
  const errors: string[] = [];
  const push = createDecoder(
    (message) => messages.push(message),
    (reason) => errors.push(reason),
  );
  return { errors, messages, push };
}

function rawFrame(body: string): Uint8Array {
  const bodyBytes = new TextEncoder().encode(body);
  const header = new TextEncoder().encode(
    `Content-Length: ${bodyBytes.byteLength}\r\n\r\n`,
  );
  const frame = new Uint8Array(header.byteLength + bodyBytes.byteLength);
  frame.set(header);
  frame.set(bodyBytes, header.byteLength);
  return frame;
}

describe("encodeFrame + createDecoder", () => {
  it("round-trips a multibyte message", () => {
    const received = collect();
    received.push(encodeFrame(SAMPLE));
    expect(received.messages).toEqual([SAMPLE]);
    expect(received.errors).toEqual([]);
  });

  it("delivers two messages arriving in one chunk", () => {
    const received = collect();
    const first = encodeFrame(SAMPLE);
    const second = encodeFrame({ id: 7, jsonrpc: "2.0", result: null });
    const both = new Uint8Array(first.byteLength + second.byteLength);
    both.set(first);
    both.set(second, first.byteLength);
    received.push(both);
    expect(received.messages).toHaveLength(2);
  });

  it("reassembles a frame split at every kind of boundary", () => {
    const frame = encodeFrame({
      id: 1,
      jsonrpc: "2.0",
      method: "x",
      params: "текст-з-крапками",
    });
    for (const splitAt of [1, 5, 25, frame.byteLength - 3]) {
      const received = collect();
      received.push(frame.subarray(0, splitAt));
      received.push(frame.subarray(splitAt));
      expect(received.messages).toHaveLength(1);
      expect(received.errors).toEqual([]);
    }
  });

  it("reassembles a frame fed byte by byte", () => {
    const received = collect();
    const frame = encodeFrame(SAMPLE);
    for (let index = 0; index < frame.byteLength; index += 1) {
      received.push(frame.subarray(index, index + 1));
    }
    expect(received.messages).toEqual([SAMPLE]);
  });
});

describe("createDecoder garbage resync", () => {
  it("resyncs after garbage that precedes a valid frame", () => {
    const received = collect();
    const garbage = new TextEncoder().encode("not-a-header\r\njunk\r\n\r\n");
    received.push(garbage);
    received.push(encodeFrame(SAMPLE));
    expect(received.messages).toEqual([SAMPLE]);
    expect(received.errors.length).toBeGreaterThan(0);
  });

  it("reports a non-object JSON body instead of delivering it", () => {
    const received = collect();
    received.push(rawFrame("3"));
    received.push(rawFrame("[1, 2]"));
    received.push(encodeFrame(SAMPLE));
    expect(received.messages).toEqual([SAMPLE]);
    expect(received.errors).toEqual([
      "non-object body: 3",
      "non-object body: [1, 2]",
    ]);
  });

  it("reports an unparseable JSON body instead of delivering it", () => {
    const received = collect();
    received.push(rawFrame('{"broken'));
    received.push(rawFrame("]not json["));
    received.push(encodeFrame(SAMPLE));
    expect(received.messages).toEqual([SAMPLE]);
    expect(received.errors).toEqual([
      'unparseable body: {"broken',
      "unparseable body: ]not json[",
    ]);
  });

  it("resyncs past a malformed Content-Length value without hanging", () => {
    const received = collect();
    const garbage = new TextEncoder().encode("Content-Length: abc\r\n\r\n");
    received.push(garbage);
    received.push(encodeFrame(SAMPLE));
    expect(received.messages).toEqual([SAMPLE]);
    expect(received.errors.length).toBeGreaterThan(0);
  });

  it("survives garbage with no valid frame behind it", () => {
    const received = collect();
    received.push(new TextEncoder().encode("total garbage"));
    expect(received.messages).toEqual([]);
    expect(received.errors.length).toBeGreaterThan(0);
  });
});

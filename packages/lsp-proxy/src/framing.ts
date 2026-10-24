import { Buffer } from "node:buffer";

import { isRecord, safeJsonParse } from "./guards/index.ts";
import type { JsonRpcMessage } from "./types/index.ts";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const HEADER_SEPARATOR = "\r\n\r\n";

const CONTENT_LENGTH_MARKER = "Content-Length:";
const MARKER_BYTES = Buffer.from(CONTENT_LENGTH_MARKER);
const CONTENT_LENGTH_PATTERN = /Content-Length:\s*(?<length>\d+)/iu;
const PREVIEW_CHARS = 60;

export type { JsonRpcError, JsonRpcMessage } from "./types/index.ts";

const asBuffer = (chunk: Uint8Array): Buffer => {
  if (Buffer.isBuffer(chunk)) {
    return chunk;
  }
  return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
};

function preview(buffer: Buffer): string {
  return textDecoder.decode(buffer).slice(0, PREVIEW_CHARS);
}

function deliverBody(
  body: Buffer,
  onMessage: (message: JsonRpcMessage) => void,
  report: (reason: string) => void,
): void {
  const text = textDecoder.decode(body);
  const parsed = safeJsonParse(text);
  if (parsed === undefined) {
    report(`unparseable body: ${text.slice(0, PREVIEW_CHARS)}`);
    return;
  }
  if (!isRecord(parsed)) {
    report(`non-object body: ${text.slice(0, PREVIEW_CHARS)}`);
    return;
  }
  onMessage(parsed as unknown as JsonRpcMessage);
}

function isMarkerPrefix(buffer: Buffer<ArrayBufferLike>): boolean {
  const limit = Math.min(buffer.byteLength, MARKER_BYTES.byteLength);
  return buffer.subarray(0, limit).equals(MARKER_BYTES.subarray(0, limit));
}

function extractFrame(
  buffer: Buffer<ArrayBufferLike>,
  onMessage: (message: JsonRpcMessage) => void,
  report: (reason: string) => void,
): Buffer<ArrayBufferLike> | null {
  const headerEnd = buffer.indexOf(HEADER_SEPARATOR);
  if (headerEnd === -1) {
    if (buffer.byteLength > 0 && !isMarkerPrefix(buffer)) {
      report(`malformed header: ${preview(buffer)}`);
      return Buffer.alloc(0);
    }
    return null;
  }
  const headerText = buffer.toString("utf8", 0, headerEnd);
  const match = CONTENT_LENGTH_PATTERN.exec(headerText);
  if (match === null) {
    report(`malformed header: ${headerText.slice(0, PREVIEW_CHARS)}`);
    const tail = buffer.subarray(headerEnd);
    const marker = tail.indexOf(CONTENT_LENGTH_MARKER);
    if (marker === -1) {
      return Buffer.alloc(0);
    }
    return buffer.subarray(headerEnd + marker);
  }
  const bodyStart = headerEnd + HEADER_SEPARATOR.length;
  const bodyEnd = bodyStart + Number(match.groups?.length);
  if (buffer.byteLength < bodyEnd) {
    return null;
  }
  deliverBody(buffer.subarray(bodyStart, bodyEnd), onMessage, report);
  return buffer.subarray(bodyEnd);
}

function extractFrames(
  buffer: Buffer<ArrayBufferLike>,
  onMessage: (message: JsonRpcMessage) => void,
  report: (reason: string) => void,
): Buffer<ArrayBufferLike> {
  let rest = buffer;
  for (;;) {
    const stepped = extractFrame(rest, onMessage, report);
    if (stepped === null) {
      return rest;
    }
    rest = stepped;
  }
}

export function encodeFrame(message: JsonRpcMessage): Uint8Array {
  const body = textEncoder.encode(JSON.stringify(message));
  const header = textEncoder.encode(
    `Content-Length: ${body.byteLength}${HEADER_SEPARATOR}`,
  );
  const frame = new Uint8Array(header.byteLength + body.byteLength);
  frame.set(header);
  frame.set(body, header.byteLength);
  return frame;
}

export function createDecoder(
  onMessage: (message: JsonRpcMessage) => void,
  onError?: (reason: string) => void,
): (chunk: Uint8Array) => void {
  let buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  const report = (reason: string): void => {
    if (onError !== undefined) {
      onError(reason);
    }
  };
  return (chunk: Uint8Array) => {
    const merged = Buffer.concat([buffer, asBuffer(chunk)]);
    buffer = extractFrames(merged, onMessage, report);
  };
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const HEADER_SEPARATOR = textEncoder.encode("\r\n\r\n");
const CONTENT_LENGTH_MARKER = textEncoder.encode("Content-Length:");
const CONTENT_LENGTH_PATTERN = /Content-Length:\s*(\d+)/i;

export interface JsonRpcError {
  code: number;
  data?: unknown;
  message: string;
}

export interface JsonRpcMessage {
  error?: JsonRpcError;
  id?: number | string | null;
  jsonrpc: "2.0";
  method?: string;
  params?: unknown;
  result?: unknown;
}

function matchesAt(
  haystack: Uint8Array,
  needle: Uint8Array,
  start: number,
): boolean {
  for (let offset = 0; offset < needle.byteLength; offset += 1) {
    if (haystack[start + offset] !== needle[offset]) {
      return false;
    }
  }
  return true;
}

function indexOfSequence(haystack: Uint8Array, needle: Uint8Array): number {
  const lastStart = haystack.byteLength - needle.byteLength;
  for (let start = 0; start <= lastStart; start += 1) {
    if (matchesAt(haystack, needle, start)) {
      return start;
    }
  }
  return -1;
}

function isMarkerPrefix(buffer: Uint8Array): boolean {
  const limit = Math.min(buffer.byteLength, CONTENT_LENGTH_MARKER.byteLength);
  for (let offset = 0; offset < limit; offset += 1) {
    if (buffer[offset] !== CONTENT_LENGTH_MARKER[offset]) {
      return false;
    }
  }
  return true;
}

const preview = (buffer: Uint8Array) => textDecoder.decode(buffer).slice(0, 60);

function deliverBody(
  body: Uint8Array,
  onMessage: (message: JsonRpcMessage) => void,
  report: (reason: string) => void,
): void {
  const text = textDecoder.decode(body);
  try {
    onMessage(JSON.parse(text) as JsonRpcMessage);
  } catch {
    report(`unparseable body: ${text.slice(0, 60)}`);
  }
}

function extractFrame(
  buffer: Uint8Array,
  onMessage: (message: JsonRpcMessage) => void,
  report: (reason: string) => void,
): Uint8Array | null {
  const headerEnd = indexOfSequence(buffer, HEADER_SEPARATOR);
  if (headerEnd === -1) {
    if (buffer.byteLength > 0 && !isMarkerPrefix(buffer)) {
      report(`malformed header: ${preview(buffer)}`);
      return new Uint8Array(0);
    }
    return null;
  }
  const headerText = textDecoder.decode(buffer.subarray(0, headerEnd));
  const match = CONTENT_LENGTH_PATTERN.exec(headerText);
  if (match === null) {
    report(`malformed header: ${headerText.slice(0, 60)}`);
    const tail = buffer.subarray(headerEnd);
    const marker = indexOfSequence(tail, CONTENT_LENGTH_MARKER);
    if (marker === -1) {
      return new Uint8Array(0);
    }
    return buffer.subarray(headerEnd + marker);
  }
  const bodyStart = headerEnd + HEADER_SEPARATOR.byteLength;
  const bodyEnd = bodyStart + Number(match[1]);
  if (buffer.byteLength < bodyEnd) {
    return null;
  }
  deliverBody(buffer.subarray(bodyStart, bodyEnd), onMessage, report);
  return buffer.subarray(bodyEnd);
}

function extractFrames(
  buffer: Uint8Array,
  onMessage: (message: JsonRpcMessage) => void,
  report: (reason: string) => void,
): Uint8Array {
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
    `Content-Length: ${body.byteLength}\r\n\r\n`,
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
  let buffer: Uint8Array = new Uint8Array(0);
  const report = (reason: string): void => {
    if (onError !== undefined) {
      onError(reason);
    }
  };
  return (chunk: Uint8Array) => {
    const merged = new Uint8Array(buffer.byteLength + chunk.byteLength);
    merged.set(buffer);
    merged.set(chunk, buffer.byteLength);
    buffer = extractFrames(merged, onMessage, report);
  };
}

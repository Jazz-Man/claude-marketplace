import type { ContentChange, Position } from "./docstore.ts";
import { isRecord } from "./guards/index.ts";

function isPosition(value: unknown): value is Position {
  return (
    isRecord(value) &&
    typeof value.character === "number" &&
    typeof value.line === "number"
  );
}

function isRange(value: unknown): value is ContentChange["range"] {
  return isRecord(value) && isPosition(value.end) && isPosition(value.start);
}

function changeOf(change: unknown): ContentChange | undefined {
  if (!isRecord(change) || typeof change.text !== "string") {
    return undefined;
  }
  if (change.range === undefined) {
    return { text: change.text };
  }
  if (!isRange(change.range)) {
    return undefined;
  }
  return { range: change.range, text: change.text };
}

export function uriOf(params: unknown): string {
  if (!isRecord(params)) {
    return "";
  }
  const { textDocument } = params;
  if (isRecord(textDocument) && typeof textDocument.uri === "string") {
    return textDocument.uri;
  }
  if (typeof params.uri === "string") {
    return params.uri;
  }
  return "";
}

export function textDocumentOf(params: unknown): { uri: string } {
  return { uri: uriOf(params) };
}

export function changesOf(params: unknown): ContentChange[] {
  if (!isRecord(params)) {
    return [];
  }
  if (!Array.isArray(params.contentChanges)) {
    return [];
  }
  const changes: ContentChange[] = [];
  for (const change of params.contentChanges) {
    const parsed = changeOf(change);
    if (parsed !== undefined) {
      changes.push(parsed);
    }
  }
  return changes;
}

export function cancelIdOf(params: unknown): number | string | undefined {
  if (!isRecord(params)) {
    return undefined;
  }
  const { id } = params;
  if (typeof id === "number" || typeof id === "string") {
    return id;
  }
  return undefined;
}

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

function textDocumentRecordOf(
  params: unknown,
): Record<string, unknown> | undefined {
  if (!isRecord(params)) {
    return undefined;
  }
  const { textDocument } = params;
  return isRecord(textDocument) ? textDocument : undefined;
}

export function uriOf(params: unknown): string {
  const textDocument = textDocumentRecordOf(params);
  if (textDocument !== undefined && typeof textDocument.uri === "string") {
    return textDocument.uri;
  }
  if (isRecord(params) && typeof params.uri === "string") {
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

export function openOf(
  params: unknown,
): { languageId: string; text: string } | undefined {
  const fields = textDocumentRecordOf(params);
  if (fields === undefined) {
    return undefined;
  }
  const { languageId = "", text = "" } = fields;
  if (typeof languageId !== "string" || typeof text !== "string") {
    return undefined;
  }
  return { languageId, text };
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

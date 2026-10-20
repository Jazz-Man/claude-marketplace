import type { JsonRpcError } from "./framing.ts";

const ARRAY_MERGE_METHODS = new Set([
  "textDocument/definition",
  "textDocument/references",
  "textDocument/documentSymbol",
  "textDocument/codeAction",
]);

const SERVER_TAG = "__lspProxyServer";

export interface MergeOutcome {
  error?: JsonRpcError;
  result?: unknown;
}

export interface ServerOutcome {
  error?: JsonRpcError;
  result?: unknown;
  server: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(result: unknown): unknown[] {
  if (Array.isArray(result)) {
    return result;
  }
  if (result === null || result === undefined) {
    return [];
  }
  return [result];
}

function ordered<T extends { server: string }>(
  outcomes: T[],
  priority: string[],
): T[] {
  return [...outcomes].sort(
    (left, right) =>
      (priority.indexOf(left.server) + 1 || priority.length + 1) -
      (priority.indexOf(right.server) + 1 || priority.length + 1),
  );
}

function firstError(
  outcomes: ServerOutcome[],
  priority: string[],
): JsonRpcError | undefined {
  const errored = ordered(
    outcomes.filter((outcome) => outcome.error !== undefined),
    priority,
  );
  const [first] = errored;
  return first?.error;
}

function completionOf(result: unknown): {
  incomplete: boolean;
  items: unknown[];
} {
  if (Array.isArray(result)) {
    return { incomplete: false, items: result };
  }
  if (isRecord(result) && Array.isArray(result.items)) {
    return {
      incomplete: result.isIncomplete === true,
      items: result.items as unknown[],
    };
  }
  return { incomplete: false, items: [] };
}

function mergeCompletion(outcomes: ServerOutcome[]): unknown {
  const items: unknown[] = [];
  let isIncomplete = false;
  for (const outcome of outcomes) {
    const { incomplete, items: serverItems } = completionOf(outcome.result);
    if (incomplete) {
      isIncomplete = true;
    }
    for (const item of serverItems) {
      items.push(item);
    }
  }
  return { isIncomplete, items };
}

function markdownContents(outcome: ServerOutcome): unknown {
  if (isRecord(outcome.result) && isRecord(outcome.result.contents)) {
    return outcome.result.contents;
  }
  return undefined;
}

function mergeHover(outcomes: ServerOutcome[], priority: string[]): unknown {
  const hovers = ordered(
    outcomes.filter(
      (outcome) => outcome.result !== null && outcome.result !== undefined,
    ),
    priority,
  );
  const [first] = hovers;
  if (first === undefined) {
    return null;
  }
  const contents = hovers.map(markdownContents);
  if (contents.every((entry) => isRecord(entry) && entry.kind === "markdown")) {
    const value = contents
      .map((entry) => (entry as { value: string }).value)
      .join("\n\n");
    return { contents: { kind: "markdown", value } };
  }
  return first.result;
}

function firstNonNull(outcomes: ServerOutcome[], priority: string[]): unknown {
  for (const outcome of ordered(outcomes, priority)) {
    if (
      outcome.error === undefined &&
      outcome.result !== null &&
      outcome.result !== undefined
    ) {
      return outcome.result;
    }
  }
  return null;
}

function mergeTaggedArrays(
  successes: ServerOutcome[],
  priority: string[],
): unknown[] {
  const merged: unknown[] = [];
  for (const outcome of ordered(successes, priority)) {
    for (const item of asArray(outcome.result)) {
      merged.push(tagCodeAction(item, outcome.server));
    }
  }
  return merged;
}

function mergePlainArrays(
  successes: ServerOutcome[],
  priority: string[],
): unknown[] {
  const merged: unknown[] = [];
  for (const outcome of ordered(successes, priority)) {
    for (const item of asArray(outcome.result)) {
      merged.push(item);
    }
  }
  return merged;
}

export function tagCodeAction(action: unknown, server: string): unknown {
  if (typeof action !== "object" || action === null) {
    return action;
  }
  const record = action as Record<string, unknown>;
  let data: Record<string, unknown> = { [SERVER_TAG]: server };
  if (isRecord(record.data)) {
    data = { ...record.data, [SERVER_TAG]: server };
  }
  return { ...record, data };
}

export function originOfCodeAction(action: unknown): string | undefined {
  if (!(isRecord(action) && isRecord(action.data))) {
    return undefined;
  }
  const origin = action.data[SERVER_TAG];
  if (typeof origin === "string") {
    return origin;
  }
  return undefined;
}

export function mergeOutcomes(
  method: string,
  outcomes: ServerOutcome[],
  priority: string[],
): MergeOutcome {
  const successes = outcomes.filter(
    (outcome) => outcome.error === undefined && outcome.result !== undefined,
  );
  if (successes.length === 0) {
    const error = firstError(outcomes, priority);
    if (error === undefined) {
      return { result: null };
    }
    return { error };
  }
  if (method === "textDocument/completion") {
    return { result: mergeCompletion(outcomes) };
  }
  if (method === "textDocument/hover") {
    return { result: mergeHover(outcomes, priority) };
  }
  if (method === "textDocument/codeAction") {
    return { result: mergeTaggedArrays(successes, priority) };
  }
  if (ARRAY_MERGE_METHODS.has(method)) {
    return { result: mergePlainArrays(successes, priority) };
  }
  return { result: firstNonNull(outcomes, priority) };
}

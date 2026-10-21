import type { ServerCapabilities } from "./router.ts";

const PROVIDER_KEYS = [
  "codeActionProvider",
  "completionProvider",
  "definitionProvider",
  "documentFormattingProvider",
  "documentRangeFormattingProvider",
  "documentSymbolProvider",
  "hoverProvider",
  "referencesProvider",
];

export interface CapabilitiesInput {
  capabilities: ServerCapabilities;
  server: string;
}

export interface CapabilitiesMerge {
  merged: ServerCapabilities;
  rejected: { reason: string; server: string }[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function reportsIncremental(sync: unknown): boolean {
  if (sync === 2) {
    return true;
  }
  return isRecord(sync) && sync.change === 2;
}

function describeSync(sync: unknown): string {
  if (isRecord(sync)) {
    return JSON.stringify(sync);
  }
  return String(sync);
}

function mergedProviderValue(
  accepted: CapabilitiesInput[],
  key: string,
): unknown {
  let firstObject: unknown;
  let sawFalse = false;
  let sawTrue = false;
  for (const input of accepted) {
    const value = input.capabilities[key];
    if (value !== undefined) {
      if (typeof value === "boolean") {
        sawFalse = sawFalse || !value;
        sawTrue = sawTrue || value;
      } else if (firstObject === undefined) {
        firstObject = value;
      }
    }
  }
  if (firstObject !== undefined) {
    return firstObject;
  }
  if (sawTrue) {
    return true;
  }
  if (sawFalse) {
    return false;
  }
  return undefined;
}

export function mergeCapabilities(
  inputs: CapabilitiesInput[],
  priority: string[],
): CapabilitiesMerge {
  const orderedInputs = [...inputs].sort(
    (left, right) =>
      priority.indexOf(left.server) - priority.indexOf(right.server),
  );
  const accepted = orderedInputs.filter((input) =>
    reportsIncremental(input.capabilities.textDocumentSync),
  );
  const rejected = orderedInputs
    .filter((input) => !reportsIncremental(input.capabilities.textDocumentSync))
    .map((input) => ({
      reason: `textDocumentSync must be 2 (incremental), got ${describeSync(
        input.capabilities.textDocumentSync,
      )}`,
      server: input.server,
    }));
  const merged: ServerCapabilities = { textDocumentSync: 2 };
  for (const key of PROVIDER_KEYS) {
    const value = mergedProviderValue(accepted, key);
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  return { merged, rejected };
}

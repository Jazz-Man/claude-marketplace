import { isRecord } from "./guards/index.ts";
import { METHOD_CAPABILITIES } from "./methods/index.ts";
import type { ServerCapabilities } from "./router.ts";
import { sortByPriority } from "./utils/index.ts";

interface CapabilitiesInput {
  capabilities: ServerCapabilities;
  server: string;
}

interface CapabilitiesMerge {
  merged: ServerCapabilities;
  rejected: { reason: string; server: string }[];
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
  const orderedInputs = sortByPriority(inputs, priority);
  const accepted: CapabilitiesInput[] = [];
  const failed: CapabilitiesInput[] = [];
  for (const input of orderedInputs) {
    if (reportsIncremental(input.capabilities.textDocumentSync)) {
      accepted.push(input);
    } else {
      failed.push(input);
    }
  }
  const rejected = failed.map((input) => ({
    reason: `textDocumentSync must be 2 (incremental), got ${describeSync(
      input.capabilities.textDocumentSync,
    )}`,
    server: input.server,
  }));
  const merged: ServerCapabilities = { textDocumentSync: 2 };
  for (const key of METHOD_CAPABILITIES) {
    const value = mergedProviderValue(accepted, key);
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  return { merged, rejected };
}

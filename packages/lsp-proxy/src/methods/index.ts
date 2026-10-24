function compareUtf16(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

const NOTIFICATION_POLICY: MethodPolicy = {
  capability: "",
  isDocumentNotification: false,
  isSingleResult: false,
  merge: "firstNonNull",
  triggersPull: false,
};

export type MergePolicy =
  | "array"
  | "completion"
  | "hover"
  | "firstNonNull"
  | "sequential";

export interface MethodPolicy {
  readonly capability: string;
  readonly isDocumentNotification: boolean;
  readonly isSingleResult: boolean;
  readonly merge: MergePolicy;
  readonly triggersPull: boolean;
}

export const METHODS: Record<string, MethodPolicy> = {
  "codeAction/resolve": {
    ...NOTIFICATION_POLICY,
    capability: "codeActionProvider",
    merge: "firstNonNull",
  },
  "textDocument/codeAction": {
    ...NOTIFICATION_POLICY,
    capability: "codeActionProvider",
    merge: "array",
  },
  "textDocument/completion": {
    ...NOTIFICATION_POLICY,
    capability: "completionProvider",
    merge: "completion",
  },
  "textDocument/definition": {
    ...NOTIFICATION_POLICY,
    capability: "definitionProvider",
    merge: "array",
  },
  "textDocument/didChange": {
    ...NOTIFICATION_POLICY,
    isDocumentNotification: true,
    triggersPull: true,
  },
  "textDocument/didClose": {
    ...NOTIFICATION_POLICY,
    isDocumentNotification: true,
  },
  "textDocument/didOpen": {
    ...NOTIFICATION_POLICY,
    isDocumentNotification: true,
    triggersPull: true,
  },
  "textDocument/didSave": {
    ...NOTIFICATION_POLICY,
    isDocumentNotification: true,
  },
  "textDocument/documentSymbol": {
    ...NOTIFICATION_POLICY,
    capability: "documentSymbolProvider",
    merge: "array",
  },
  "textDocument/formatting": {
    ...NOTIFICATION_POLICY,
    capability: "documentFormattingProvider",
    isSingleResult: true,
    merge: "sequential",
  },
  "textDocument/hover": {
    ...NOTIFICATION_POLICY,
    capability: "hoverProvider",
    merge: "hover",
  },
  "textDocument/rangeFormatting": {
    ...NOTIFICATION_POLICY,
    capability: "documentRangeFormattingProvider",
    isSingleResult: true,
    merge: "sequential",
  },
  "textDocument/references": {
    ...NOTIFICATION_POLICY,
    capability: "referencesProvider",
    merge: "array",
  },
};

export const METHOD_CAPABILITIES = [
  ...new Set(
    Object.values(METHODS)
      .map((policy) => policy.capability)
      .filter((capability) => capability !== ""),
  ),
].toSorted(compareUtf16);

export const METHOD_NAMES = Object.keys(METHODS);

export function policyFor(method: string): MethodPolicy | undefined {
  return METHODS[method];
}

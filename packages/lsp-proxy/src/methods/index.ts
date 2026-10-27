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

function requestPolicy(capability: string, merge: MergePolicy): MethodPolicy {
  return { ...NOTIFICATION_POLICY, capability, merge };
}

function singleResultPolicy(capability: string): MethodPolicy {
  return {
    ...NOTIFICATION_POLICY,
    capability,
    isSingleResult: true,
    merge: "sequential",
  };
}

export const METHODS: Record<string, MethodPolicy> = {
  "codeAction/resolve": requestPolicy("codeActionProvider", "firstNonNull"),
  "textDocument/codeAction": requestPolicy("codeActionProvider", "array"),
  "textDocument/completion": requestPolicy("completionProvider", "completion"),
  "textDocument/definition": requestPolicy("definitionProvider", "array"),
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
  "textDocument/documentSymbol": requestPolicy(
    "documentSymbolProvider",
    "array",
  ),
  "textDocument/formatting": singleResultPolicy("documentFormattingProvider"),
  "textDocument/hover": requestPolicy("hoverProvider", "hover"),
  "textDocument/rangeFormatting": singleResultPolicy(
    "documentRangeFormattingProvider",
  ),
  "textDocument/references": requestPolicy("referencesProvider", "array"),
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

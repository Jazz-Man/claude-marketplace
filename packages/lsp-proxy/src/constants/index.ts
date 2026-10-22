export const LspErrorCode = {
  InternalError: -32_603,
  MethodNotFound: -32_601,
  RequestCancelled: -32_800,
  ServerNotInitialized: -32_002,
} as const;

export const SyncKind = {
  Incremental: 2,
} as const;

export const TimeoutMs = {
  initialize: 30_000,
  request: 15_000,
} as const;

export const VERSION = "0.1.0";

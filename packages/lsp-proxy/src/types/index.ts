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

export type ServerCapabilities = Record<string, unknown>;

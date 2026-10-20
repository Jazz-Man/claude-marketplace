export interface PendingEntry {
  clientId: number | string;
  method: string;
  server: string;
  serverId: number;
  uri?: string;
}

export class RequestMux {
  private readonly nextId = new Map<string, number>();
  private readonly byServer = new Map<string, Map<number, PendingEntry>>();
  private readonly byClient = new Map<number | string, Map<string, number>>();

  assign(
    clientId: number | string,
    server: string,
    method: string,
    uri?: string,
  ): number {
    const serverId = (this.nextId.get(server) ?? 0) + 1;
    this.nextId.set(server, serverId);
    const entry: PendingEntry = { clientId, method, server, serverId };
    if (uri !== undefined) {
      entry.uri = uri;
    }
    const serverMap =
      this.byServer.get(server) ?? new Map<number, PendingEntry>();
    serverMap.set(serverId, entry);
    this.byServer.set(server, serverMap);
    const clientMap = this.byClient.get(clientId) ?? new Map<string, number>();
    clientMap.set(server, serverId);
    this.byClient.set(clientId, clientMap);
    return serverId;
  }

  lookup(server: string, serverId: number): PendingEntry | undefined {
    return this.byServer.get(server)?.get(serverId);
  }

  release(entry: PendingEntry): void {
    this.byServer.get(entry.server)?.delete(entry.serverId);
    this.byClient.get(entry.clientId)?.delete(entry.server);
  }

  clientPending(
    clientId: number | string,
  ): { server: string; serverId: number }[] {
    const entries = [...(this.byClient.get(clientId)?.entries() ?? [])];
    return entries.map(([server, serverId]) => ({ server, serverId }));
  }
}

export interface PeerDiagnostic {
  readonly address: string;
  readonly databaseConnected: boolean;
  readonly error: string | null;
  readonly lastSeenAt: string | null;
  readonly latencyMs: number | null;
  readonly port: number;
  readonly reachable: boolean;
  readonly userId: string;
  readonly username: string;
}

export interface NetworkDiagnosticReport {
  readonly discoveryPort: number;
  readonly generatedAt: string;
  readonly localAddress: string | null;
  readonly localTcpPort: number | null;
  readonly localUser: string | null;
  readonly localUserId: string | null;
  readonly peers: readonly PeerDiagnostic[];
}

/**
 * Network domain types.
 * Represents peers, connections, and network events.
 */

import type { ConnectionStatus, ISODateString, UUID } from "./common";

/** Network peer discovered on LAN */
export interface Peer {
  readonly address: string;
  readonly createdAt: ISODateString;
  readonly id: UUID;
  readonly isConnected: boolean;
  readonly lastSeenAt: ISODateString | null;
  readonly port: number;
  readonly updatedAt: ISODateString;
  readonly userId: UUID;
  readonly username: string;
}

/** Peer with connection details */
export interface PeerWithConnection extends Peer {
  readonly connectedAt: ISODateString | null;
  readonly connectionStatus: ConnectionStatus;
  readonly latencyMs: number | null;
}

/** Discovery service configuration */
export interface DiscoveryConfig {
  readonly instanceId: UUID;
  readonly port: number;
  readonly serviceName: string;
  readonly serviceType: string;
}

/** Network event types */
export type NetworkEventType =
  | "peer_discovered"
  | "peer_connected"
  | "peer_disconnected"
  | "peer_lost"
  | "connection_error"
  | "message_received"
  | "file_request"
  | "file_chunk";

/** Base network event */
export interface NetworkEvent {
  readonly peerId: UUID;
  readonly timestamp: ISODateString;
  readonly type: NetworkEventType;
}

/** Peer discovered event */
export interface PeerDiscoveredEvent extends NetworkEvent {
  readonly peer: Peer;
  readonly type: "peer_discovered";
}

/** Peer connected event */
export interface PeerConnectedEvent extends NetworkEvent {
  readonly peer: Peer;
  readonly type: "peer_connected";
}

/** Peer disconnected event */
export interface PeerDisconnectedEvent extends NetworkEvent {
  readonly reason: string | null;
  readonly type: "peer_disconnected";
}

/** Connection error event */
export interface ConnectionErrorEvent extends NetworkEvent {
  readonly error: string;
  readonly isRecoverable: boolean;
  readonly type: "connection_error";
}

/** Message received over network */
export interface NetworkMessage {
  readonly id: UUID;
  readonly payload: unknown;
  readonly senderId: UUID;
  readonly timestamp: ISODateString;
  readonly type: NetworkMessageType;
}

/** Network message types */
export type NetworkMessageType =
  | "chat_message"
  | "message_edit"
  | "message_delete"
  | "reaction"
  | "typing_indicator"
  | "presence"
  | "file_metadata"
  | "file_request"
  | "file_chunk"
  | "file_complete"
  | "user_info"
  | "sync_request"
  | "sync_response";

/** File transfer request */
export interface FileTransferRequest {
  readonly attachmentId: UUID;
  readonly requesterId: UUID;
  readonly requestId: UUID;
  readonly timestamp: ISODateString;
}

/** File chunk for streaming */
export interface FileChunk {
  readonly attachmentId: UUID;
  readonly checksum: string;
  readonly chunkIndex: number;
  readonly data: Uint8Array;
  readonly totalChunks: number;
  readonly transferId: UUID;
}

/** Network statistics */
export interface NetworkStats {
  readonly activeTransfers: number;
  readonly connectedPeers: number;
  readonly totalBytesReceived: number;
  readonly totalBytesSent: number;
  readonly uptime: number;
}

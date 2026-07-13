/**
 * Network state management using Zustand.
 * Handles peer connections and network status.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  ConnectionStatus,
  NetworkStats,
  Peer,
  UUID,
} from "@/shared/types";

interface NetworkState {
  /** Overall connection status */
  readonly connectionStatus: ConnectionStatus;
  /** Error state */
  readonly error: string | null;
  /** Discovery running state */
  readonly isDiscoveryRunning: boolean;
  /** Local network address */
  readonly localAddress: string | null;
  /** Local port */
  readonly localPort: number | null;
  /** Map of peers by ID */
  readonly peers: ReadonlyMap<UUID, Peer>;
  /** Network statistics */
  readonly stats: NetworkStats | null;
}

interface NetworkActions {
  /** Remove a peer */
  removePeer: (peerId: UUID) => void;
  /** Reset store */
  reset: () => void;
  /** Set connection status */
  setConnectionStatus: (status: ConnectionStatus) => void;
  /** Set discovery state */
  setDiscoveryRunning: (isRunning: boolean) => void;
  /** Set error */
  setError: (error: string | null) => void;
  /** Set local address info */
  setLocalAddress: (address: string, port: number) => void;
  /** Add or update a peer */
  setPeer: (peer: Peer) => void;
  /** Add multiple peers */
  setPeers: (peers: readonly Peer[]) => void;
  /** Update network stats */
  setStats: (stats: NetworkStats) => void;
  /** Update peer connection status */
  updatePeerConnection: (peerId: UUID, isConnected: boolean) => void;
}

type NetworkStore = NetworkState & NetworkActions;

const initialState: NetworkState = {
  connectionStatus: "disconnected",
  error: null,
  isDiscoveryRunning: false,
  localAddress: null,
  localPort: null,
  peers: new Map(),
  stats: null,
};

export const useNetworkStore = create<NetworkStore>()(
  devtools(
    (set) => ({
      ...initialState,

      removePeer: (peerId) => {
        set(
          (state) => {
            const newPeers = new Map(state.peers);
            newPeers.delete(peerId);
            return { peers: newPeers };
          },
          false,
          "removePeer"
        );
      },

      reset: () => {
        set(initialState, false, "reset");
      },

      setConnectionStatus: (status) => {
        set({ connectionStatus: status }, false, "setConnectionStatus");
      },

      setDiscoveryRunning: (isRunning) => {
        set({ isDiscoveryRunning: isRunning }, false, "setDiscoveryRunning");
      },

      setError: (error) => {
        set({ error }, false, "setError");
      },

      setLocalAddress: (address, port) => {
        set(
          { localAddress: address, localPort: port },
          false,
          "setLocalAddress"
        );
      },

      setPeer: (peer) => {
        set(
          (state) => ({
            peers: new Map(state.peers).set(peer.id, peer),
          }),
          false,
          "setPeer"
        );
      },

      setPeers: (peers) => {
        set(
          (state) => {
            const newPeers = new Map(state.peers);
            peers.forEach((peer) => newPeers.set(peer.id, peer));
            return { peers: newPeers };
          },
          false,
          "setPeers"
        );
      },

      setStats: (stats) => {
        set({ stats }, false, "setStats");
      },

      updatePeerConnection: (peerId, isConnected) => {
        set(
          (state) => {
            const peer = state.peers.get(peerId);
            if (peer) {
              const newPeers = new Map(state.peers);
              newPeers.set(peerId, { ...peer, isConnected });
              return { peers: newPeers };
            }
            return state;
          },
          false,
          "updatePeerConnection"
        );
      },
    }),
    { name: "network-store" }
  )
);

/** Selector for all connected peers */
export const selectConnectedPeers = (state: NetworkStore): readonly Peer[] =>
  Array.from(state.peers.values()).filter((peer) => peer.isConnected);

/** Selector for connected peer count */
export const selectConnectedPeerCount = (state: NetworkStore): number =>
  Array.from(state.peers.values()).filter((peer) => peer.isConnected).length;

/** Selector for a specific peer */
export const selectPeer = (peerId: UUID) => (state: NetworkStore) =>
  state.peers.get(peerId);

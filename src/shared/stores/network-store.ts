/**
 * Network state management using Zustand.
 * Handles peer connections and network status.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { ConnectionStatus, UUID } from "@/shared/types/common";
import type { NetworkStats, Peer } from "@/shared/types/network";

interface NetworkState {
  /** Overall connection status */
  connectionStatus: ConnectionStatus;
  /** Error state */
  error: string | null;
  /** Discovery running state */
  isDiscoveryRunning: boolean;
  /** Local network address */
  localAddress: string | null;
  /** Local port */
  localPort: number | null;
  /** Array of peers */
  peers: Peer[];
  /** Network statistics */
  stats: NetworkStats | null;
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
  setPeers: (peers: Peer[]) => void;
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
  peers: [],
  stats: null,
};

export const useNetworkStore = create<NetworkStore>()(
  devtools(
    (set) => ({
      ...initialState,

      removePeer: (peerId) => {
        set(
          (state) => ({
            peers: state.peers.filter((p) => p.id !== peerId),
          }),
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
          (state) => {
            const index = state.peers.findIndex((p) => p.id === peer.id);
            if (index >= 0) {
              const newPeers = [...state.peers];
              newPeers[index] = peer;
              return { peers: newPeers };
            }
            return { peers: [...state.peers, peer] };
          },
          false,
          "setPeer"
        );
      },

      setPeers: (peers) => {
        set({ peers }, false, "setPeers");
      },

      setStats: (stats) => {
        set({ stats }, false, "setStats");
      },

      updatePeerConnection: (peerId, isConnected) => {
        set(
          (state) => ({
            peers: state.peers.map((peer) =>
              peer.id === peerId ? { ...peer, isConnected } : peer
            ),
          }),
          false,
          "updatePeerConnection"
        );
      },
    }),
    { name: "network-store" }
  )
);

/** Selector for connected peer count */
export const selectConnectedPeerCount = (state: NetworkStore): number =>
  state.peers.filter((peer) => peer.isConnected).length;

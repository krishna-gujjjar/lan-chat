/**
 * Hook to listen for Tauri backend events and sync to stores.
 */

import { useEffect } from "react";
import { listenToEvent } from "@/shared/lib/tauri/events";
import { useMessageStore } from "@/shared/stores/message-store";
import { useNetworkStore } from "@/shared/stores/network-store";
import { useUserStore } from "@/shared/stores/user-store";

export function useTauriEvents() {
  const addMessage = useMessageStore((state) => state.addMessage);
  const updateMessage = useMessageStore((state) => state.updateMessage);
  const removeMessage = useMessageStore((state) => state.removeMessage);
  const addReaction = useMessageStore((state) => state.addReaction);
  const setPeer = useNetworkStore((state) => state.setPeer);
  const removePeer = useNetworkStore((state) => state.removePeer);
  const setConnectionStatus = useNetworkStore((state) => state.setConnectionStatus);
  const setUser = useUserStore((state) => state.setUser);
  const setTypingStatus = useUserStore((state) => state.setTypingStatus);
  const clearTypingStatus = useUserStore((state) => state.clearTypingStatus);

  useEffect(() => {
    const unlisteners: Array<() => void> = [];

    // Message events
    listenToEvent("message:created", (payload) => {
      addMessage(payload);
    }).then((fn) => unlisteners.push(fn));

    listenToEvent("message:updated", (payload) => {
      updateMessage(payload.id, payload);
    }).then((fn) => unlisteners.push(fn));

    listenToEvent("message:deleted", (payload) => {
      removeMessage(payload.messageId);
    }).then((fn) => unlisteners.push(fn));

    // Reaction events
    listenToEvent("reaction:added", (payload) => {
      addReaction(payload.messageId, payload);
    }).then((fn) => unlisteners.push(fn));

    // Peer events
    listenToEvent("peer:discovered", (payload) => {
      setPeer(payload);
      setConnectionStatus("connected");
    }).then((fn) => unlisteners.push(fn));

    listenToEvent("peer:connected", (payload) => {
      setPeer({ ...payload, isConnected: true });
      setConnectionStatus("connected");
    }).then((fn) => unlisteners.push(fn));

    listenToEvent("peer:disconnected", (payload) => {
      removePeer(payload.peerId);
    }).then((fn) => unlisteners.push(fn));

    // User events
    listenToEvent("user:updated", (payload) => {
      setUser({
        id: payload.userId,
        username: payload.username,
        avatarPath: payload.avatarPath,
        isLocal: false,
        lastSeenAt: new Date().toISOString() as import("@/shared/types/common").ISODateString,
        createdAt: new Date().toISOString() as import("@/shared/types/common").ISODateString,
        updatedAt: new Date().toISOString() as import("@/shared/types/common").ISODateString,
      });
    }).then((fn) => unlisteners.push(fn));

    // Typing events
    listenToEvent("typing:started", (payload) => {
      setTypingStatus(payload.userId, true);
      setTimeout(() => clearTypingStatus(payload.userId), 3000);
    }).then((fn) => unlisteners.push(fn));

    listenToEvent("typing:stopped", (payload) => {
      clearTypingStatus(payload.userId);
    }).then((fn) => unlisteners.push(fn));

    return () => {
      for (const fn of unlisteners) {
        fn();
      }
    };
  }, [
    addMessage,
    updateMessage,
    removeMessage,
    addReaction,
    setPeer,
    removePeer,
    setConnectionStatus,
    setUser,
    setTypingStatus,
    clearTypingStatus,
  ]);
}

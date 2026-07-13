/**
 * Type-safe Tauri event listener.
 * Provides compile-time type checking for event subscriptions.
 */

import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { DownloadProgress } from "@/shared/types/attachment";
import type { ISODateString, UUID } from "@/shared/types/common";
import type { MessageWithDetails, Reaction } from "@/shared/types/message";
import type { Peer } from "@/shared/types/network";
import type { TypingIndicator } from "@/shared/types/user";

/**
 * Event definitions mapping event names to their payload types.
 */
interface TauriEvents {
  "app:error": { message: string; code: string };

  // App events
  "app:ready": undefined;
  "connection:error": { peerId: UUID; error: string };
  "download:cancelled": { downloadId: UUID };
  "download:completed": { downloadId: UUID; localPath: string };
  "download:failed": { downloadId: UUID; error: string };
  "download:paused": { downloadId: UUID };
  "download:progress": DownloadProgress;
  "download:resumed": { downloadId: UUID };

  // Transfer events
  "download:started": { downloadId: UUID; attachmentId: UUID };
  // Message events
  "message:created": MessageWithDetails;
  "message:deleted": { messageId: UUID };
  "message:updated": MessageWithDetails;
  "peer:connected": Peer;
  "peer:disconnected": { peerId: UUID; reason: string | null };

  // Network events
  "peer:discovered": Peer;
  "peer:lost": { peerId: UUID };
  "reaction:added": Reaction;
  "reaction:removed": { reactionId: UUID; messageId: UUID };
  "settings:changed": { key: string; value: unknown };

  // Typing events
  "typing:started": TypingIndicator;
  "typing:stopped": TypingIndicator;
  "upload:completed": { attachmentId: UUID };
  "upload:failed": { attachmentId: UUID; error: string };
  "upload:progress": { attachmentId: UUID; progress: number };

  // Upload events
  "upload:started": { attachmentId: UUID };
  "user:presence": {
    userId: UUID;
    isOnline: boolean;
    lastSeenAt: ISODateString;
  };

  // User events
  "user:updated": { userId: UUID; username: string; avatarPath: string | null };
}

/** Event names union type */
export type EventName = keyof TauriEvents;

/** Get payload type for an event */
export type EventPayload<T extends EventName> = TauriEvents[T];

/**
 * Type-safe event listener.
 * Returns an unlisten function to remove the listener.
 */
export async function listenToEvent<T extends EventName>(
  event: T,
  handler: (payload: EventPayload<T>) => void
): Promise<UnlistenFn> {
  return listen<EventPayload<T>>(event, (e) => handler(e.payload));
}

/**
 * Type-safe event emitter.
 */
export async function emitEvent<T extends EventName>(
  event: T,
  ...payload: EventPayload<T> extends void ? [] : [EventPayload<T>]
): Promise<void> {
  await emit(event, payload[0]);
}

/**
 * Create a one-time event listener.
 */
export async function onceEvent<T extends EventName>(
  event: T,
  handler: (payload: EventPayload<T>) => void
): Promise<UnlistenFn> {
  let unlisten: UnlistenFn | null = null;
  unlisten = await listen<EventPayload<T>>(event, (e) => {
    handler(e.payload);
    unlisten?.();
  });
  return unlisten;
}

/**
 * Hook for managing multiple event listeners.
 * Call cleanup function to unsubscribe all listeners.
 */
export function createEventManager(): {
  subscribe: <T extends EventName>(
    event: T,
    handler: (payload: EventPayload<T>) => void
  ) => Promise<void>;
  cleanup: () => void;
} {
  const unlisteners: UnlistenFn[] = [];

  return {
    cleanup: () => {
      for (const fn of unlisteners) {
        fn();
      }
      unlisteners.length = 0;
    },
    subscribe: async <T extends EventName>(
      event: T,
      handler: (payload: EventPayload<T>) => void
    ) => {
      const unlisten = await listenToEvent(event, handler);
      unlisteners.push(unlisten);
    },
  };
}

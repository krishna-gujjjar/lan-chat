/**
 * Message state management using Zustand.
 * Handles chat messages with optimistic updates.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { MessageWithDetails, Reaction, UUID } from "@/shared/types";

interface MessageState {
  /** ID of message being edited */
  readonly editingMessageId: UUID | null;
  /** Error state */
  readonly error: string | null;
  readonly hasMore: boolean;
  /** Loading states */
  readonly isLoading: boolean;
  readonly isLoadingMore: boolean;
  /** Ordered list of message IDs */
  readonly messageIds: readonly UUID[];
  /** Map of messages by ID */
  readonly messagesById: ReadonlyMap<UUID, MessageWithDetails>;
  /** ID of message being replied to */
  readonly replyToId: UUID | null;
  /** Search query */
  readonly searchQuery: string;
  /** Search results */
  readonly searchResults: readonly UUID[];
  /** Selected message IDs */
  readonly selectedMessageIds: ReadonlySet<UUID>;
}

interface MessageActions {
  /** Add a new message */
  addMessage: (message: MessageWithDetails) => void;
  /** Add multiple messages (for initial load) */
  addMessages: (messages: readonly MessageWithDetails[]) => void;
  /** Add a reaction to a message */
  addReaction: (messageId: UUID, reaction: Reaction) => void;
  /** Clear message selection */
  clearSelection: () => void;
  /** Prepend messages (for loading older messages) */
  prependMessages: (messages: readonly MessageWithDetails[]) => void;
  /** Remove a message (soft delete) */
  removeMessage: (messageId: UUID) => void;
  /** Remove a reaction from a message */
  removeReaction: (messageId: UUID, reactionId: UUID) => void;
  /** Reset store */
  reset: () => void;
  /** Set editing message */
  setEditingMessage: (messageId: UUID | null) => void;
  /** Set error state */
  setError: (error: string | null) => void;
  /** Set has more state */
  setHasMore: (hasMore: boolean) => void;
  /** Set loading state */
  setLoading: (isLoading: boolean) => void;
  /** Set loading more state */
  setLoadingMore: (isLoadingMore: boolean) => void;
  /** Set reply target */
  setReplyTo: (messageId: UUID | null) => void;
  /** Set search query */
  setSearchQuery: (query: string) => void;
  /** Set search results */
  setSearchResults: (results: readonly UUID[]) => void;
  /** Toggle message selection */
  toggleMessageSelection: (messageId: UUID) => void;
  /** Update an existing message */
  updateMessage: (
    messageId: UUID,
    updates: Partial<MessageWithDetails>
  ) => void;
}

type MessageStore = MessageState & MessageActions;

const initialState: MessageState = {
  editingMessageId: null,
  error: null,
  hasMore: true,
  isLoading: false,
  isLoadingMore: false,
  messageIds: [],
  messagesById: new Map(),
  replyToId: null,
  searchQuery: "",
  searchResults: [],
  selectedMessageIds: new Set(),
};

export const useMessageStore = create<MessageStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      addMessage: (message) => {
        set(
          (state) => ({
            messageIds: [...state.messageIds, message.id],
            messagesById: new Map(state.messagesById).set(message.id, message),
          }),
          false,
          "addMessage"
        );
      },

      addMessages: (messages) => {
        set(
          (state) => {
            const newMap = new Map(state.messagesById);
            const newIds = [...state.messageIds];
            messages.forEach((msg) => {
              if (!newMap.has(msg.id)) {
                newIds.push(msg.id);
              }
              newMap.set(msg.id, msg);
            });
            return { messageIds: newIds, messagesById: newMap };
          },
          false,
          "addMessages"
        );
      },

      addReaction: (messageId, reaction) => {
        const existing = get().messagesById.get(messageId);
        if (existing) {
          set(
            (state) => ({
              messagesById: new Map(state.messagesById).set(messageId, {
                ...existing,
                reactions: [...existing.reactions, reaction],
              }),
            }),
            false,
            "addReaction"
          );
        }
      },

      clearSelection: () => {
        set({ selectedMessageIds: new Set() }, false, "clearSelection");
      },

      prependMessages: (messages) => {
        set(
          (state) => {
            const newMap = new Map(state.messagesById);
            const newIds: UUID[] = [];
            messages.forEach((msg) => {
              if (!newMap.has(msg.id)) {
                newIds.push(msg.id);
              }
              newMap.set(msg.id, msg);
            });
            return {
              messageIds: [...newIds, ...state.messageIds],
              messagesById: newMap,
            };
          },
          false,
          "prependMessages"
        );
      },

      removeMessage: (messageId) => {
        const existing = get().messagesById.get(messageId);
        if (existing) {
          set(
            (state) => ({
              messagesById: new Map(state.messagesById).set(messageId, {
                ...existing,
                content: null,
                isDeleted: true,
              }),
            }),
            false,
            "removeMessage"
          );
        }
      },

      removeReaction: (messageId, reactionId) => {
        const existing = get().messagesById.get(messageId);
        if (existing) {
          set(
            (state) => ({
              messagesById: new Map(state.messagesById).set(messageId, {
                ...existing,
                reactions: existing.reactions.filter(
                  (r) => r.id !== reactionId
                ),
              }),
            }),
            false,
            "removeReaction"
          );
        }
      },

      reset: () => {
        set(initialState, false, "reset");
      },

      setEditingMessage: (messageId) => {
        set({ editingMessageId: messageId }, false, "setEditingMessage");
      },

      setError: (error) => {
        set({ error }, false, "setError");
      },

      setHasMore: (hasMore) => {
        set({ hasMore }, false, "setHasMore");
      },

      setLoading: (isLoading) => {
        set({ isLoading }, false, "setLoading");
      },

      setLoadingMore: (isLoadingMore) => {
        set({ isLoadingMore }, false, "setLoadingMore");
      },

      setReplyTo: (messageId) => {
        set({ replyToId: messageId }, false, "setReplyTo");
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query }, false, "setSearchQuery");
      },

      setSearchResults: (results) => {
        set({ searchResults: results }, false, "setSearchResults");
      },

      toggleMessageSelection: (messageId) => {
        set(
          (state) => {
            const newSelection = new Set(state.selectedMessageIds);
            if (newSelection.has(messageId)) {
              newSelection.delete(messageId);
            } else {
              newSelection.add(messageId);
            }
            return { selectedMessageIds: newSelection };
          },
          false,
          "toggleMessageSelection"
        );
      },

      updateMessage: (messageId, updates) => {
        const existing = get().messagesById.get(messageId);
        if (existing) {
          set(
            (state) => ({
              messagesById: new Map(state.messagesById).set(messageId, {
                ...existing,
                ...updates,
              }),
            }),
            false,
            "updateMessage"
          );
        }
      },
    }),
    { name: "message-store" }
  )
);

/** Selector for all messages in order */
export const selectMessages = (
  state: MessageStore
): readonly MessageWithDetails[] =>
  state.messageIds
    .map((id) => state.messagesById.get(id))
    .filter((msg): msg is MessageWithDetails => msg !== undefined);

/** Selector for a specific message */
export const selectMessage = (messageId: UUID) => (state: MessageStore) =>
  state.messagesById.get(messageId);

/** Selector for reply target message */
export const selectReplyToMessage = (state: MessageStore) =>
  state.replyToId ? state.messagesById.get(state.replyToId) : null;

/** Selector for editing message */
export const selectEditingMessage = (state: MessageStore) =>
  state.editingMessageId
    ? state.messagesById.get(state.editingMessageId)
    : null;

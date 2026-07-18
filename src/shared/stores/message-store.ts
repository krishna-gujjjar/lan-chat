/**
 * Message state management using Zustand.
 * Handles chat messages with optimistic updates.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { UUID } from "@/shared/types/common";
import type { MessageWithDetails, Reaction } from "@/shared/types/message";

interface MessageState {
  /** ID of message being edited */
  editingMessageId: UUID | null;
  /** Error state */
  error: string | null;
  hasMore: boolean;
  /** Loading states */
  isLoading: boolean;
  isLoadingMore: boolean;
  /** Ordered list of messages */
  messages: MessageWithDetails[];
  /** ID of message being replied to */
  replyToId: UUID | null;
  /** Search query */
  searchQuery: string;
  /** Search results */
  searchResults: UUID[];
  /** Selected message IDs */
  selectedMessageIds: UUID[];
}

interface MessageActions {
  /** Add a new message */
  addMessage: (message: MessageWithDetails) => void;
  /** Add multiple messages (for initial load) */
  addMessages: (messages: MessageWithDetails[]) => void;
  /** Add a reaction to a message */
  addReaction: (messageId: UUID, reaction: Reaction) => void;
  /** Clear message selection */
  clearSelection: () => void;
  /** Get message by ID */
  getMessage: (messageId: UUID) => MessageWithDetails | undefined;
  /** Prepend messages (for loading older messages) */
  prependMessages: (messages: MessageWithDetails[]) => void;
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
  setSearchResults: (results: UUID[]) => void;
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
  messages: [],
  replyToId: null,
  searchQuery: "",
  searchResults: [],
  selectedMessageIds: [],
};

export const useMessageStore = create<MessageStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      addMessage: (message) => {
        set(
          (state) => {
            const exists = state.messages.some((item) => item.id === message.id);
            return exists ? state : { messages: [...state.messages, message] };
          },
          false,
          "addMessage"
        );
      },

      addMessages: (messages) => {
        set(
          (state) => {
            const existingIds = new Set(state.messages.map((m) => m.id));
            const newMessages = messages.filter((m) => !existingIds.has(m.id));
            return { messages: [...state.messages, ...newMessages] };
          },
          false,
          "addMessages"
        );
      },

      addReaction: (messageId, reaction) => {
        set(
          (state) => ({
            messages: state.messages.map((msg) =>
              msg.id === messageId
                ? { ...msg, reactions: [...msg.reactions, reaction] }
                : msg
            ),
          }),
          false,
          "addReaction"
        );
      },

      clearSelection: () => {
        set({ selectedMessageIds: [] }, false, "clearSelection");
      },

      getMessage: (messageId) => get().messages.find((m) => m.id === messageId),

      prependMessages: (messages) => {
        set(
          (state) => {
            const existingIds = new Set(state.messages.map((m) => m.id));
            const newMessages = messages.filter((m) => !existingIds.has(m.id));
            return { messages: [...newMessages, ...state.messages] };
          },
          false,
          "prependMessages"
        );
      },

      removeMessage: (messageId) => {
        set(
          (state) => ({
            messages: state.messages.map((msg) =>
              msg.id === messageId
                ? { ...msg, content: null, isDeleted: true }
                : msg
            ),
          }),
          false,
          "removeMessage"
        );
      },

      removeReaction: (messageId, reactionId) => {
        set(
          (state) => ({
            messages: state.messages.map((msg) =>
              msg.id === messageId
                ? {
                    ...msg,
                    reactions: msg.reactions.filter((r) => r.id !== reactionId),
                  }
                : msg
            ),
          }),
          false,
          "removeReaction"
        );
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
            const isSelected = state.selectedMessageIds.includes(messageId);
            return {
              selectedMessageIds: isSelected
                ? state.selectedMessageIds.filter((id) => id !== messageId)
                : [...state.selectedMessageIds, messageId],
            };
          },
          false,
          "toggleMessageSelection"
        );
      },

      updateMessage: (messageId, updates) => {
        set(
          (state) => ({
            messages: state.messages.map((msg) =>
              msg.id === messageId ? { ...msg, ...updates } : msg
            ),
          }),
          false,
          "updateMessage"
        );
      },
    }),
    { name: "message-store" }
  )
);

/** Selector for all messages - returns stable reference */
export const selectMessages = (state: MessageStore) => state.messages;

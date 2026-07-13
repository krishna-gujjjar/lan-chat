/**
 * Main chat view component.
 */

import { useCallback, useEffect } from "react";
import { invokeOrThrow } from "@/shared/lib/tauri/invoke";
import { useMessageStore } from "@/shared/stores/message-store";
import { useNetworkStore } from "@/shared/stores/network-store";
import { useUserStore } from "@/shared/stores/user-store";
import type { UUID } from "@/shared/types/common";
import { MessageInput } from "./message-input";
import { MessageList } from "./message-list";

export function ChatView() {
  const setReplyTo = useMessageStore((state) => state.setReplyTo);
  const setEditingMessage = useMessageStore((state) => state.setEditingMessage);
  const addMessage = useMessageStore((state) => state.addMessage);
  const prependMessages = useMessageStore((state) => state.prependMessages);
  const removeMessage = useMessageStore((state) => state.removeMessage);
  const addReaction = useMessageStore((state) => state.addReaction);
  const messages = useMessageStore((state) => state.messages);
  const hasMore = useMessageStore((state) => state.hasMore);
  const isLoadingMore = useMessageStore((state) => state.isLoadingMore);
  const setLoadingMore = useMessageStore((state) => state.setLoadingMore);
  const currentUser = useUserStore((state) => state.currentUser);
  const setPeers = useNetworkStore((state) => state.setPeers);

  // Refresh peers periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const peers = await invokeOrThrow("get_peers");
        setPeers([...peers]);
      } catch (e) {
        // ignore
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [setPeers]);

  const handleSend = useCallback(
    async (content: string, replyToId?: UUID, attachmentIds?: UUID[]) => {
      if (!currentUser) return;
      try {
        const message = await invokeOrThrow("send_message", {
          content,
          replyToId: replyToId ?? undefined,
          attachmentIds,
          mentionedUserIds: undefined,
        });
        addMessage(message);
      } catch (e) {
        console.error("Failed to send message:", e);
      }
    },
    [currentUser, addMessage]
  );

  const handleTyping = useCallback(async (isTyping: boolean) => {
    if (!currentUser) return;
    try {
      // Broadcast typing via network layer (handled in Rust when we add typing command)
      // For now we skip since there's no direct command for typing
      console.log("Typing:", isTyping);
    } catch (e) {
      console.error("Typing error:", e);
    }
  }, [currentUser]);

  const handleAttach = useCallback(
    async (filePaths: string[]) => {
      if (!currentUser || filePaths.length === 0) return [];
      try {
        const attachments = await invokeOrThrow("upload_files", {
          filePaths,
        });
        return attachments.map((a) => a.id);
      } catch (e) {
        console.error("Failed to upload files:", e);
        return [];
      }
    },
    [currentUser]
  );

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldestMessage = messages[0];
      const result = await invokeOrThrow("get_messages", {
        limit: 50,
        before: oldestMessage.id,
      });
      prependMessages([...result.items]);
    } catch (e) {
      console.error("Failed to load more messages:", e);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, messages, prependMessages, setLoadingMore]);

  const handleReply = useCallback(
    (messageId: UUID) => {
      setReplyTo(messageId);
    },
    [setReplyTo]
  );

  const handleEdit = useCallback(
    (messageId: UUID) => {
      setEditingMessage(messageId);
    },
    [setEditingMessage]
  );

  const handleDelete = useCallback(
    async (messageId: UUID) => {
      try {
        await invokeOrThrow("delete_message", { messageId });
        removeMessage(messageId);
      } catch (e) {
        console.error("Failed to delete message:", e);
      }
    },
    [removeMessage]
  );

  const handleReact = useCallback(
    async (messageId: UUID, emoji: string) => {
      try {
        const reaction = await invokeOrThrow("add_reaction", {
          messageId,
          emoji,
        });
        addReaction(messageId, reaction);
      } catch (e) {
        console.error("Failed to add reaction:", e);
      }
    },
    [addReaction]
  );

  return (
    <div className="flex h-full flex-col bg-retro-bg">
      <MessageList
        onDelete={handleDelete}
        onEdit={handleEdit}
        onLoadMore={handleLoadMore}
        onReact={handleReact}
        onReply={handleReply}
      />
      <MessageInput
        onAttach={handleAttach}
        onSend={handleSend}
        onTyping={handleTyping}
      />
    </div>
  );
}

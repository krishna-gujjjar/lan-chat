/**
 * Main chat view component.
 */

import { useCallback } from "react";
import { useMessageStore } from "@/shared/stores/message-store";
import type { UUID } from "@/shared/types/common";
import { MessageInput } from "./message-input";
import { MessageList } from "./message-list";

export function ChatView() {
  const setReplyTo = useMessageStore((state) => state.setReplyTo);
  const setEditingMessage = useMessageStore((state) => state.setEditingMessage);

  // Message actions
  const handleSend = useCallback((content: string, replyToId?: UUID) => {
    console.log("Send message:", { content, replyToId });
    // TODO: Implement with Tauri invoke
  }, []);

  const handleTyping = useCallback((isTyping: boolean) => {
    console.log("Typing:", isTyping);
    // TODO: Implement with Tauri invoke
  }, []);

  const handleAttach = useCallback(() => {
    console.log("Open file picker");
    // TODO: Implement with Tauri dialog
  }, []);

  const handleLoadMore = useCallback(() => {
    console.log("Load more messages");
    // TODO: Implement pagination
  }, []);

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

  const handleDelete = useCallback((messageId: UUID) => {
    console.log("Delete message:", messageId);
    // TODO: Implement with Tauri invoke
  }, []);

  const handleReact = useCallback((messageId: UUID, emoji: string) => {
    console.log("React to message:", { emoji, messageId });
    // TODO: Implement with Tauri invoke
  }, []);

  return (
    <div className="flex h-full flex-col">
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

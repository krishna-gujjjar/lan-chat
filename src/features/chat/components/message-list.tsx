/**
 * Virtualized message list component.
 */

import { useCallback, useEffect, useRef } from "react";
import { selectMessages, useMessageStore } from "@/shared/stores/message-store";
import { useUserStore } from "@/shared/stores/user-store";
import type { UUID } from "@/shared/types/common";
import { formatDateGroup, isSameDay } from "../utils/format-time";
import { MessageItem } from "./message-item";

interface MessageListProps {
  readonly onDelete: (messageId: UUID) => void;
  readonly onEdit: (messageId: UUID) => void;
  readonly onLoadMore: () => void;
  readonly onReact: (messageId: UUID, emoji: string) => void;
  readonly onReply: (messageId: UUID) => void;
}

export function MessageList({
  onLoadMore,
  onReply,
  onEdit,
  onDelete,
  onReact,
}: MessageListProps) {
  const messages = useMessageStore(selectMessages);
  const isLoading = useMessageStore((state) => state.isLoading);
  const hasMore = useMessageStore((state) => state.hasMore);
  const currentUser = useUserStore((state) => state.currentUser);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  // Handle scroll for infinite loading
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    // Check if at top for loading more
    if (container.scrollTop < 100 && hasMore && !isLoading) {
      onLoadMore();
    }

    // Track if user is at bottom
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      100;
    isAtBottomRef.current = isNearBottom;
  }, [hasMore, isLoading, onLoadMore]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isAtBottomRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, []);

  // Initial scroll to bottom
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, []);

  return (
    <div
      className="flex-1 overflow-y-auto"
      onScroll={handleScroll}
      ref={scrollContainerRef}
    >
      {/* Loading indicator */}
      {isLoading && (
        <div className="flex justify-center py-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <LoadingSpinner />
            Loading messages...
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.length === 0 && !isLoading ? (
        <EmptyState />
      ) : (
        <div className="py-4">
          {messages.map((message, index) => {
            const prevMessage = messages[index - 1];
            const showDateSeparator = !(
              prevMessage && isSameDay(prevMessage.createdAt, message.createdAt)
            );
            const showAvatar =
              !prevMessage ||
              prevMessage.senderId !== message.senderId ||
              showDateSeparator;

            return (
              <div key={message.id}>
                {showDateSeparator && (
                  <DateSeparator date={message.createdAt} />
                )}
                <MessageItem
                  isOwn={message.senderId === currentUser?.id}
                  message={message}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onReact={onReact}
                  onReply={onReply}
                  showAvatar={showAvatar}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DateSeparator({ date }: { readonly date: string }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="flex-1 border-gray-200 border-t dark:border-dark-600" />
      <span className="font-medium text-gray-500 text-xs dark:text-gray-400">
        {formatDateGroup(date as import("@/shared/types/common").ISODateString)}
      </span>
      <div className="flex-1 border-gray-200 border-t dark:border-dark-600" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <p className="font-medium text-gray-900 text-lg dark:text-white">
          No messages yet
        </p>
        <p className="mt-1 text-gray-500 text-sm dark:text-gray-400">
          Start the conversation by sending a message
        </p>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin text-gray-400"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        fill="currentColor"
      />
    </svg>
  );
}

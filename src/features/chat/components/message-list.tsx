/**
 * Virtualized message list component.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useMessageStore } from "@/shared/stores/message-store";
import { useUserStore } from "@/shared/stores/user-store";
import type { ISODateString, UUID } from "@/shared/types/common";
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
  const messages = useMessageStore((state) => state.messages);
  const isLoading = useMessageStore((state) => state.isLoading);
  const isLoadingMore = useMessageStore((state) => state.isLoadingMore);
  const hasMore = useMessageStore((state) => state.hasMore);
  const currentUser = useUserStore((state) => state.currentUser);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    if (container.scrollTop < 100 && hasMore && !isLoadingMore) {
      onLoadMore();
    }

    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      100;
    isAtBottomRef.current = isNearBottom;
  }, [hasMore, isLoadingMore, onLoadMore]);

  useEffect(() => {
    if (isAtBottomRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, [messages.length]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, []);

  const groupedMessages = useMemo(
    () =>
      messages.map((message, index) => {
        const prevMessage = messages[index - 1];
        const showDateSeparator = !(
          prevMessage && isSameDay(prevMessage.createdAt, message.createdAt)
        );
        const showAvatar =
          !prevMessage ||
          prevMessage.senderId !== message.senderId ||
          showDateSeparator;

        return {
          message,
          showAvatar,
          showDateSeparator,
        };
      }),
    [messages]
  );

  return (
    <div
      className="flex-1 overflow-y-auto"
      onScroll={handleScroll}
      ref={scrollContainerRef}
    >
      {/* Loading indicator */}
      {isLoading || isLoadingMore ? (
        <div className="flex justify-center py-4">
          <div className="flex items-center gap-2 font-terminal text-retro-text-dim text-sm">
            <LoadingSpinner />
            Loading messages...
          </div>
        </div>
      ) : null}

      {/* Messages */}
      {messages.length === 0 && !isLoading ? (
        <EmptyState />
      ) : (
        <div className="py-4">
          {groupedMessages.map(({ message, showDateSeparator, showAvatar }) => (
            <div key={message.id}>
              {showDateSeparator ? (
                <DateSeparator date={message.createdAt} />
              ) : null}
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
          ))}
        </div>
      )}
    </div>
  );
}

function DateSeparator({ date }: { readonly date: ISODateString }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="flex-1 border-retro-border border-t" />
      <span className="font-pixel text-[0.55rem] text-retro-text-dim uppercase tracking-widest">
        {formatDateGroup(date)}
      </span>
      <div className="flex-1 border-retro-border border-t" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <p className="mb-2 font-pixel text-retro-text text-sm">NO MESSAGES</p>
        <p className="font-terminal text-retro-text-dim text-sm">
          Start the conversation by sending a message
        </p>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin text-retro-green"
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

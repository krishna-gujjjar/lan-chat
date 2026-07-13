/**
 * Single message display component.
 */

import { memo } from "react";
import { Avatar } from "@/shared/components/ui";
import type { MessageWithDetails, UUID } from "@/shared/types";
import { cn } from "@/utils/cn";
import { formatMessageTime, formatRelativeTime } from "../utils/format-time";

interface MessageItemProps {
  readonly isOwn: boolean;
  readonly message: MessageWithDetails;
  readonly onDelete: (messageId: UUID) => void;
  readonly onEdit: (messageId: UUID) => void;
  readonly onReact: (messageId: UUID, emoji: string) => void;
  readonly onReply: (messageId: UUID) => void;
  readonly showAvatar: boolean;
}

export const MessageItem = memo(function MessageItem({
  message,
  isOwn,
  showAvatar,
  onReply,
  onEdit,
  onDelete,
  onReact,
}: MessageItemProps) {
  if (message.isDeleted) {
    return (
      <div className="px-4 py-2 text-gray-400 text-sm italic dark:text-gray-500">
        This message was deleted
      </div>
    );
  }

  return (
    <div
      className={cn(
        "message-container group flex gap-3 px-4 py-1.5",
        "hover:bg-gray-50 dark:hover:bg-dark-800/50",
        isOwn && "flex-row-reverse"
      )}
    >
      {/* Avatar */}
      <div className="w-10 shrink-0">
        {showAvatar && (
          <Avatar
            alt={message.sender.username}
            size="sm"
            src={message.sender.avatarPath}
          />
        )}
      </div>

      {/* Message content */}
      <div className={cn("min-w-0 flex-1", isOwn && "text-right")}>
        {/* Header with username and time */}
        {showAvatar && (
          <div
            className={cn(
              "mb-0.5 flex items-baseline gap-2",
              isOwn && "flex-row-reverse"
            )}
          >
            <span className="font-medium text-gray-900 text-sm dark:text-white">
              {message.sender.username}
            </span>
            <span
              className="text-gray-500 text-xs"
              title={formatRelativeTime(message.createdAt)}
            >
              {formatMessageTime(message.createdAt)}
            </span>
            {message.isEdited && (
              <span className="text-gray-400 text-xs">(edited)</span>
            )}
          </div>
        )}

        {/* Reply preview */}
        {message.replyTo && (
          <ReplyPreview isOwn={isOwn} message={message.replyTo} />
        )}

        {/* Message text */}
        {message.content && (
          <div
            className={cn(
              "message-content text-gray-800 text-sm dark:text-gray-200",
              isOwn && "text-right"
            )}
          >
            <MessageContent
              content={message.content}
              mentions={message.mentions}
            />
          </div>
        )}

        {/* Attachments */}
        {message.attachments.length > 0 && (
          <div className="mt-2">
            <AttachmentList attachments={message.attachments} />
          </div>
        )}

        {/* Reactions */}
        {message.reactions.length > 0 && (
          <div
            className={cn("mt-1 flex flex-wrap gap-1", isOwn && "justify-end")}
          >
            <ReactionList
              onReact={(emoji) => onReact(message.id, emoji)}
              reactions={message.reactions}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div
        className={cn(
          "message-actions flex items-start gap-1",
          isOwn && "order-first"
        )}
      >
        <ActionButton onClick={() => onReply(message.id)} title="Reply">
          ↩
        </ActionButton>
        <ActionButton onClick={() => onReact(message.id, "👍")} title="React">
          😊
        </ActionButton>
        {isOwn && (
          <>
            <ActionButton onClick={() => onEdit(message.id)} title="Edit">
              ✏️
            </ActionButton>
            <ActionButton onClick={() => onDelete(message.id)} title="Delete">
              🗑️
            </ActionButton>
          </>
        )}
      </div>
    </div>
  );
});

function ActionButton({
  title,
  onClick,
  children,
}: {
  readonly title: string;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      className="rounded p-1 text-xs transition-colors hover:bg-gray-200 dark:hover:bg-dark-600"
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}

function ReplyPreview({
  message,
  isOwn,
}: {
  readonly message: MessageWithDetails["replyTo"];
  readonly isOwn: boolean;
}) {
  if (!message) {
    return null;
  }

  return (
    <div
      className={cn(
        "mb-1 rounded border-blue-400 border-l-2 px-2 py-1",
        "bg-gray-100 dark:bg-dark-700",
        isOwn && "text-right"
      )}
    >
      <p className="truncate text-gray-500 text-xs dark:text-gray-400">
        {message.content ?? "Attachment"}
      </p>
    </div>
  );
}

function MessageContent({
  content,
  mentions,
}: {
  readonly content: string;
  readonly mentions: MessageWithDetails["mentions"];
}) {
  // Simple mention highlighting
  let processedContent = content;
  mentions.forEach((mention) => {
    processedContent = processedContent.replace(
      new RegExp(`@${mention.username}`, "g"),
      `<span class="text-blue-500 font-medium">@${mention.username}</span>`
    );
  });

  return <span dangerouslySetInnerHTML={{ __html: processedContent }} />;
}

function AttachmentList({
  attachments,
}: {
  readonly attachments: MessageWithDetails["attachments"];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <div
          className="rounded-lg bg-gray-100 px-3 py-2 text-sm dark:bg-dark-700"
          key={attachment.id}
        >
          {attachment.isImage ? "🖼️" : "📎"} {attachment.originalFilename}
        </div>
      ))}
    </div>
  );
}

function ReactionList({
  reactions,
  onReact,
}: {
  readonly reactions: MessageWithDetails["reactions"];
  readonly onReact: (emoji: string) => void;
}) {
  // Group reactions by emoji
  const grouped = reactions.reduce(
    (acc, reaction) => {
      acc[reaction.emoji] = (acc[reaction.emoji] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <>
      {Object.entries(grouped).map(([emoji, count]) => (
        <button
          className="rounded-full bg-gray-100 px-2 py-0.5 text-xs hover:bg-gray-200 dark:bg-dark-700 dark:hover:bg-dark-600"
          key={emoji}
          onClick={() => onReact(emoji)}
        >
          {emoji} {count}
        </button>
      ))}
    </>
  );
}

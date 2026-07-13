/**
 * Single message display component.
 */

import { memo, useCallback } from "react";
import { Avatar } from "@/shared/components/ui/avatar";
import type { Attachment } from "@/shared/types/attachment";
import type { ISODateString, UUID } from "@/shared/types/common";
import type {
  Mention,
  MessageWithDetails,
  Reaction,
} from "@/shared/types/message";
import type { User } from "@/shared/types/user";
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
  const handleReply = useCallback(() => {
    onReply(message.id);
  }, [onReply, message.id]);

  const handleDefaultReact = useCallback(() => {
    onReact(message.id, "👍");
  }, [onReact, message.id]);

  const handleEdit = useCallback(() => {
    onEdit(message.id);
  }, [onEdit, message.id]);

  const handleDelete = useCallback(() => {
    onDelete(message.id);
  }, [onDelete, message.id]);

  const handleReaction = useCallback(
    (emoji: string) => {
      onReact(message.id, emoji);
    },
    [onReact, message.id]
  );

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
        {showAvatar ? (
          <Avatar
            alt={message.sender.username}
            size="sm"
            src={message.sender.avatarPath}
          />
        ) : null}
      </div>

      {/* Message content */}
      <div className={cn("min-w-0 flex-1", isOwn && "text-right")}>
        {/* Header with username and time */}
        {showAvatar ? (
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
            {message.isEdited ? (
              <span className="text-gray-400 text-xs">(edited)</span>
            ) : null}
          </div>
        ) : null}

        {/* Reply preview */}
        {message.replyTo ? (
          <ReplyPreview isOwn={isOwn} message={message.replyTo} />
        ) : null}

        {/* Message text */}
        {message.content ? (
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
        ) : null}

        {/* Attachments */}
        {message.attachments.length > 0 ? (
          <div className="mt-2">
            <AttachmentList attachments={message.attachments} />
          </div>
        ) : null}

        {/* Reactions */}
        {message.reactions.length > 0 ? (
          <div
            className={cn("mt-1 flex flex-wrap gap-1", isOwn && "justify-end")}
          >
            <ReactionList
              onReact={handleReaction}
              reactions={message.reactions}
            />
          </div>
        ) : null}
      </div>

      {/* Actions */}
      <div
        className={cn(
          "message-actions flex items-start gap-1",
          isOwn && "order-first"
        )}
      >
        <ActionButton onClick={handleReply} title="Reply">
          ↩
        </ActionButton>
        <ActionButton onClick={handleDefaultReact} title="React">
          😊
        </ActionButton>
        {isOwn ? (
          <>
            <ActionButton onClick={handleEdit} title="Edit">
              ✏️
            </ActionButton>
            <ActionButton onClick={handleDelete} title="Delete">
              🗑️
            </ActionButton>
          </>
        ) : null}
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
      type="button"
    >
      {children}
    </button>
  );
}

interface ReplyPreviewProps {
  readonly isOwn: boolean;
  readonly message: {
    readonly content: string | null;
  };
}

function ReplyPreview({ message, isOwn }: ReplyPreviewProps) {
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

interface MessageContentProps {
  readonly content: string;
  readonly mentions: readonly Mention[];
}

function MessageContent({ content, mentions }: MessageContentProps) {
  let processedContent = content;
  for (const mention of mentions) {
    processedContent = processedContent.replace(
      new RegExp(`@${mention.username}`, "g"),
      `<span class="text-blue-500 font-medium">@${mention.username}</span>`
    );
  }

  return <span dangerouslySetInnerHTML={{ __html: processedContent }} />;
}

interface AttachmentListProps {
  readonly attachments: readonly Attachment[];
}

function AttachmentList({ attachments }: AttachmentListProps) {
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

interface ReactionListProps {
  readonly onReact: (emoji: string) => void;
  readonly reactions: readonly Reaction[];
}

function ReactionList({ reactions, onReact }: ReactionListProps) {
  // Group reactions by emoji
  const grouped: Record<string, number> = {};
  for (const reaction of reactions) {
    grouped[reaction.emoji] = (grouped[reaction.emoji] ?? 0) + 1;
  }

  return (
    <>
      {Object.entries(grouped).map(([emoji, count]) => (
        <button
          className="rounded-full bg-gray-100 px-2 py-0.5 text-xs hover:bg-gray-200 dark:bg-dark-700 dark:hover:bg-dark-600"
          key={emoji}
          onClick={() => onReact(emoji)}
          type="button"
        >
          {emoji} {count}
        </button>
      ))}
    </>
  );
}

// Re-export types needed by MessageWithDetails for external use
export interface MessageWithDetailsType {
  readonly attachments: readonly Attachment[];
  readonly content: string | null;
  readonly createdAt: ISODateString;
  readonly id: UUID;
  readonly isDeleted: boolean;
  readonly isEdited: boolean;
  readonly mentions: readonly Mention[];
  readonly reactions: readonly Reaction[];
  readonly replyTo: { readonly content: string | null } | null;
  readonly replyToId: UUID | null;
  readonly sender: User;
  readonly senderId: UUID;
  readonly updatedAt: ISODateString;
}

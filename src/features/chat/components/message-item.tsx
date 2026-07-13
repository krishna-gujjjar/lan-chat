/**
 * Single message display component.
 */

import { memo, useCallback } from 'react';
import type { UUID, ISODateString } from '@/shared/types/common';
import type { MessageWithDetails } from '@/shared/types/message';
import type { Attachment } from '@/shared/types/attachment';
import type { Reaction, Mention } from '@/shared/types/message';
import type { User } from '@/shared/types/user';
import { Avatar } from '@/shared/components/ui/avatar';
import { cn } from '@/utils/cn';
import { formatMessageTime, formatRelativeTime } from '../utils/format-time';

interface MessageItemProps {
  readonly message: MessageWithDetails;
  readonly isOwn: boolean;
  readonly showAvatar: boolean;
  readonly onReply: (messageId: UUID) => void;
  readonly onEdit: (messageId: UUID) => void;
  readonly onDelete: (messageId: UUID) => void;
  readonly onReact: (messageId: UUID, emoji: string) => void;
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
    onReact(message.id, '👍');
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
      <div className="px-4 py-2 text-sm text-gray-400 dark:text-gray-500 italic">
        This message was deleted
      </div>
    );
  }

  return (
    <div
      className={cn(
        'message-container group flex gap-3 px-4 py-1.5',
        'hover:bg-gray-50 dark:hover:bg-dark-800/50',
        isOwn && 'flex-row-reverse'
      )}
    >
      {/* Avatar */}
      <div className="w-10 shrink-0">
        {showAvatar ? (
          <Avatar
            src={message.sender.avatarPath}
            alt={message.sender.username}
            size="sm"
          />
        ) : null}
      </div>

      {/* Message content */}
      <div className={cn('flex-1 min-w-0', isOwn && 'text-right')}>
        {/* Header with username and time */}
        {showAvatar ? (
          <div className={cn('flex items-baseline gap-2 mb-0.5', isOwn && 'flex-row-reverse')}>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {message.sender.username}
            </span>
            <span className="text-xs text-gray-500" title={formatRelativeTime(message.createdAt)}>
              {formatMessageTime(message.createdAt)}
            </span>
            {message.isEdited ? (
              <span className="text-xs text-gray-400">(edited)</span>
            ) : null}
          </div>
        ) : null}

        {/* Reply preview */}
        {message.replyTo ? (
          <ReplyPreview message={message.replyTo} isOwn={isOwn} />
        ) : null}

        {/* Message text */}
        {message.content ? (
          <div className={cn('message-content text-sm text-gray-800 dark:text-gray-200', isOwn && 'text-right')}>
            <MessageContent content={message.content} mentions={message.mentions} />
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
          <div className={cn('mt-1 flex flex-wrap gap-1', isOwn && 'justify-end')}>
            <ReactionList
              reactions={message.reactions}
              onReact={handleReaction}
            />
          </div>
        ) : null}
      </div>

      {/* Actions */}
      <div className={cn('message-actions flex items-start gap-1', isOwn && 'order-first')}>
        <ActionButton title="Reply" onClick={handleReply}>
          ↩
        </ActionButton>
        <ActionButton title="React" onClick={handleDefaultReact}>
          😊
        </ActionButton>
        {isOwn ? (
          <>
            <ActionButton title="Edit" onClick={handleEdit}>
              ✏️
            </ActionButton>
            <ActionButton title="Delete" onClick={handleDelete}>
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
      type="button"
      title={title}
      onClick={onClick}
      className="p-1 text-xs rounded hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
    >
      {children}
    </button>
  );
}

interface ReplyPreviewProps {
  readonly message: {
    readonly content: string | null;
  };
  readonly isOwn: boolean;
}

function ReplyPreview({ message, isOwn }: ReplyPreviewProps) {
  return (
    <div
      className={cn(
        'mb-1 px-2 py-1 rounded border-l-2 border-blue-400',
        'bg-gray-100 dark:bg-dark-700',
        isOwn && 'text-right'
      )}
    >
      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
        {message.content ?? 'Attachment'}
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
      new RegExp(`@${mention.username}`, 'g'),
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
          key={attachment.id}
          className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-dark-700 text-sm"
        >
          {attachment.isImage ? '🖼️' : '📎'} {attachment.originalFilename}
        </div>
      ))}
    </div>
  );
}

interface ReactionListProps {
  readonly reactions: readonly Reaction[];
  readonly onReact: (emoji: string) => void;
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
          key={emoji}
          type="button"
          onClick={() => onReact(emoji)}
          className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-dark-700 text-xs hover:bg-gray-200 dark:hover:bg-dark-600"
        >
          {emoji} {count}
        </button>
      ))}
    </>
  );
}

// Re-export types needed by MessageWithDetails for external use
export interface MessageWithDetailsType {
  readonly id: UUID;
  readonly senderId: UUID;
  readonly content: string | null;
  readonly replyToId: UUID | null;
  readonly isEdited: boolean;
  readonly isDeleted: boolean;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
  readonly sender: User;
  readonly replyTo: { readonly content: string | null } | null;
  readonly attachments: readonly Attachment[];
  readonly reactions: readonly Reaction[];
  readonly mentions: readonly Mention[];
}

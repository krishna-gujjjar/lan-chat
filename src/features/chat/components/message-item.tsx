/**
 * Single message display component.
 */

import { listen } from "@tauri-apps/api/event";
import { memo, useCallback, useEffect, useState } from "react";
import { invokeOrThrow } from "@/shared/lib/tauri/invoke";
import type { UUID } from "@/shared/types/common";
import type {
  MessageWithDetails,
  Reaction,
  Mention,
} from "@/shared/types/message";
import type { Attachment } from "@/shared/types/attachment";
import { cn } from "@/utils/cn";
import { formatMessageTime, formatRelativeTime } from "../utils/format-time";

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
      <div className="px-4 py-2 text-sm text-retro-text-dim font-terminal italic">
        This message was deleted
      </div>
    );
  }

  return (
    <div
      className={cn(
        "message-container group flex gap-3 px-4 py-2 sm:px-6",
        isOwn && "flex-row-reverse"
      )}
    >
      {/* Avatar */}
      <div className="w-10 shrink-0">
        {showAvatar ? (
          <div className="message-avatar">
            {message.sender.username.slice(0, 2).toUpperCase()}
            <i />
          </div>
        ) : null}
      </div>

      {/* Message content */}
      <div className={cn("flex-1 min-w-0", isOwn && "text-right")}>
        {/* Header with username and time */}
        {showAvatar ? (
          <div
            className={cn(
              "flex items-baseline gap-2 mb-0.5",
              isOwn && "flex-row-reverse"
            )}
          >
            <span className="font-pixel text-retro-amber text-[0.6rem]">
              {message.sender.username}
            </span>
            <span
              className="text-xs text-retro-text-dim font-terminal"
              title={formatRelativeTime(message.createdAt)}
            >
              {formatMessageTime(message.createdAt)}
            </span>
            {message.isEdited ? (
              <span className="text-xs text-retro-text-dim font-terminal">
                (edited)
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Reply preview */}
        {message.replyTo ? (
          <ReplyPreview message={message.replyTo} isOwn={isOwn} />
        ) : null}

        {/* Message text */}
        {message.content ? (
          <div
            className={cn(
              "message-bubble text-sm text-retro-text font-terminal leading-relaxed",
              isOwn && "is-own text-left"
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
          <div className={cn("mt-2", isOwn && "text-right")}>
            <AttachmentList attachments={message.attachments} />
          </div>
        ) : null}

        {/* Reactions */}
        {message.reactions.length > 0 ? (
          <div
            className={cn("mt-1 flex flex-wrap gap-1", isOwn && "justify-end")}
          >
            <ReactionList
              reactions={message.reactions}
              onReact={handleReaction}
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
      className="p-1 text-xs border border-transparent hover:border-retro-border hover:bg-retro-bg transition-colors text-retro-text-dim"
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
        "mb-1 px-2 py-1 border-l-2 border-retro-amber bg-retro-bg",
        isOwn && "text-right border-l-0 border-r-2"
      )}
    >
      <p className="text-xs text-retro-text-dim font-terminal truncate">
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
  const mentionTokens = new Set(mentions.map((item) => `@${item.username}`));
  return (
    <span className="whitespace-pre-wrap break-words">
      {content.split(/(@[\p{L}\p{N}_.-]+|\n)/gu).map((part, index) =>
        mentionTokens.has(part) ? (
          <span className="font-bold text-retro-cyan" key={`${part}-${index}`}>
            {part}
          </span>
        ) : (
          part
        )
      )}
    </span>
  );
}

interface AttachmentListProps {
  readonly attachments: readonly Attachment[];
}

function AttachmentList({ attachments }: AttachmentListProps) {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, string>>({});
  const loadPreviews = useCallback(async () => {
    for (const attachment of attachments) {
      if (!attachment.isImage) continue;
      const preview = await invokeOrThrow("get_attachment_preview", { attachmentId: attachment.id }).catch(() => null);
      if (preview) setPreviews((current) => ({ ...current, [attachment.id]: preview }));
    }
  }, [attachments]);
  useEffect(() => {
    void loadPreviews();
    const disposers: Array<() => void> = [];
    void listen<{ attachmentId: string; percentage: number }>("download:progress", ({ payload }) => {
      setStatus((current) => ({ ...current, [payload.attachmentId]: `${Math.round(payload.percentage)}%` }));
    }).then((dispose) => disposers.push(dispose));
    void listen("download:completed", () => { void loadPreviews(); }).then((dispose) => disposers.push(dispose));
    return () => disposers.forEach((dispose) => dispose());
  }, [loadPreviews]);
  const download = useCallback(async (attachment: Attachment) => {
    setStatus((current) => ({ ...current, [attachment.id]: "REQUESTING" }));
    try { await invokeOrThrow("start_download", { attachmentId: attachment.id }); }
    catch (cause) { setStatus((current) => ({ ...current, [attachment.id]: cause instanceof Error ? "FAILED" : "FAILED" })); }
  }, []);
  return (
    <div className="inline-flex max-w-full flex-wrap gap-2">
      {attachments.map((attachment) => (
        <div className="max-w-sm border border-retro-border bg-retro-bg p-2 text-left" key={attachment.id}>
          {previews[attachment.id] ? <img alt={attachment.originalFilename} className="mb-2 max-h-64 w-full object-contain [image-rendering:auto]" loading="lazy" src={previews[attachment.id]} /> : null}
          <button className="retro-chip w-full border-retro-border-light text-retro-text hover:border-retro-green" onClick={() => void download(attachment)} title="Download from sender" type="button">
            {attachment.isImage ? "🖼️" : "📎"} {attachment.originalFilename} · {status[attachment.id] ?? (previews[attachment.id] ? "SAVED" : "DOWNLOAD")}
          </button>
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
          className="retro-reaction hover:border-retro-amber"
        >
          {emoji} {count}
        </button>
      ))}
    </>
  );
}

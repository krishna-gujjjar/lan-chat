/**
 * Message input component with attachment support.
 */

import { open } from "@tauri-apps/plugin-dialog";
import {
  type KeyboardEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMessageStore } from "@/shared/stores/message-store";
import type { UUID } from "@/shared/types/common";
import { cn } from "@/utils/cn";

interface MessageInputProps {
  readonly disabled?: boolean;
  readonly onAttach: (filePaths: string[]) => Promise<UUID[]>;
  readonly onSend: (
    content: string,
    replyToId?: UUID,
    attachmentIds?: UUID[]
  ) => void;
  readonly onTyping: (isTyping: boolean) => void;
}

export function MessageInput({
  onSend,
  onTyping,
  onAttach,
  disabled = false,
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<UUID[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const replyToId = useMessageStore((state) => state.replyToId);
  const messages = useMessageStore((state) => state.messages);
  const setReplyTo = useMessageStore((state) => state.setReplyTo);

  const replyToMessage = useMemo(() => {
    if (!replyToId) {
      return null;
    }
    return messages.find((m) => m.id === replyToId) ?? null;
  }, [replyToId, messages]);

  const handleInput = useCallback(
    (value: string) => {
      setContent(value);
      onTyping(true);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 2000);
    },
    [onTyping]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      handleInput(e.target.value);
    },
    [handleInput]
  );

  const handleSend = useCallback(() => {
    const trimmed = content.trim();
    if ((!trimmed && attachments.length === 0) || disabled) {
      return;
    }

    onSend(
      trimmed,
      replyToMessage?.id,
      attachments.length > 0 ? attachments : undefined
    );
    setContent("");
    setAttachments([]);
    setReplyTo(null);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    onTyping(false);
    textareaRef.current?.focus();
  }, [
    content,
    attachments,
    disabled,
    onSend,
    onTyping,
    replyToMessage,
    setReplyTo,
  ]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleAttach = useCallback(async () => {
    try {
      const selected = await open({
        filters: [
          { extensions: ["png", "jpg", "jpeg", "gif", "webp"], name: "Images" },
          { extensions: ["mp4", "webm"], name: "Videos" },
          {
            extensions: ["pdf", "doc", "docx", "txt", "csv"],
            name: "Documents",
          },
          { extensions: ["*"], name: "All Files" },
        ],
        multiple: true,
      });

      if (selected && Array.isArray(selected) && selected.length > 0) {
        setIsUploading(true);
        const ids = await onAttach(selected);
        setAttachments((prev) => [...prev, ...ids]);
        setIsUploading(false);
      }
    } catch (e) {
      console.error("File picker error:", e);
      setIsUploading(false);
    }
  }, [onAttach]);

  const cancelReply = useCallback(() => {
    setReplyTo(null);
  }, [setReplyTo]);

  const removeAttachment = useCallback((id: UUID) => {
    setAttachments((prev) => prev.filter((a) => a !== id));
  }, []);

  return (
    <div className="composer-shell">
      {/* Reply preview */}
      {replyToMessage ? (
        <div className="mb-3 flex items-center gap-2 border border-retro-border bg-retro-bg px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="font-terminal text-retro-text-dim text-xs">
              Replying to{" "}
              <span className="text-retro-amber">
                {replyToMessage.sender.username}
              </span>
            </p>
            <p className="truncate font-terminal text-retro-text text-sm">
              {replyToMessage.content ?? "Attachment"}
            </p>
          </div>
          <button
            className="p-1 font-pixel text-retro-text-dim text-xs hover:text-retro-red"
            onClick={cancelReply}
            type="button"
          >
            [X]
          </button>
        </div>
      ) : null}

      {/* Attachment preview */}
      {attachments.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((id) => (
            <div
              className="retro-chip border-retro-green-dim text-retro-green"
              key={id}
            >
              <span>FILE</span>
              <button
                className="ml-1 text-retro-text-dim hover:text-retro-red"
                onClick={() => removeAttachment(id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {/* Input area */}
      <div className="composer-bar">
        <span className="hidden font-pixel text-[0.55rem] text-retro-green md:block">&gt;_</span>
        <button
          className={cn(
            "retro-button h-10 w-10 p-0",
            isUploading && "animate-blink"
          )}
          disabled={disabled || isUploading}
          onClick={handleAttach}
          title="Attach file"
          type="button"
        >
          {isUploading ? "..." : "+"}
        </button>

        <div className="relative flex-1">
          <textarea
            className="composer-input min-h-[44px] resize-none"
            disabled={disabled}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            ref={textareaRef}
            rows={1}
            style={{
              height: "auto",
              minHeight: "44px",
            }}
            value={content}
          />
        </div>

        <button
          className="retro-button retro-button-primary h-10"
          disabled={disabled || (!content.trim() && attachments.length === 0)}
          onClick={handleSend}
        >
          SEND
        </button>
      </div>

      {/* Hint */}
      <p className="mt-2 font-terminal text-retro-text-dim text-xs">
        ENTER to send | SHIFT+ENTER for new line
      </p>
    </div>
  );
}

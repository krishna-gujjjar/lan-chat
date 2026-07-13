/**
 * Message input component with attachment support.
 */

import { type KeyboardEvent, useCallback, useRef, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { useMessageStore } from "@/shared/stores/message-store";
import type { UUID } from "@/shared/types/common";
import { cn } from "@/utils/cn";

interface MessageInputProps {
  readonly disabled?: boolean;
  readonly onAttach: () => void;
  readonly onSend: (content: string, replyToId?: UUID) => void;
  readonly onTyping: (isTyping: boolean) => void;
}

export function MessageInput({
  onSend,
  onTyping,
  onAttach,
  disabled = false,
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const replyToMessage = useMessageStore((state) =>
    state.replyToId ? state.messagesById.get(state.replyToId) : null
  );
  const setReplyTo = useMessageStore((state) => state.setReplyTo);

  const handleInput = useCallback(
    (value: string) => {
      setContent(value);

      // Handle typing indicator
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
    if (!trimmed || disabled) {
      return;
    }

    onSend(trimmed, replyToMessage?.id);
    setContent("");
    setReplyTo(null);

    // Clear typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    onTyping(false);

    // Focus back to textarea
    textareaRef.current?.focus();
  }, [content, disabled, onSend, onTyping, replyToMessage, setReplyTo]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const cancelReply = useCallback(() => {
    setReplyTo(null);
  }, [setReplyTo]);

  return (
    <div className="border-gray-200 border-t p-4 dark:border-dark-600">
      {/* Reply preview */}
      {replyToMessage && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 dark:bg-dark-700">
          <div className="min-w-0 flex-1">
            <p className="text-gray-500 text-xs dark:text-gray-400">
              Replying to{" "}
              <span className="font-medium">
                {replyToMessage.sender.username}
              </span>
            </p>
            <p className="truncate text-gray-700 text-sm dark:text-gray-300">
              {replyToMessage.content ?? "Attachment"}
            </p>
          </div>
          <button
            className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            onClick={cancelReply}
            type="button"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2">
        <button
          className={cn(
            "rounded-lg p-2 text-gray-500 hover:text-gray-700",
            "hover:bg-gray-100 dark:hover:bg-dark-700",
            "transition-colors disabled:opacity-50"
          )}
          disabled={disabled}
          onClick={onAttach}
          title="Attach file"
          type="button"
        >
          📎
        </button>

        <div className="relative flex-1">
          <textarea
            className={cn(
              "w-full resize-none rounded-lg border px-4 py-2.5",
              "bg-white dark:bg-dark-800",
              "border-gray-300 dark:border-dark-500",
              "text-gray-900 dark:text-gray-100",
              "placeholder:text-gray-500 dark:placeholder:text-gray-400",
              "focus:outline-none focus:ring-2 focus:ring-blue-500",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "max-h-32 overflow-y-auto"
            )}
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

        <Button
          disabled={disabled || !content.trim()}
          onClick={handleSend}
          size="md"
        >
          Send
        </Button>
      </div>

      {/* Hint */}
      <p className="mt-2 text-gray-500 text-xs dark:text-gray-400">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}

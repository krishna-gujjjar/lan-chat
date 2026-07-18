/**
 * Message input component with attachment support.
 */

import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { invokeOrThrow } from "@/shared/lib/tauri/invoke";
import { useMessageStore } from "@/shared/stores/message-store";
import type { UUID } from "@/shared/types/common";
import { cn } from "@/utils/cn";

interface MessageInputProps {
  readonly disabled?: boolean;
  readonly onAttach: (filePaths: string[]) => Promise<UUID[]>;
  readonly onEdit: (messageId: UUID, content: string) => void;
  readonly onPasteImage: () => Promise<UUID | null>;
  readonly onImportImageUrl: (url: string) => Promise<UUID | null>;
  readonly onSend: (
    content: string,
    replyToId?: UUID,
    attachmentIds?: UUID[]
  ) => void;
  readonly onTyping: (isTyping: boolean) => void;
}

export function MessageInput({
  onSend,
  onEdit,
  onPasteImage,
  onImportImageUrl,
  onTyping,
  onAttach,
  disabled = false,
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<UUID[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const replyToId = useMessageStore((state) => state.replyToId);
  const editingMessageId = useMessageStore((state) => state.editingMessageId);
  const messages = useMessageStore((state) => state.messages);
  const setReplyTo = useMessageStore((state) => state.setReplyTo);
  const setEditingMessage = useMessageStore((state) => state.setEditingMessage);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void getCurrentWindow().onDragDropEvent(async (event) => {
      if (event.payload.type === "enter" || event.payload.type === "over") {
        setIsDragging(true);
      } else if (event.payload.type === "leave") {
        setIsDragging(false);
      } else if (event.payload.type === "drop") {
        setIsDragging(false);
        if (event.payload.paths.length > 0) {
          setIsUploading(true);
          const ids = await onAttach(event.payload.paths);
          setAttachments((current) => [...current, ...ids]);
          setIsUploading(false);
        }
      }
    }).then((dispose) => { unlisten = dispose; });
    return () => { unlisten?.(); };
  }, [onAttach]);

  useEffect(() => {
    if (!editingMessageId) return;
    const message = messages.find((item) => item.id === editingMessageId);
    setContent(message?.content ?? "");
    textareaRef.current?.focus();
  }, [editingMessageId, messages]);

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

    if (editingMessageId) {
      onEdit(editingMessageId, trimmed);
      setEditingMessage(null);
    } else {
      onSend(
        trimmed,
        replyToMessage?.id,
        attachments.length > 0 ? attachments : undefined
      );
    }
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
    editingMessageId,
    onEdit,
    onSend,
    onTyping,
    replyToMessage,
    setEditingMessage,
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

  const handleBrowserDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const uriList = event.dataTransfer.getData("text/uri-list");
    const html = event.dataTransfer.getData("text/html");
    const plain = event.dataTransfer.getData("text/plain");
    const draggedImage = html
      ? new DOMParser().parseFromString(html, "text/html").querySelector("img")
      : null;
    const imageSource = draggedImage?.getAttribute("data-original")
      ?? draggedImage?.getAttribute("data-src")
      ?? draggedImage?.getAttribute("src")
      ?? undefined;
    const url = (imageSource || uriList || plain)
      .split(/\r?\n/)
      .find((value) => /^https?:\/\//i.test(value.trim()))
      ?.trim();
    if (!url) return;
    setIsUploading(true);
    const id = await onImportImageUrl(url);
    if (id) setAttachments((current) => [...current, id]);
    setIsUploading(false);
  }, [onImportImageUrl]);

  const handlePaste = useCallback(async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const hasImage = [...event.clipboardData.items].some((item) => item.type.startsWith("image/"));
    if (!hasImage) return;
    event.preventDefault();
    setIsUploading(true);
    const id = await onPasteImage();
    if (id) setAttachments((current) => [...current, id]);
    setIsUploading(false);
  }, [onPasteImage]);

  const cancelReply = useCallback(() => {
    setReplyTo(null);
  }, [setReplyTo]);

  const removeAttachment = useCallback((id: UUID) => {
    setAttachments((prev) => prev.filter((a) => a !== id));
  }, []);

  return (
    <div
      className={cn("composer-shell", isDragging && "ring-2 ring-inset ring-retro-green")}
      onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => void handleBrowserDrop(event)}
    >
      {isDragging ? <div className="absolute inset-0 z-20 grid place-items-center bg-retro-bg/90 font-pixel text-xs text-retro-green">DROP FILES TO ATTACH</div> : null}
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
            <PendingAttachment
              id={id}
              key={id}
              onRemove={() => removeAttachment(id)}
            />
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
            onPaste={handlePaste}
            placeholder={editingMessageId ? "Edit your message..." : "Type a message..."}
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
          {editingMessageId ? "SAVE" : "SEND"}
        </button>
      </div>

      {/* Hint */}
      <p className="mt-2 font-terminal text-retro-text-dim text-xs">
        ENTER to send | SHIFT+ENTER for new line
      </p>
    </div>
  );
}
function PendingAttachment({ id, onRemove }: { readonly id: UUID; readonly onRemove: () => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void invokeOrThrow("get_attachment_preview", { attachmentId: id })
      .then((value) => { if (active) setPreview(value); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [id]);
  return (
    <div className="relative overflow-hidden border border-retro-green-dim bg-retro-bg text-retro-green">
      {preview ? <img alt="Pending upload" className="h-24 w-32 object-contain [image-rendering:auto]" src={preview} /> : <span className="block px-3 py-2 text-xs">FILE READY</span>}
      <button aria-label="Remove attachment" className="absolute right-1 top-1 bg-retro-bg px-1 text-retro-text hover:text-retro-red" onClick={onRemove} type="button">×</button>
    </div>
  );
}

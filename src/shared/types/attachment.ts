/**
 * Attachment domain types.
 * Represents files and images attached to messages.
 */

import type { ISODateString, TransferStatus, UUID } from "./common";

/** Supported file categories */
export type FileCategory = "image" | "video" | "document" | "archive" | "other";

/** MIME type mapping to category */
export const MIME_CATEGORY_MAP: Record<string, FileCategory> = {
  "application/msword": "document",
  "application/pdf": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "document",
  "application/x-7z-compressed": "archive",
  "application/x-rar-compressed": "archive",
  "application/zip": "archive",
  "image/gif": "image",
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "text/csv": "document",
  "text/plain": "document",
  "video/mp4": "video",
  "video/webm": "video",
} as const;

/** Attachment metadata stored in database */
export interface Attachment {
  readonly checksum: string;
  readonly createdAt: ISODateString;
  readonly height: number | null;
  readonly id: UUID;
  readonly isImage: boolean;
  readonly messageId: UUID;
  readonly mimeType: string;
  readonly originalFilename: string;
  readonly sizeBytes: number;
  readonly storedFilename: string;
  readonly width: number | null;
}

/** Attachment with download state */
export interface AttachmentWithDownloadState extends Attachment {
  readonly downloadProgress: number;
  readonly downloadStatus: TransferStatus | null;
  readonly localPath: string | null;
}

/** Data for creating an attachment */
export interface CreateAttachmentInput {
  readonly filePath: string;
  readonly messageId: UUID;
  readonly originalFilename: string;
}

/** Upload progress information */
export interface UploadProgress {
  readonly attachmentId: UUID;
  readonly bytesUploaded: number;
  readonly percentage: number;
  readonly totalBytes: number;
}

/** Download entity */
export interface Download {
  readonly attachmentId: UUID;
  readonly completedAt: ISODateString | null;
  readonly createdAt: ISODateString;
  readonly id: UUID;
  readonly localPath: string | null;
  readonly progressBytes: number;
  readonly startedAt: ISODateString | null;
  readonly status: TransferStatus;
  readonly updatedAt: ISODateString;
}

/** Download progress event */
export interface DownloadProgress {
  readonly attachmentId: UUID;
  readonly bytesDownloaded: number;
  readonly bytesPerSecond: number;
  readonly downloadId: UUID;
  readonly estimatedTimeRemaining: number | null;
  readonly percentage: number;
  readonly totalBytes: number;
}

/** File validation result */
export interface FileValidationResult {
  readonly category: FileCategory;
  readonly error: string | null;
  readonly isValid: boolean;
  readonly sanitizedFilename: string;
}

/** Helper to get file category from MIME type */
export function getFileCategory(mimeType: string): FileCategory {
  return MIME_CATEGORY_MAP[mimeType] ?? "other";
}

/** Helper to check if file is an image */
export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/** Format file size for display */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

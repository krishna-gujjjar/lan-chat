/**
 * Zod validation schemas for attachment-related data.
 */

import { z } from "zod";
import { isoDateSchema, uuidSchema } from "./user-schema";

/** Maximum file size (100MB) */
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

/** Allowed MIME types */
export const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "application/octet-stream",
] as const;

/** MIME type schema */
export const mimeTypeSchema = z.string().min(1);

/** File size schema */
export const fileSizeSchema = z
  .number()
  .int()
  .positive()
  .max(MAX_FILE_SIZE, "File size exceeds maximum allowed");

/** Checksum schema (SHA-256) */
export const checksumSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/i, "Invalid checksum format");

/** Filename schema */
export const filenameSchema = z
  .string()
  .min(1, "Filename is required")
  .max(255, "Filename is too long")
  .refine(
    (name) =>
      !(name.includes("..") || name.includes("/") || name.includes("\\")),
    "Invalid filename"
  );

/** Attachment schema */
export const attachmentSchema = z.object({
  checksum: checksumSchema,
  createdAt: isoDateSchema,
  height: z.number().int().positive().nullable(),
  id: uuidSchema,
  isImage: z.boolean(),
  messageId: uuidSchema,
  mimeType: mimeTypeSchema,
  originalFilename: filenameSchema,
  sizeBytes: fileSizeSchema,
  storedFilename: z.string(),
  width: z.number().int().positive().nullable(),
});

/** Transfer status enum */
export const transferStatusSchema = z.enum([
  "pending",
  "in_progress",
  "paused",
  "completed",
  "failed",
  "cancelled",
]);

/** Download schema */
export const downloadSchema = z.object({
  attachmentId: uuidSchema,
  completedAt: isoDateSchema.nullable(),
  createdAt: isoDateSchema,
  id: uuidSchema,
  localPath: z.string().nullable(),
  progressBytes: z.number().int().nonnegative(),
  startedAt: isoDateSchema.nullable(),
  status: transferStatusSchema,
  updatedAt: isoDateSchema,
});

/** Download progress schema */
export const downloadProgressSchema = z.object({
  attachmentId: uuidSchema,
  bytesDownloaded: z.number().int().nonnegative(),
  bytesPerSecond: z.number().nonnegative(),
  downloadId: uuidSchema,
  estimatedTimeRemaining: z.number().nullable(),
  percentage: z.number().min(0).max(100),
  totalBytes: z.number().int().positive(),
});

/** Type exports */
export type AttachmentSchemaType = z.infer<typeof attachmentSchema>;
export type DownloadSchemaType = z.infer<typeof downloadSchema>;
export type DownloadProgressSchemaType = z.infer<typeof downloadProgressSchema>;

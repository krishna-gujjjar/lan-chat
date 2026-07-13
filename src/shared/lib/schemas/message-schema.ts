/**
 * Zod validation schemas for message-related data.
 */

import { z } from "zod";
import { isoDateSchema, uuidSchema } from "./user-schema";

/** Message content validation */
export const messageContentSchema = z
  .string()
  .min(1, "Message cannot be empty")
  .max(10_000, "Message is too long");

/** Message status enum */
export const messageStatusSchema = z.enum([
  "sending",
  "sent",
  "delivered",
  "read",
  "failed",
]);

/** Reaction schema */
export const reactionSchema = z.object({
  createdAt: isoDateSchema,
  emoji: z.string().emoji("Invalid emoji"),
  id: uuidSchema,
  messageId: uuidSchema,
  userId: uuidSchema,
  username: z.string(),
});

/** Mention schema */
export const mentionSchema = z.object({
  id: uuidSchema,
  messageId: uuidSchema,
  userId: uuidSchema,
  username: z.string(),
});

/** Message schema */
export const messageSchema = z.object({
  content: z.string().nullable(),
  createdAt: isoDateSchema,
  id: uuidSchema,
  isDeleted: z.boolean(),
  isEdited: z.boolean(),
  replyToId: uuidSchema.nullable(),
  senderId: uuidSchema,
  status: messageStatusSchema,
  updatedAt: isoDateSchema,
});

/** Create message input schema */
export const createMessageInputSchema = z.object({
  attachmentIds: z.array(uuidSchema).optional(),
  content: messageContentSchema,
  mentionedUserIds: z.array(uuidSchema).optional(),
  replyToId: uuidSchema.optional(),
});

/** Update message input schema */
export const updateMessageInputSchema = z.object({
  content: messageContentSchema,
});

/** Message search params schema */
export const messageSearchParamsSchema = z.object({
  endDate: isoDateSchema.optional(),
  hasAttachments: z.boolean().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional(),
  query: z.string().min(1),
  senderId: uuidSchema.optional(),
  startDate: isoDateSchema.optional(),
});

/** Add reaction input schema */
export const addReactionInputSchema = z.object({
  emoji: z.string().emoji("Invalid emoji"),
  messageId: uuidSchema,
});

/** Type exports */
export type MessageSchemaType = z.infer<typeof messageSchema>;
export type CreateMessageInputSchemaType = z.infer<
  typeof createMessageInputSchema
>;
export type ReactionSchemaType = z.infer<typeof reactionSchema>;

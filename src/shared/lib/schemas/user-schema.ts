/**
 * Zod validation schemas for user-related data.
 */

import { z } from "zod";

/** UUID validation regex */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** UUID schema */
export const uuidSchema = z.string().regex(UUID_REGEX, "Invalid UUID format");

/** ISO date string schema */
export const isoDateSchema = z.string().datetime();

/** Username validation */
export const usernameSchema = z
  .string()
  .min(2, "Username must be at least 2 characters")
  .max(32, "Username must be at most 32 characters")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Username can only contain letters, numbers, underscores, and hyphens"
  );

/** User schema */
export const userSchema = z.object({
  avatarPath: z.string().nullable(),
  createdAt: isoDateSchema,
  id: uuidSchema,
  isLocal: z.boolean(),
  lastSeenAt: isoDateSchema.nullable(),
  updatedAt: isoDateSchema,
  username: usernameSchema,
});

/** Create user input schema */
export const createUserInputSchema = z.object({
  avatarPath: z.string().optional(),
  username: usernameSchema,
});

/** Update user input schema */
export const updateUserInputSchema = z.object({
  avatarPath: z.string().nullable().optional(),
  username: usernameSchema.optional(),
});

/** User presence schema */
export const userPresenceSchema = z.object({
  isOnline: z.boolean(),
  isTyping: z.boolean(),
  lastSeenAt: isoDateSchema,
  userId: uuidSchema,
});

/** Typing indicator schema */
export const typingIndicatorSchema = z.object({
  isTyping: z.boolean(),
  timestamp: isoDateSchema,
  userId: uuidSchema,
  username: z.string(),
});

/** Type exports from schemas */
export type UserSchemaType = z.infer<typeof userSchema>;
export type CreateUserInputSchemaType = z.infer<typeof createUserInputSchema>;
export type UpdateUserInputSchemaType = z.infer<typeof updateUserInputSchema>;

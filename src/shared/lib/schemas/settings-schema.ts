/**
 * Zod validation schemas for settings.
 */

import { z } from "zod";

/** Theme mode enum */
export const themeModeSchema = z.enum(["light", "dark", "system"]);

/** Font size enum */
export const fontSizeSchema = z.enum(["small", "medium", "large"]);

/** Language schema */
export const languageSchema = z.enum(["en", "es", "fr", "de", "ja", "zh"]);

/** App settings schema */
export const appSettingsSchema = z.object({
  autoDownloadFiles: z.boolean(),
  autoDownloadImages: z.boolean(),
  autoStartEnabled: z.boolean(),
  downloadLocation: z.string(),
  fontSize: fontSizeSchema,
  language: languageSchema,
  maxAutoDownloadSize: z.number().int().positive(),
  minimizeToTray: z.boolean(),
  notificationsEnabled: z.boolean(),
  showInTaskbar: z.boolean(),
  soundEnabled: z.boolean(),
  theme: themeModeSchema,
});

/** Update settings input - all fields optional */
export const updateSettingsInputSchema = appSettingsSchema.partial();

/** Notification settings schema */
export const notificationSettingsSchema = z.object({
  enabled: z.boolean(),
  showOnlyMentions: z.boolean(),
  showPreview: z.boolean(),
  showSenderName: z.boolean(),
  sound: z.boolean(),
});

/** Privacy settings schema */
export const privacySettingsSchema = z.object({
  showOnlineStatus: z.boolean(),
  showReadReceipts: z.boolean(),
  showTypingIndicator: z.boolean(),
});

/** Network settings schema */
export const networkSettingsSchema = z.object({
  connectionTimeout: z.number().int().min(1000).max(60_000),
  discoveryEnabled: z.boolean(),
  heartbeatInterval: z.number().int().min(1000).max(30_000),
  maxConnections: z.number().int().min(1).max(100),
  port: z.number().int().min(1024).max(65_535),
});

/** Type exports */
export type AppSettingsSchemaType = z.infer<typeof appSettingsSchema>;
export type UpdateSettingsInputSchemaType = z.infer<
  typeof updateSettingsInputSchema
>;
export type NotificationSettingsSchemaType = z.infer<
  typeof notificationSettingsSchema
>;

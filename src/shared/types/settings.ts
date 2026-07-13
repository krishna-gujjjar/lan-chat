/**
 * Settings domain types.
 * Application configuration and preferences.
 */

import type { ThemeMode } from "./common";

/** Application settings */
export interface AppSettings {
  readonly autoDownloadFiles: boolean;
  readonly autoDownloadImages: boolean;
  readonly autoStartEnabled: boolean;
  readonly downloadLocation: string;
  readonly fontSize: FontSize;
  readonly language: string;
  readonly maxAutoDownloadSize: number;
  readonly minimizeToTray: boolean;
  readonly notificationsEnabled: boolean;
  readonly showInTaskbar: boolean;
  readonly soundEnabled: boolean;
  readonly theme: ThemeMode;
}

/** Font size options */
export type FontSize = "small" | "medium" | "large";

/** Default settings values */
export const DEFAULT_SETTINGS: AppSettings = {
  autoDownloadFiles: false,
  autoDownloadImages: false,
  autoStartEnabled: false,
  downloadLocation: "",
  fontSize: "medium",
  language: "en",
  maxAutoDownloadSize: 10 * 1024 * 1024,
  minimizeToTray: true,
  notificationsEnabled: true,
  showInTaskbar: true,
  soundEnabled: true,
  theme: "system",
} as const;

/** Settings update input */
export type UpdateSettingsInput = Partial<AppSettings>;

/** Setting key-value pair for database */
export interface SettingRecord {
  readonly key: keyof AppSettings;
  readonly updatedAt: string;
  readonly value: string;
}

/** Notification settings */
export interface NotificationSettings {
  readonly enabled: boolean;
  readonly showOnlyMentions: boolean;
  readonly showPreview: boolean;
  readonly showSenderName: boolean;
  readonly sound: boolean;
}

/** Privacy settings */
export interface PrivacySettings {
  readonly showOnlineStatus: boolean;
  readonly showReadReceipts: boolean;
  readonly showTypingIndicator: boolean;
}

/** Storage settings */
export interface StorageSettings {
  readonly autoDownloadFiles: boolean;
  readonly autoDownloadImages: boolean;
  readonly clearCacheOnExit: boolean;
  readonly downloadLocation: string;
  readonly maxAutoDownloadSizeMb: number;
}

/** Network settings */
export interface NetworkSettings {
  readonly connectionTimeout: number;
  readonly discoveryEnabled: boolean;
  readonly heartbeatInterval: number;
  readonly maxConnections: number;
  readonly port: number;
}

/** Font size to pixel mapping */
export const FONT_SIZE_PX: Record<FontSize, number> = {
  large: 17,
  medium: 15,
  small: 13,
} as const;

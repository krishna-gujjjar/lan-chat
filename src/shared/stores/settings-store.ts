/**
 * Settings state management using Zustand.
 * Handles application preferences with persistence.
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import type { AppSettings, FontSize, ThemeMode } from "@/shared/types";
import { DEFAULT_SETTINGS } from "@/shared/types";

interface SettingsState {
  /** Loading state */
  readonly isLoading: boolean;
  /** Sync status with backend */
  readonly isSynced: boolean;
  /** Application settings */
  readonly settings: AppSettings;
}

interface SettingsActions {
  /** Reset to defaults */
  resetToDefaults: () => void;
  /** Set download location */
  setDownloadLocation: (path: string) => void;
  /** Set font size */
  setFontSize: (fontSize: FontSize) => void;
  /** Set loading state */
  setLoading: (isLoading: boolean) => void;
  /** Update a single setting */
  setSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => void;
  /** Update multiple settings */
  setSettings: (updates: Partial<AppSettings>) => void;
  /** Set sync status */
  setSynced: (isSynced: boolean) => void;
  /** Set theme */
  setTheme: (theme: ThemeMode) => void;
  /** Toggle notification */
  toggleNotifications: () => void;
  /** Toggle sound */
  toggleSound: () => void;
}

type SettingsStore = SettingsState & SettingsActions;

const initialState: SettingsState = {
  isLoading: false,
  isSynced: false,
  settings: DEFAULT_SETTINGS,
};

export const useSettingsStore = create<SettingsStore>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        resetToDefaults: () => {
          set(
            { isSynced: false, settings: DEFAULT_SETTINGS },
            false,
            "resetToDefaults"
          );
        },

        setDownloadLocation: (path) => {
          set(
            (state) => ({
              isSynced: false,
              settings: { ...state.settings, downloadLocation: path },
            }),
            false,
            "setDownloadLocation"
          );
        },

        setFontSize: (fontSize) => {
          set(
            (state) => ({
              isSynced: false,
              settings: { ...state.settings, fontSize },
            }),
            false,
            "setFontSize"
          );
        },

        setLoading: (isLoading) => {
          set({ isLoading }, false, "setLoading");
        },

        setSetting: (key, value) => {
          set(
            (state) => ({
              isSynced: false,
              settings: { ...state.settings, [key]: value },
            }),
            false,
            "setSetting"
          );
        },

        setSettings: (updates) => {
          set(
            (state) => ({
              isSynced: false,
              settings: { ...state.settings, ...updates },
            }),
            false,
            "setSettings"
          );
        },

        setSynced: (isSynced) => {
          set({ isSynced }, false, "setSynced");
        },

        setTheme: (theme) => {
          set(
            (state) => ({
              isSynced: false,
              settings: { ...state.settings, theme },
            }),
            false,
            "setTheme"
          );
        },

        toggleNotifications: () => {
          set(
            (state) => ({
              isSynced: false,
              settings: {
                ...state.settings,
                notificationsEnabled: !state.settings.notificationsEnabled,
              },
            }),
            false,
            "toggleNotifications"
          );
        },

        toggleSound: () => {
          set(
            (state) => ({
              isSynced: false,
              settings: {
                ...state.settings,
                soundEnabled: !state.settings.soundEnabled,
              },
            }),
            false,
            "toggleSound"
          );
        },
      }),
      {
        name: "lanchat-settings",
        partialize: (state) => ({ settings: state.settings }),
      }
    ),
    { name: "settings-store" }
  )
);

/** Selector for theme */
export const selectTheme = (state: SettingsStore) => state.settings.theme;

/** Selector for font size */
export const selectFontSize = (state: SettingsStore) => state.settings.fontSize;

/** Selector for notification settings */
export const selectNotificationSettings = (state: SettingsStore) => ({
  enabled: state.settings.notificationsEnabled,
  sound: state.settings.soundEnabled,
});

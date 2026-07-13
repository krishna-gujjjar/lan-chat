//! Settings domain model.

use serde::{Deserialize, Serialize};

/// Theme mode preference.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ThemeMode {
    Light,
    Dark,
    System,
}

impl Default for ThemeMode {
    fn default() -> Self {
        Self::System
    }
}

/// Font size preference.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FontSize {
    Small,
    Medium,
    Large,
}

impl Default for FontSize {
    fn default() -> Self {
        Self::Medium
    }
}

/// Application settings.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: ThemeMode,
    pub font_size: FontSize,
    pub notifications_enabled: bool,
    pub sound_enabled: bool,
    pub download_location: String,
    pub auto_download_images: bool,
    pub auto_download_files: bool,
    pub max_auto_download_size: i64,
    pub auto_start_enabled: bool,
    pub minimize_to_tray: bool,
    pub show_in_taskbar: bool,
    pub language: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: ThemeMode::System,
            font_size: FontSize::Medium,
            notifications_enabled: true,
            sound_enabled: true,
            download_location: String::new(),
            auto_download_images: false,
            auto_download_files: false,
            max_auto_download_size: 10 * 1024 * 1024, // 10 MB
            auto_start_enabled: false,
            minimize_to_tray: true,
            show_in_taskbar: true,
            language: "en".to_string(),
        }
    }
}

/// Input for updating settings.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSettingsInput {
    pub theme: Option<ThemeMode>,
    pub font_size: Option<FontSize>,
    pub notifications_enabled: Option<bool>,
    pub sound_enabled: Option<bool>,
    pub download_location: Option<String>,
    pub auto_download_images: Option<bool>,
    pub auto_download_files: Option<bool>,
    pub max_auto_download_size: Option<i64>,
    pub auto_start_enabled: Option<bool>,
    pub minimize_to_tray: Option<bool>,
    pub show_in_taskbar: Option<bool>,
    pub language: Option<String>,
}

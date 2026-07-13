//! Settings service for managing application settings.

use crate::database::Database;
use crate::errors::AppResult;
use crate::models::{AppSettings, UpdateSettingsInput};
use chrono::Utc;
use sqlx::Row;
use std::sync::Arc;

/// Service for settings-related operations.
pub struct SettingsService {
    database: Arc<Database>,
}

impl SettingsService {
    /// Create a new settings service.
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    /// Load all settings from database.
    pub async fn load_settings(&self) -> AppResult<AppSettings> {
        let rows = sqlx::query("SELECT key, value FROM settings")
            .fetch_all(self.database.pool())
            .await?;

        let mut settings = AppSettings::default();

        for row in rows {
            let key: String = row.try_get("key")?;
            let value: String = row.try_get("value")?;

            match key.as_str() {
                "theme" => {
                    settings.theme = serde_json::from_str(&value).unwrap_or_default();
                }
                "font_size" => {
                    settings.font_size = serde_json::from_str(&value).unwrap_or_default();
                }
                "notifications_enabled" => {
                    settings.notifications_enabled =
                        serde_json::from_str(&value).unwrap_or(true);
                }
                "sound_enabled" => {
                    settings.sound_enabled = serde_json::from_str(&value).unwrap_or(true);
                }
                "download_location" => {
                    settings.download_location =
                        serde_json::from_str(&value).unwrap_or_default();
                }
                "auto_download_images" => {
                    settings.auto_download_images =
                        serde_json::from_str(&value).unwrap_or(false);
                }
                "auto_download_files" => {
                    settings.auto_download_files =
                        serde_json::from_str(&value).unwrap_or(false);
                }
                "max_auto_download_size" => {
                    settings.max_auto_download_size =
                        serde_json::from_str(&value).unwrap_or(10 * 1024 * 1024);
                }
                "auto_start_enabled" => {
                    settings.auto_start_enabled =
                        serde_json::from_str(&value).unwrap_or(false);
                }
                "minimize_to_tray" => {
                    settings.minimize_to_tray = serde_json::from_str(&value).unwrap_or(true);
                }
                "show_in_taskbar" => {
                    settings.show_in_taskbar = serde_json::from_str(&value).unwrap_or(true);
                }
                "language" => {
                    settings.language =
                        serde_json::from_str(&value).unwrap_or_else(|_| "en".to_string());
                }
                _ => {}
            }
        }

        Ok(settings)
    }

    /// Save a single setting.
    pub async fn save_setting(&self, key: &str, value: &str) -> AppResult<()> {
        let now = Utc::now().to_rfc3339();

        sqlx::query(
            r#"
            INSERT INTO settings (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(key)
        .bind(value)
        .bind(&now)
        .execute(self.database.pool())
        .await?;

        Ok(())
    }

    /// Update settings.
    pub async fn update_settings(&self, input: UpdateSettingsInput) -> AppResult<AppSettings> {
        if let Some(theme) = &input.theme {
            self.save_setting("theme", &serde_json::to_string(theme)?).await?;
        }
        if let Some(font_size) = &input.font_size {
            self.save_setting("font_size", &serde_json::to_string(font_size)?).await?;
        }
        if let Some(v) = input.notifications_enabled {
            self.save_setting("notifications_enabled", &serde_json::to_string(&v)?).await?;
        }
        if let Some(v) = input.sound_enabled {
            self.save_setting("sound_enabled", &serde_json::to_string(&v)?).await?;
        }
        if let Some(v) = &input.download_location {
            self.save_setting("download_location", &serde_json::to_string(v)?).await?;
        }
        if let Some(v) = input.auto_download_images {
            self.save_setting("auto_download_images", &serde_json::to_string(&v)?).await?;
        }
        if let Some(v) = input.auto_download_files {
            self.save_setting("auto_download_files", &serde_json::to_string(&v)?).await?;
        }
        if let Some(v) = input.max_auto_download_size {
            self.save_setting("max_auto_download_size", &serde_json::to_string(&v)?).await?;
        }
        if let Some(v) = input.auto_start_enabled {
            self.save_setting("auto_start_enabled", &serde_json::to_string(&v)?).await?;
        }
        if let Some(v) = input.minimize_to_tray {
            self.save_setting("minimize_to_tray", &serde_json::to_string(&v)?).await?;
        }
        if let Some(v) = input.show_in_taskbar {
            self.save_setting("show_in_taskbar", &serde_json::to_string(&v)?).await?;
        }
        if let Some(v) = &input.language {
            self.save_setting("language", &serde_json::to_string(v)?).await?;
        }

        self.load_settings().await
    }
}

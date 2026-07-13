//! Settings-related commands.

use crate::models::{AppSettings, UpdateSettingsInput};
use crate::state::AppState;
use std::sync::Arc;
use tauri::State;

/// Get current application settings.
#[tauri::command]
pub async fn get_settings(
    state: State<'_, Arc<AppState>>,
) -> Result<AppSettings, String> {
    let settings = state.settings.read().await;
    Ok(settings.clone())
}

/// Update application settings.
#[tauri::command]
pub async fn update_settings(
    state: State<'_, Arc<AppState>>,
    input: UpdateSettingsInput,
) -> Result<AppSettings, String> {
    let updated = state
        .settings_service
        .update_settings(input)
        .await
        .map_err(|e| e.to_string())?;

    // Update cached settings
    let mut settings = state.settings.write().await;
    *settings = updated.clone();

    Ok(updated)
}

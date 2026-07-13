//! Application lifecycle commands.

use crate::models::{CreateUserInput, User};
use crate::state::AppState;
use std::sync::Arc;
use tauri::State;

/// Initialize the application with a username.
/// Creates the local user if it doesn't exist.
#[tauri::command]
pub async fn initialize_app(
    state: State<'_, Arc<AppState>>,
    username: String,
) -> Result<User, String> {
    // Check if user already exists
    let existing = state.current_user.read().await;
    if let Some(user) = existing.as_ref() {
        return Ok(user.clone());
    }
    drop(existing);

    // Create new local user
    let input = CreateUserInput {
        username,
        avatar_path: None,
    };

    let user = state
        .user_service
        .create_local_user(input)
        .await
        .map_err(|e| e.to_string())?;

    // Cache the user
    let mut current = state.current_user.write().await;
    *current = Some(user.clone());

    tracing::info!("Application initialized for user: {}", user.username);

    Ok(user)
}

/// Get the application data directory path.
#[tauri::command]
pub async fn get_app_data_dir(
    state: State<'_, Arc<AppState>>,
) -> Result<String, String> {
    Ok(state.app_data_dir.to_string_lossy().to_string())
}

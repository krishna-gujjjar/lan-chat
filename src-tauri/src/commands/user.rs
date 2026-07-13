//! User-related commands.

use crate::models::{UpdateUserInput, User};
use crate::state::AppState;
use std::sync::Arc;
use tauri::State;

/// Get the current local user.
#[tauri::command]
pub async fn get_current_user(
    state: State<'_, Arc<AppState>>,
) -> Result<Option<User>, String> {
    let user = state.current_user.read().await;
    Ok(user.clone())
}

/// Update the current user's profile.
#[tauri::command]
pub async fn update_user(
    state: State<'_, Arc<AppState>>,
    input: UpdateUserInput,
) -> Result<User, String> {
    let current = state.current_user.read().await;
    let user_id = current
        .as_ref()
        .ok_or("No current user")?
        .id;
    drop(current);

    let updated = state
        .user_service
        .update_user(user_id, input)
        .await
        .map_err(|e| e.to_string())?;

    // Update cached user
    let mut current = state.current_user.write().await;
    *current = Some(updated.clone());

    Ok(updated)
}

/// Set user avatar from file path.
#[tauri::command]
pub async fn set_avatar(
    state: State<'_, Arc<AppState>>,
    file_path: String,
) -> Result<User, String> {
    use std::fs;
    use uuid::Uuid;

    let current = state.current_user.read().await;
    let user = current.as_ref().ok_or("No current user")?;
    let user_id = user.id;
    drop(current);

    // Copy file to avatars directory
    let extension = std::path::Path::new(&file_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");
    
    let new_filename = format!("{}.{}", Uuid::new_v4(), extension);
    let dest_path = state.avatars_dir().join(&new_filename);

    fs::copy(&file_path, &dest_path).map_err(|e| e.to_string())?;

    let avatar_path = dest_path.to_string_lossy().to_string();
    
    let input = UpdateUserInput {
        username: None,
        avatar_path: Some(avatar_path),
    };

    let updated = state
        .user_service
        .update_user(user_id, input)
        .await
        .map_err(|e| e.to_string())?;

    let mut current = state.current_user.write().await;
    *current = Some(updated.clone());

    Ok(updated)
}

/// Get all users.
#[tauri::command]
pub async fn get_all_users(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<User>, String> {
    state
        .user_service
        .get_all_users()
        .await
        .map_err(|e| e.to_string())
}

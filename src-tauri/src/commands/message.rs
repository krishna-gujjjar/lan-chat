//! Message-related commands.

use crate::models::{
    CreateMessageInput, MessageSearchParams, MessageWithDetails, PaginatedMessages, Reaction,
};
use crate::services::MessageService;
use crate::state::AppState;
use std::sync::Arc;
use tauri::Emitter;
use tauri::State;
use uuid::Uuid;

/// Send a new message.
#[tauri::command]
pub async fn send_message(
    state: State<'_, Arc<AppState>>,
    input: CreateMessageInput,
) -> Result<MessageWithDetails, String> {
    let current_user = state.current_user.read().await;
    let sender_id = current_user.as_ref().ok_or("No current user")?.id;
    drop(current_user);

    let service = MessageService::new(state.database.clone());

    let message = service
        .create_message(sender_id, input)
        .await
        .map_err(|e| e.to_string())?;

    // Resolve the exact row that was created. Querying the newest message was
    // race-prone when local and remote messages arrived at the same time.
    let msg_with_details = service
        .get_message_details(message)
        .await
        .map_err(|e| e.to_string())?;

    // Broadcast to peers
    let state_arc = state.inner().clone();
    let broadcast_msg = msg_with_details.clone();
    tokio::spawn(async move {
        let _ = crate::network::peer_connection::broadcast_message(state_arc, &broadcast_msg).await;
    });

    // Emit to frontend
    if let Some(app_handle) = state.app_handle.read().await.as_ref() {
        let _ = app_handle.emit("message:created", msg_with_details.clone());
    }

    Ok(msg_with_details)
}

/// Edit an existing message.
#[tauri::command]
pub async fn edit_message(
    state: State<'_, Arc<AppState>>,
    message_id: String,
    content: String,
) -> Result<MessageWithDetails, String> {
    let id = Uuid::parse_str(&message_id).map_err(|e| e.to_string())?;

    let service = MessageService::new(state.database.clone());

    let message = service
        .update_message(id, content)
        .await
        .map_err(|e| e.to_string())?;

    // Get full message details
    let messages = service
        .get_messages(100, None)
        .await
        .map_err(|e| e.to_string())?;

    let msg_with_details = messages
        .items
        .into_iter()
        .find(|m| m.message.id == message.id)
        .ok_or_else(|| "Failed to retrieve updated message".to_string())?;

    // Emit to frontend
    if let Some(app_handle) = state.app_handle.read().await.as_ref() {
        let _ = app_handle.emit("message:updated", msg_with_details.clone());
    }

    Ok(msg_with_details)
}

/// Delete a message.
#[tauri::command]
pub async fn delete_message(
    state: State<'_, Arc<AppState>>,
    message_id: String,
) -> Result<(), String> {
    let id = Uuid::parse_str(&message_id).map_err(|e| e.to_string())?;

    let service = MessageService::new(state.database.clone());

    service
        .delete_message(id)
        .await
        .map_err(|e| e.to_string())?;

    // Emit to frontend
    if let Some(app_handle) = state.app_handle.read().await.as_ref() {
        let _ = app_handle.emit(
            "message:deleted",
            serde_json::json!({"messageId": message_id}),
        );
    }

    Ok(())
}

/// Get messages with pagination.
#[tauri::command]
pub async fn get_messages(
    state: State<'_, Arc<AppState>>,
    limit: i64,
    before: Option<String>,
) -> Result<PaginatedMessages, String> {
    let before_id = before
        .map(|s| Uuid::parse_str(&s))
        .transpose()
        .map_err(|e| e.to_string())?;

    let service = MessageService::new(state.database.clone());

    service
        .get_messages(limit, before_id)
        .await
        .map_err(|e| e.to_string())
}

/// Search messages.
#[tauri::command]
pub async fn search_messages(
    state: State<'_, Arc<AppState>>,
    params: MessageSearchParams,
) -> Result<PaginatedMessages, String> {
    let service = MessageService::new(state.database.clone());

    service
        .search_messages(params)
        .await
        .map_err(|e| e.to_string())
}

/// Add a reaction to a message.
#[tauri::command]
pub async fn add_reaction(
    state: State<'_, Arc<AppState>>,
    message_id: String,
    emoji: String,
) -> Result<Reaction, String> {
    let msg_id = Uuid::parse_str(&message_id).map_err(|e| e.to_string())?;

    let current_user = state.current_user.read().await;
    let user = current_user.as_ref().ok_or("No current user")?;

    let reaction = Reaction::new(msg_id, user.id, user.username.clone(), emoji);

    // Insert into database
    sqlx::query(
        r#"
        INSERT INTO reactions (id, message_id, user_id, emoji, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(message_id, user_id, emoji) DO NOTHING
        "#,
    )
    .bind(reaction.id.to_string())
    .bind(reaction.message_id.to_string())
    .bind(reaction.user_id.to_string())
    .bind(&reaction.emoji)
    .bind(reaction.created_at.to_rfc3339())
    .execute(state.database.pool())
    .await
    .map_err(|e| e.to_string())?;

    // Emit to frontend
    if let Some(app_handle) = state.app_handle.read().await.as_ref() {
        let _ = app_handle.emit("reaction:added", reaction.clone());
    }

    Ok(reaction)
}

/// Remove a reaction.
#[tauri::command]
pub async fn remove_reaction(
    state: State<'_, Arc<AppState>>,
    reaction_id: String,
) -> Result<(), String> {
    let id = Uuid::parse_str(&reaction_id).map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM reactions WHERE id = ?")
        .bind(id.to_string())
        .execute(state.database.pool())
        .await
        .map_err(|e| e.to_string())?;

    // Emit to frontend
    if let Some(app_handle) = state.app_handle.read().await.as_ref() {
        let _ = app_handle.emit(
            "reaction:removed",
            serde_json::json!({"reactionId": reaction_id}),
        );
    }

    Ok(())
}

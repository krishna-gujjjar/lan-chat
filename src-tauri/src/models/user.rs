//! User domain model.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// User entity representing a chat participant.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub avatar_path: Option<String>,
    pub is_local: bool,
    pub last_seen_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl User {
    /// Create a new local user.
    pub fn new_local(username: String) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            username,
            avatar_path: None,
            is_local: true,
            last_seen_at: Some(now),
            created_at: now,
            updated_at: now,
        }
    }

    /// Create a new remote user.
    pub fn new_remote(id: Uuid, username: String) -> Self {
        let now = Utc::now();
        Self {
            id,
            username,
            avatar_path: None,
            is_local: false,
            last_seen_at: None,
            created_at: now,
            updated_at: now,
        }
    }
}

/// Input for creating a new user.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateUserInput {
    pub username: String,
    pub avatar_path: Option<String>,
}

/// Input for updating a user.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateUserInput {
    pub username: Option<String>,
    pub avatar_path: Option<String>,
}

/// User presence information.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserPresence {
    pub user_id: Uuid,
    pub is_online: bool,
    pub last_seen_at: DateTime<Utc>,
    pub is_typing: bool,
}

/// Typing indicator event.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TypingIndicator {
    pub user_id: Uuid,
    pub username: String,
    pub is_typing: bool,
    pub timestamp: DateTime<Utc>,
}

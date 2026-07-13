//! Message domain model.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::{Attachment, User};

/// Message delivery status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MessageStatus {
    Sending,
    Sent,
    Delivered,
    Read,
    Failed,
}

impl Default for MessageStatus {
    fn default() -> Self {
        Self::Sending
    }
}

/// Base message entity.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    pub id: Uuid,
    pub sender_id: Uuid,
    pub content: Option<String>,
    pub reply_to_id: Option<Uuid>,
    pub is_edited: bool,
    pub is_deleted: bool,
    pub status: MessageStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Message {
    /// Create a new message.
    pub fn new(sender_id: Uuid, content: String, reply_to_id: Option<Uuid>) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            sender_id,
            content: Some(content),
            reply_to_id,
            is_edited: false,
            is_deleted: false,
            status: MessageStatus::Sending,
            created_at: now,
            updated_at: now,
        }
    }
}

/// Message with all related data for display.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageWithDetails {
    #[serde(flatten)]
    pub message: Message,
    pub sender: User,
    pub reply_to: Option<Box<Message>>,
    pub attachments: Vec<Attachment>,
    pub reactions: Vec<Reaction>,
    pub mentions: Vec<Mention>,
    pub read_by: Vec<ReadReceipt>,
}

/// Reaction to a message.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Reaction {
    pub id: Uuid,
    pub message_id: Uuid,
    pub user_id: Uuid,
    pub username: String,
    pub emoji: String,
    pub created_at: DateTime<Utc>,
}

impl Reaction {
    /// Create a new reaction.
    pub fn new(message_id: Uuid, user_id: Uuid, username: String, emoji: String) -> Self {
        Self {
            id: Uuid::new_v4(),
            message_id,
            user_id,
            username,
            emoji,
            created_at: Utc::now(),
        }
    }
}

/// Mention in a message.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Mention {
    pub id: Uuid,
    pub message_id: Uuid,
    pub user_id: Uuid,
    pub username: String,
}

/// Read receipt for a message.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadReceipt {
    pub id: Uuid,
    pub message_id: Uuid,
    pub user_id: Uuid,
    pub read_at: DateTime<Utc>,
}

/// Input for creating a new message.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMessageInput {
    pub content: String,
    pub reply_to_id: Option<Uuid>,
    pub mentioned_user_ids: Option<Vec<Uuid>>,
    pub attachment_ids: Option<Vec<Uuid>>,
}

/// Input for updating a message.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMessageInput {
    pub content: String,
}

/// Message search parameters.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageSearchParams {
    pub query: String,
    pub sender_id: Option<Uuid>,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    pub has_attachments: Option<bool>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Paginated response wrapper.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedMessages {
    pub items: Vec<MessageWithDetails>,
    pub total: i64,
    pub has_more: bool,
}

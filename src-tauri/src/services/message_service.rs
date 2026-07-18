//! Message service for managing chat messages.

use crate::database::Database;
use crate::errors::{AppError, AppResult};
use crate::models::{
    Attachment, CreateMessageInput, Mention, Message, MessageSearchParams, MessageStatus,
    MessageWithDetails, PaginatedMessages, Reaction, ReadReceipt, User,
};
use chrono::Utc;
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;

/// Service for message-related operations.
pub struct MessageService {
    database: Arc<Database>,
}

impl MessageService {
    /// Create a new message service.
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    /// Create a new message.
    pub async fn create_message(
        &self,
        sender_id: Uuid,
        input: CreateMessageInput,
    ) -> AppResult<Message> {
        let message = Message::new(sender_id, input.content, input.reply_to_id);

        sqlx::query(
            r#"
            INSERT INTO messages (id, sender_id, content, reply_to_id, is_edited, is_deleted, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(message.id.to_string())
        .bind(message.sender_id.to_string())
        .bind(&message.content)
        .bind(message.reply_to_id.map(|id| id.to_string()))
        .bind(message.is_edited)
        .bind(message.is_deleted)
        .bind(format!("{:?}", message.status).to_lowercase())
        .bind(message.created_at.to_rfc3339())
        .bind(message.updated_at.to_rfc3339())
        .execute(self.database.pool())
        .await?;

        // Handle mentions
        if let Some(mention_ids) = input.mentioned_user_ids {
            for user_id in mention_ids {
                self.add_mention(message.id, user_id).await?;
            }
        }

        // Link attachments to this message
        if let Some(attachment_ids) = input.attachment_ids {
            for att_id in attachment_ids {
                sqlx::query("UPDATE attachments SET message_id = ? WHERE id = ?")
                    .bind(message.id.to_string())
                    .bind(att_id.to_string())
                    .execute(self.database.pool())
                    .await?;
            }
        }

        tracing::debug!("Created message: {}", message.id);
        Ok(message)
    }

    /// Add a mention to a message.
    async fn add_mention(&self, message_id: Uuid, user_id: Uuid) -> AppResult<()> {
        let id = Uuid::new_v4();
        let now = Utc::now();

        sqlx::query(
            r#"
            INSERT INTO mentions (id, message_id, user_id, created_at)
            VALUES (?, ?, ?, ?)
            "#,
        )
        .bind(id.to_string())
        .bind(message_id.to_string())
        .bind(user_id.to_string())
        .bind(now.to_rfc3339())
        .execute(self.database.pool())
        .await?;

        Ok(())
    }

    /// Update a message.
    pub async fn update_message(&self, id: Uuid, content: String) -> AppResult<Message> {
        let now = Utc::now();

        sqlx::query(
            r#"
            UPDATE messages
            SET content = ?, is_edited = 1, updated_at = ?
            WHERE id = ? AND is_deleted = 0
            "#,
        )
        .bind(&content)
        .bind(now.to_rfc3339())
        .bind(id.to_string())
        .execute(self.database.pool())
        .await?;

        self.get_message(id)
            .await?
            .ok_or_else(|| AppError::MessageNotFound(id.to_string()))
    }

    /// Delete a message (soft delete).
    pub async fn delete_message(&self, id: Uuid) -> AppResult<()> {
        let now = Utc::now();

        sqlx::query(
            r#"
            UPDATE messages
            SET is_deleted = 1, content = NULL, updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(now.to_rfc3339())
        .bind(id.to_string())
        .execute(self.database.pool())
        .await?;

        Ok(())
    }

    /// Get a message by ID.
    pub async fn get_message(&self, id: Uuid) -> AppResult<Option<Message>> {
        let row = sqlx::query(
            r#"
            SELECT id, sender_id, content, reply_to_id, is_edited, is_deleted, status, created_at, updated_at
            FROM messages
            WHERE id = ?
            "#,
        )
        .bind(id.to_string())
        .fetch_optional(self.database.pool())
        .await?;

        match row {
            Some(row) => Ok(Some(self.row_to_message(&row)?)),
            None => Ok(None),
        }
    }

    /// Get messages with pagination.
    pub async fn get_messages(
        &self,
        limit: i64,
        before_id: Option<Uuid>,
    ) -> AppResult<PaginatedMessages> {
        let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM messages")
            .fetch_one(self.database.pool())
            .await?;

        let rows = if let Some(before) = before_id {
            sqlx::query(
                r#"
                SELECT id, sender_id, content, reply_to_id, is_edited, is_deleted, status, created_at, updated_at
                FROM messages
                WHERE created_at < (SELECT created_at FROM messages WHERE id = ?)
                ORDER BY created_at DESC
                LIMIT ?
                "#,
            )
            .bind(before.to_string())
            .bind(limit)
            .fetch_all(self.database.pool())
            .await?
        } else {
            sqlx::query(
                r#"
                SELECT id, sender_id, content, reply_to_id, is_edited, is_deleted, status, created_at, updated_at
                FROM messages
                ORDER BY created_at DESC
                LIMIT ?
                "#,
            )
            .bind(limit)
            .fetch_all(self.database.pool())
            .await?
        };

        let mut messages = Vec::new();
        for row in &rows {
            let msg = self.row_to_message(row)?;
            let details = self.get_message_details(msg).await?;
            messages.push(details);
        }

        // Reverse to get chronological order
        messages.reverse();

        let has_more = (messages.len() as i64) < total;

        Ok(PaginatedMessages {
            items: messages,
            total,
            has_more,
        })
    }

    /// Search messages.
    pub async fn search_messages(
        &self,
        params: MessageSearchParams,
    ) -> AppResult<PaginatedMessages> {
        let limit = params.limit.unwrap_or(50);
        let offset = params.offset.unwrap_or(0);
        let search_pattern = format!("%{}%", params.query);

        let rows = sqlx::query(
            r#"
            SELECT id, sender_id, content, reply_to_id, is_edited, is_deleted, status, created_at, updated_at
            FROM messages
            WHERE content LIKE ? AND is_deleted = 0
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
            "#,
        )
        .bind(&search_pattern)
        .bind(limit)
        .bind(offset)
        .fetch_all(self.database.pool())
        .await?;

        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM messages WHERE content LIKE ? AND is_deleted = 0",
        )
        .bind(&search_pattern)
        .fetch_one(self.database.pool())
        .await?;

        let mut messages = Vec::new();
        for row in &rows {
            let msg = self.row_to_message(row)?;
            let details = self.get_message_details(msg).await?;
            messages.push(details);
        }

        let has_more = offset + limit < total;

        Ok(PaginatedMessages {
            items: messages,
            total,
            has_more,
        })
    }

    /// Get full message details including sender, attachments, reactions.
    pub async fn get_message_details(&self, message: Message) -> AppResult<MessageWithDetails> {
        // Get sender
        let sender = self.get_user(message.sender_id).await?;

        // Get reply_to message if exists
        let reply_to = if let Some(reply_id) = message.reply_to_id {
            self.get_message(reply_id).await?.map(Box::new)
        } else {
            None
        };

        // Get attachments
        let attachments = self.get_attachments(message.id).await?;

        // Get reactions
        let reactions = self.get_reactions(message.id).await?;

        // Get mentions
        let mentions = self.get_mentions(message.id).await?;

        // Get read receipts
        let read_by = self.get_read_receipts(message.id).await?;

        Ok(MessageWithDetails {
            message,
            sender,
            reply_to,
            attachments,
            reactions,
            mentions,
            read_by,
        })
    }

    /// Helper to get user (simplified).
    async fn get_user(&self, id: Uuid) -> AppResult<User> {
        let row = sqlx::query(
            r#"
            SELECT id, username, avatar_path, is_local, last_seen_at, created_at, updated_at
            FROM users WHERE id = ?
            "#,
        )
        .bind(id.to_string())
        .fetch_one(self.database.pool())
        .await?;

        self.row_to_user(&row)
    }

    /// Get attachments for a message.
    async fn get_attachments(&self, message_id: Uuid) -> AppResult<Vec<Attachment>> {
        let rows = sqlx::query(
            r#"
            SELECT id, message_id, original_filename, stored_filename, mime_type,
                   size_bytes, checksum, is_image, width, height, created_at
            FROM attachments WHERE message_id = ?
            "#,
        )
        .bind(message_id.to_string())
        .fetch_all(self.database.pool())
        .await?;

        rows.iter().map(|row| self.row_to_attachment(row)).collect()
    }

    /// Get reactions for a message.
    async fn get_reactions(&self, message_id: Uuid) -> AppResult<Vec<Reaction>> {
        let rows = sqlx::query(
            r#"
            SELECT r.id, r.message_id, r.user_id, u.username, r.emoji, r.created_at
            FROM reactions r
            JOIN users u ON r.user_id = u.id
            WHERE r.message_id = ?
            "#,
        )
        .bind(message_id.to_string())
        .fetch_all(self.database.pool())
        .await?;

        rows.iter().map(|row| self.row_to_reaction(row)).collect()
    }

    /// Get mentions for a message.
    async fn get_mentions(&self, message_id: Uuid) -> AppResult<Vec<Mention>> {
        let rows = sqlx::query(
            r#"
            SELECT m.id, m.message_id, m.user_id, u.username
            FROM mentions m
            JOIN users u ON m.user_id = u.id
            WHERE m.message_id = ?
            "#,
        )
        .bind(message_id.to_string())
        .fetch_all(self.database.pool())
        .await?;

        rows.iter().map(|row| self.row_to_mention(row)).collect()
    }

    /// Get read receipts for a message.
    async fn get_read_receipts(&self, message_id: Uuid) -> AppResult<Vec<ReadReceipt>> {
        let rows = sqlx::query(
            r#"
            SELECT id, message_id, user_id, read_at
            FROM read_receipts WHERE message_id = ?
            "#,
        )
        .bind(message_id.to_string())
        .fetch_all(self.database.pool())
        .await?;

        rows.iter()
            .map(|row| self.row_to_read_receipt(row))
            .collect()
    }

    // Row conversion helpers
    fn row_to_message(&self, row: &sqlx::sqlite::SqliteRow) -> AppResult<Message> {
        use chrono::DateTime;

        let id: String = row.try_get("id")?;
        let sender_id: String = row.try_get("sender_id")?;
        let reply_to_id: Option<String> = row.try_get("reply_to_id")?;
        let status: String = row.try_get("status")?;
        let created_at: String = row.try_get("created_at")?;
        let updated_at: String = row.try_get("updated_at")?;

        Ok(Message {
            id: Uuid::parse_str(&id).map_err(|e| AppError::Internal(e.to_string()))?,
            sender_id: Uuid::parse_str(&sender_id)
                .map_err(|e| AppError::Internal(e.to_string()))?,
            content: row.try_get("content")?,
            reply_to_id: reply_to_id
                .map(|s| Uuid::parse_str(&s))
                .transpose()
                .map_err(|e| AppError::Internal(e.to_string()))?,
            is_edited: row.try_get::<i32, _>("is_edited")? == 1,
            is_deleted: row.try_get::<i32, _>("is_deleted")? == 1,
            status: match status.as_str() {
                "sending" => MessageStatus::Sending,
                "sent" => MessageStatus::Sent,
                "delivered" => MessageStatus::Delivered,
                "read" => MessageStatus::Read,
                "failed" => MessageStatus::Failed,
                _ => MessageStatus::Sending,
            },
            created_at: DateTime::parse_from_rfc3339(&created_at)
                .map_err(|e| AppError::Internal(e.to_string()))?
                .with_timezone(&Utc),
            updated_at: DateTime::parse_from_rfc3339(&updated_at)
                .map_err(|e| AppError::Internal(e.to_string()))?
                .with_timezone(&Utc),
        })
    }

    fn row_to_user(&self, row: &sqlx::sqlite::SqliteRow) -> AppResult<User> {
        use chrono::DateTime;

        let id: String = row.try_get("id")?;
        let last_seen_at: Option<String> = row.try_get("last_seen_at")?;
        let created_at: String = row.try_get("created_at")?;
        let updated_at: String = row.try_get("updated_at")?;

        Ok(User {
            id: Uuid::parse_str(&id).map_err(|e| AppError::Internal(e.to_string()))?,
            username: row.try_get("username")?,
            avatar_path: row.try_get("avatar_path")?,
            is_local: row.try_get::<i32, _>("is_local")? == 1,
            last_seen_at: last_seen_at
                .map(|s| DateTime::parse_from_rfc3339(&s))
                .transpose()
                .map_err(|e| AppError::Internal(e.to_string()))?
                .map(|d| d.with_timezone(&Utc)),
            created_at: DateTime::parse_from_rfc3339(&created_at)
                .map_err(|e| AppError::Internal(e.to_string()))?
                .with_timezone(&Utc),
            updated_at: DateTime::parse_from_rfc3339(&updated_at)
                .map_err(|e| AppError::Internal(e.to_string()))?
                .with_timezone(&Utc),
        })
    }

    fn row_to_attachment(&self, row: &sqlx::sqlite::SqliteRow) -> AppResult<Attachment> {
        use chrono::DateTime;

        let id: String = row.try_get("id")?;
        let message_id: String = row.try_get("message_id")?;
        let created_at: String = row.try_get("created_at")?;

        Ok(Attachment {
            id: Uuid::parse_str(&id).map_err(|e| AppError::Internal(e.to_string()))?,
            message_id: Uuid::parse_str(&message_id)
                .map_err(|e| AppError::Internal(e.to_string()))?,
            original_filename: row.try_get("original_filename")?,
            stored_filename: row.try_get("stored_filename")?,
            mime_type: row.try_get("mime_type")?,
            size_bytes: row.try_get("size_bytes")?,
            checksum: row.try_get("checksum")?,
            is_image: row.try_get::<i32, _>("is_image")? == 1,
            width: row.try_get("width")?,
            height: row.try_get("height")?,
            created_at: DateTime::parse_from_rfc3339(&created_at)
                .map_err(|e| AppError::Internal(e.to_string()))?
                .with_timezone(&Utc),
        })
    }

    fn row_to_reaction(&self, row: &sqlx::sqlite::SqliteRow) -> AppResult<Reaction> {
        use chrono::DateTime;

        let id: String = row.try_get("id")?;
        let message_id: String = row.try_get("message_id")?;
        let user_id: String = row.try_get("user_id")?;
        let created_at: String = row.try_get("created_at")?;

        Ok(Reaction {
            id: Uuid::parse_str(&id).map_err(|e| AppError::Internal(e.to_string()))?,
            message_id: Uuid::parse_str(&message_id)
                .map_err(|e| AppError::Internal(e.to_string()))?,
            user_id: Uuid::parse_str(&user_id).map_err(|e| AppError::Internal(e.to_string()))?,
            username: row.try_get("username")?,
            emoji: row.try_get("emoji")?,
            created_at: DateTime::parse_from_rfc3339(&created_at)
                .map_err(|e| AppError::Internal(e.to_string()))?
                .with_timezone(&Utc),
        })
    }

    fn row_to_mention(&self, row: &sqlx::sqlite::SqliteRow) -> AppResult<Mention> {
        let id: String = row.try_get("id")?;
        let message_id: String = row.try_get("message_id")?;
        let user_id: String = row.try_get("user_id")?;

        Ok(Mention {
            id: Uuid::parse_str(&id).map_err(|e| AppError::Internal(e.to_string()))?,
            message_id: Uuid::parse_str(&message_id)
                .map_err(|e| AppError::Internal(e.to_string()))?,
            user_id: Uuid::parse_str(&user_id).map_err(|e| AppError::Internal(e.to_string()))?,
            username: row.try_get("username")?,
        })
    }

    fn row_to_read_receipt(&self, row: &sqlx::sqlite::SqliteRow) -> AppResult<ReadReceipt> {
        use chrono::DateTime;

        let id: String = row.try_get("id")?;
        let message_id: String = row.try_get("message_id")?;
        let user_id: String = row.try_get("user_id")?;
        let read_at: String = row.try_get("read_at")?;

        Ok(ReadReceipt {
            id: Uuid::parse_str(&id).map_err(|e| AppError::Internal(e.to_string()))?,
            message_id: Uuid::parse_str(&message_id)
                .map_err(|e| AppError::Internal(e.to_string()))?,
            user_id: Uuid::parse_str(&user_id).map_err(|e| AppError::Internal(e.to_string()))?,
            read_at: DateTime::parse_from_rfc3339(&read_at)
                .map_err(|e| AppError::Internal(e.to_string()))?
                .with_timezone(&Utc),
        })
    }
}

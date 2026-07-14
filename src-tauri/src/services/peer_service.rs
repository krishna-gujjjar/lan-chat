//! Peer service for managing peer operations.

use crate::database::Database;
use crate::errors::{AppError, AppResult};
use crate::models::Peer;
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;

/// Get a peer by ID.
pub async fn get_peer_by_id(database: Arc<Database>, id: Uuid) -> AppResult<Option<Peer>> {
    let row = sqlx::query(
        r#"
        SELECT p.id, p.user_id, u.username, p.address, p.port, p.is_connected,
               p.last_seen_at, p.created_at, p.updated_at
        FROM peers p
        JOIN users u ON p.user_id = u.id
        WHERE p.id = ?
        "#,
    )
    .bind(id.to_string())
    .fetch_optional(database.pool())
    .await?;

    match row {
        Some(row) => {
            let id: String = row.try_get("id")?;
            let user_id: String = row.try_get("user_id")?;
            let last_seen_at: Option<String> = row.try_get("last_seen_at")?;
            let created_at: String = row.try_get("created_at")?;
            let updated_at: String = row.try_get("updated_at")?;

            Ok(Some(Peer {
                id: Uuid::parse_str(&id).map_err(|e| AppError::Internal(e.to_string()))?,
                user_id: Uuid::parse_str(&user_id)
                    .map_err(|e| AppError::Internal(e.to_string()))?,
                username: row.try_get("username")?,
                address: row.try_get("address")?,
                port: row.try_get::<i32, _>("port")? as u16,
                is_connected: row.try_get::<i32, _>("is_connected")? == 1,
                last_seen_at: last_seen_at
                    .map(|s| chrono::DateTime::parse_from_rfc3339(&s))
                    .transpose()
                    .map_err(|e| AppError::Internal(e.to_string()))?
                    .map(|d| d.with_timezone(&chrono::Utc)),
                created_at: chrono::DateTime::parse_from_rfc3339(&created_at)
                    .map_err(|e| AppError::Internal(e.to_string()))?
                    .with_timezone(&chrono::Utc),
                updated_at: chrono::DateTime::parse_from_rfc3339(&updated_at)
                    .map_err(|e| AppError::Internal(e.to_string()))?
                    .with_timezone(&chrono::Utc),
            }))
        }
        None => Ok(None),
    }
}

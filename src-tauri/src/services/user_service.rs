//! User service for managing user operations.

use crate::database::Database;
use crate::errors::{AppError, AppResult};
use crate::models::{CreateUserInput, UpdateUserInput, User};
use chrono::Utc;
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;

/// Service for user-related operations.
pub struct UserService {
    database: Arc<Database>,
}

impl UserService {
    /// Create a new user service.
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    /// Get the local user if exists.
    pub async fn get_local_user(&self) -> AppResult<Option<User>> {
        let row = sqlx::query(
            r#"
            SELECT id, username, avatar_path, is_local, last_seen_at, created_at, updated_at
            FROM users
            WHERE is_local = 1
            LIMIT 1
            "#,
        )
        .fetch_optional(self.database.pool())
        .await?;

        match row {
            Some(row) => Ok(Some(self.row_to_user(&row)?)),
            None => Ok(None),
        }
    }

    /// Create a new local user.
    pub async fn create_local_user(&self, input: CreateUserInput) -> AppResult<User> {
        let user = User::new_local(input.username);

        sqlx::query(
            r#"
            INSERT INTO users (id, username, avatar_path, is_local, last_seen_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(user.id.to_string())
        .bind(&user.username)
        .bind(&user.avatar_path)
        .bind(user.is_local)
        .bind(user.last_seen_at.map(|d| d.to_rfc3339()))
        .bind(user.created_at.to_rfc3339())
        .bind(user.updated_at.to_rfc3339())
        .execute(self.database.pool())
        .await?;

        tracing::info!("Created local user: {}", user.username);
        Ok(user)
    }

    /// Update a user.
    pub async fn update_user(&self, id: Uuid, input: UpdateUserInput) -> AppResult<User> {
        let existing = self.get_user(id).await?
            .ok_or_else(|| AppError::UserNotFound(id.to_string()))?;

        let username = input.username.unwrap_or(existing.username);
        let avatar_path = input.avatar_path.or(existing.avatar_path);
        let updated_at = Utc::now();

        sqlx::query(
            r#"
            UPDATE users
            SET username = ?, avatar_path = ?, updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(&username)
        .bind(&avatar_path)
        .bind(updated_at.to_rfc3339())
        .bind(id.to_string())
        .execute(self.database.pool())
        .await?;

        self.get_user(id).await?.ok_or_else(|| AppError::UserNotFound(id.to_string()))
    }

    /// Get a user by ID.
    pub async fn get_user(&self, id: Uuid) -> AppResult<Option<User>> {
        let row = sqlx::query(
            r#"
            SELECT id, username, avatar_path, is_local, last_seen_at, created_at, updated_at
            FROM users
            WHERE id = ?
            "#,
        )
        .bind(id.to_string())
        .fetch_optional(self.database.pool())
        .await?;

        match row {
            Some(row) => Ok(Some(self.row_to_user(&row)?)),
            None => Ok(None),
        }
    }

    /// Get all users.
    pub async fn get_all_users(&self) -> AppResult<Vec<User>> {
        let rows = sqlx::query(
            r#"
            SELECT id, username, avatar_path, is_local, last_seen_at, created_at, updated_at
            FROM users
            ORDER BY username ASC
            "#,
        )
        .fetch_all(self.database.pool())
        .await?;

        rows.iter().map(|row| self.row_to_user(row)).collect()
    }

    /// Create or update a remote user.
    pub async fn upsert_remote_user(&self, id: Uuid, username: String) -> AppResult<User> {
        let now = Utc::now();

        sqlx::query(
            r#"
            INSERT INTO users (id, username, is_local, last_seen_at, created_at, updated_at)
            VALUES (?, ?, 0, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                username = excluded.username,
                last_seen_at = excluded.last_seen_at,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(id.to_string())
        .bind(&username)
        .bind(now.to_rfc3339())
        .bind(now.to_rfc3339())
        .bind(now.to_rfc3339())
        .execute(self.database.pool())
        .await?;

        self.get_user(id).await?.ok_or_else(|| AppError::UserNotFound(id.to_string()))
    }

    /// Convert a database row to a User.
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
}

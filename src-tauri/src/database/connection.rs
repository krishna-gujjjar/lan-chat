//! Database connection management.

use crate::errors::{AppError, AppResult};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{Pool, Sqlite};
use std::path::Path;
use std::str::FromStr;

/// Database connection pool wrapper.
pub struct Database {
    pool: Pool<Sqlite>,
}

impl Database {
    /// Create a new database connection.
    pub async fn new(path: &Path) -> AppResult<Self> {
        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let db_url = format!("sqlite:{}?mode=rwc", path.display());
        
        let options = SqliteConnectOptions::from_str(&db_url)
            .map_err(|e| AppError::Database(e.into()))?
            .create_if_missing(true)
            .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
            .synchronous(sqlx::sqlite::SqliteSynchronous::Normal)
            .busy_timeout(std::time::Duration::from_secs(30));

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .min_connections(1)
            .connect_with(options)
            .await?;

        let db = Self { pool };
        db.run_migrations().await?;

        tracing::info!("Database initialized at {:?}", path);

        Ok(db)
    }

    /// Run database migrations.
    async fn run_migrations(&self) -> AppResult<()> {
        sqlx::query(super::migrations::CREATE_TABLES)
            .execute(&self.pool)
            .await?;

        sqlx::query(super::migrations::CREATE_INDEXES)
            .execute(&self.pool)
            .await?;

        tracing::info!("Database migrations complete");
        Ok(())
    }

    /// Get a reference to the connection pool.
    pub fn pool(&self) -> &Pool<Sqlite> {
        &self.pool
    }

    /// Execute a query with no return value.
    pub async fn execute(&self, query: &str) -> AppResult<()> {
        sqlx::query(query).execute(&self.pool).await?;
        Ok(())
    }
}

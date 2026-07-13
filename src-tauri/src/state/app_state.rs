//! Global application state.

use crate::database::Database;
use crate::errors::AppResult;
use crate::models::{AppSettings, User};
use crate::services::{SettingsService, UserService};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::AppHandle;
use tokio::sync::RwLock;

/// Global application state shared across all commands.
pub struct AppState {
    /// Database connection pool
    pub database: Arc<Database>,
    /// Current local user
    pub current_user: RwLock<Option<User>>,
    /// Application settings
    pub settings: RwLock<AppSettings>,
    /// Application data directory
    pub app_data_dir: PathBuf,
    /// Services
    pub user_service: Arc<UserService>,
    pub settings_service: Arc<SettingsService>,
}

impl AppState {
    /// Create a new application state.
    pub async fn new(handle: &AppHandle) -> AppResult<Self> {
        // Get application data directory
        let app_data_dir = Self::ensure_app_directories(handle)?;

        // Initialize database
        let db_path = app_data_dir.join("database").join("chat.db");
        let database = Arc::new(Database::new(&db_path).await?);

        // Initialize services
        let user_service = Arc::new(UserService::new(database.clone()));
        let settings_service = Arc::new(SettingsService::new(database.clone()));

        // Load settings
        let settings = settings_service.load_settings().await?;

        // Try to load current user
        let current_user = user_service.get_local_user().await?;

        tracing::info!(
            "Application state initialized. Data dir: {:?}",
            app_data_dir
        );

        Ok(Self {
            database,
            current_user: RwLock::new(current_user),
            settings: RwLock::new(settings),
            app_data_dir,
            user_service,
            settings_service,
        })
    }

    /// Ensure all required application directories exist.
    fn ensure_app_directories(handle: &AppHandle) -> AppResult<PathBuf> {
        use std::fs;

        // Get documents directory and create app folder
        let documents_dir = dirs::document_dir()
            .ok_or_else(|| crate::errors::AppError::Config(
                "Could not find documents directory".to_string()
            ))?;

        let app_dir = documents_dir.join("LanChat");

        // Create directory structure
        let subdirs = [
            "database",
            "uploads/images",
            "uploads/files",
            "downloads",
            "avatars",
            "logs",
            "cache",
            "temp",
        ];

        for subdir in &subdirs {
            let path = app_dir.join(subdir);
            if !path.exists() {
                fs::create_dir_all(&path)?;
                tracing::debug!("Created directory: {:?}", path);
            }
        }

        // Store handle for later use
        let _ = handle;

        Ok(app_dir)
    }

    /// Get the uploads directory path.
    pub fn uploads_dir(&self) -> PathBuf {
        self.app_data_dir.join("uploads")
    }

    /// Get the downloads directory path.
    pub fn downloads_dir(&self) -> PathBuf {
        self.app_data_dir.join("downloads")
    }

    /// Get the avatars directory path.
    pub fn avatars_dir(&self) -> PathBuf {
        self.app_data_dir.join("avatars")
    }

    /// Get the temp directory path.
    pub fn temp_dir(&self) -> PathBuf {
        self.app_data_dir.join("temp")
    }
}

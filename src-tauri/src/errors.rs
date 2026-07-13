//! Application error types.
//!
//! Centralized error handling using thiserror.

use serde::Serialize;
use thiserror::Error;

/// Application-wide error type.
#[derive(Debug, Error)]
pub enum AppError {
    /// Database operation failed
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    /// File system operation failed
    #[error("File system error: {0}")]
    FileSystem(#[from] std::io::Error),

    /// Serialization/deserialization failed
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    /// Network operation failed
    #[error("Network error: {0}")]
    Network(String),

    /// User not found
    #[error("User not found: {0}")]
    UserNotFound(String),

    /// Message not found
    #[error("Message not found: {0}")]
    MessageNotFound(String),

    /// Attachment not found
    #[error("Attachment not found: {0}")]
    AttachmentNotFound(String),

    /// Invalid input provided
    #[error("Invalid input: {0}")]
    InvalidInput(String),

    /// Operation not permitted
    #[error("Not permitted: {0}")]
    NotPermitted(String),

    /// File too large
    #[error("File too large: {size} bytes (max: {max} bytes)")]
    FileTooLarge { size: u64, max: u64 },

    /// Checksum mismatch
    #[error("Checksum mismatch: expected {expected}, got {actual}")]
    ChecksumMismatch { expected: String, actual: String },

    /// Download not found
    #[error("Download not found: {0}")]
    DownloadNotFound(String),

    /// Peer not found
    #[error("Peer not found: {0}")]
    PeerNotFound(String),

    /// Configuration error
    #[error("Configuration error: {0}")]
    Config(String),

    /// Internal application error
    #[error("Internal error: {0}")]
    Internal(String),
}

/// Serializable error for IPC responses.
#[derive(Debug, Serialize)]
pub struct IpcError {
    pub code: String,
    pub message: String,
}

impl From<AppError> for IpcError {
    fn from(error: AppError) -> Self {
        let code = match &error {
            AppError::Database(_) => "DATABASE_ERROR",
            AppError::FileSystem(_) => "FILESYSTEM_ERROR",
            AppError::Serialization(_) => "SERIALIZATION_ERROR",
            AppError::Network(_) => "NETWORK_ERROR",
            AppError::UserNotFound(_) => "USER_NOT_FOUND",
            AppError::MessageNotFound(_) => "MESSAGE_NOT_FOUND",
            AppError::AttachmentNotFound(_) => "ATTACHMENT_NOT_FOUND",
            AppError::InvalidInput(_) => "INVALID_INPUT",
            AppError::NotPermitted(_) => "NOT_PERMITTED",
            AppError::FileTooLarge { .. } => "FILE_TOO_LARGE",
            AppError::ChecksumMismatch { .. } => "CHECKSUM_MISMATCH",
            AppError::DownloadNotFound(_) => "DOWNLOAD_NOT_FOUND",
            AppError::PeerNotFound(_) => "PEER_NOT_FOUND",
            AppError::Config(_) => "CONFIG_ERROR",
            AppError::Internal(_) => "INTERNAL_ERROR",
        };

        IpcError {
            code: code.to_string(),
            message: error.to_string(),
        }
    }
}

impl From<AppError> for String {
    fn from(error: AppError) -> Self {
        error.to_string()
    }
}

/// Result type alias for application operations.
pub type AppResult<T> = Result<T, AppError>;

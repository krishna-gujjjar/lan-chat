//! Attachment domain model.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Transfer status for downloads/uploads.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TransferStatus {
    Pending,
    InProgress,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

impl Default for TransferStatus {
    fn default() -> Self {
        Self::Pending
    }
}

/// Attachment metadata stored in database.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    pub id: Uuid,
    pub message_id: Uuid,
    pub original_filename: String,
    pub stored_filename: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub checksum: String,
    pub is_image: bool,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub created_at: DateTime<Utc>,
}

impl Attachment {
    /// Check if this is an image attachment.
    pub fn is_image_type(&self) -> bool {
        self.mime_type.starts_with("image/")
    }

    /// Check if this is a video attachment.
    pub fn is_video_type(&self) -> bool {
        self.mime_type.starts_with("video/")
    }
}

/// Download entity.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Download {
    pub id: Uuid,
    pub attachment_id: Uuid,
    pub status: TransferStatus,
    pub progress_bytes: i64,
    pub local_path: Option<String>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Download {
    /// Create a new pending download.
    pub fn new(attachment_id: Uuid) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            attachment_id,
            status: TransferStatus::Pending,
            progress_bytes: 0,
            local_path: None,
            started_at: None,
            completed_at: None,
            created_at: now,
            updated_at: now,
        }
    }
}

/// Download progress information.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub download_id: Uuid,
    pub attachment_id: Uuid,
    pub bytes_downloaded: i64,
    pub total_bytes: i64,
    pub percentage: f64,
    pub bytes_per_second: f64,
    pub estimated_time_remaining: Option<i64>,
}

/// Input for creating an attachment.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAttachmentInput {
    pub message_id: Uuid,
    pub file_path: String,
    pub original_filename: String,
}

/// Input for uploading files.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadFilesInput {
    pub file_paths: Vec<String>,
    pub message_id: Option<Uuid>,
}

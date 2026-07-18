//! Attachment-related commands.

use crate::models::{Attachment, Download, DownloadProgress, TransferStatus};
use crate::state::AppState;
use chrono::Utc;
use sha2::{Digest, Sha256};
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

/// Upload files and create attachments.
#[tauri::command]
pub async fn upload_files(
    state: State<'_, Arc<AppState>>,
    file_paths: Vec<String>,
    message_id: Option<String>,
) -> Result<Vec<Attachment>, String> {
    use std::fs;
    use std::io::Read;

    let msg_id = message_id
        .map(|s| Uuid::parse_str(&s))
        .transpose()
        .map_err(|e| e.to_string())?
        .unwrap_or_else(Uuid::new_v4);

    let mut attachments = Vec::new();

    for file_path in file_paths {
        let path = std::path::Path::new(&file_path);

        // Get original filename
        let original_filename = path
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or("Invalid filename")?
            .to_string();

        // Sanitize and create stored filename
        let extension = path.extension().and_then(|e| e.to_str()).unwrap_or("");

        let stored_filename = if extension.is_empty() {
            Uuid::new_v4().to_string()
        } else {
            format!("{}.{}", Uuid::new_v4(), extension)
        };

        // Determine destination directory
        let mime_type = mime_guess::from_path(path)
            .first_or_octet_stream()
            .to_string();

        let is_image = mime_type.starts_with("image/");

        let dest_dir = if is_image {
            state.uploads_dir().join("images")
        } else {
            state.uploads_dir().join("files")
        };

        let dest_path = dest_dir.join(&stored_filename);

        // Copy file
        fs::copy(&file_path, &dest_path).map_err(|e| e.to_string())?;

        // Calculate checksum
        let mut file = fs::File::open(&dest_path).map_err(|e| e.to_string())?;
        let mut hasher = Sha256::new();
        let mut buffer = vec![0u8; 8192];

        loop {
            let bytes_read = file.read(&mut buffer).map_err(|e| e.to_string())?;
            if bytes_read == 0 {
                break;
            }
            hasher.update(&buffer[..bytes_read]);
        }

        let checksum = hex::encode(hasher.finalize());

        // Get file metadata
        let metadata = fs::metadata(&dest_path).map_err(|e| e.to_string())?;
        let size_bytes = metadata.len() as i64;

        // Get image dimensions if applicable
        let (width, height) = if is_image {
            image::image_dimensions(&dest_path)
                .map(|(w, h)| (Some(w as i32), Some(h as i32)))
                .unwrap_or((None, None))
        } else {
            (None, None)
        };

        let attachment = Attachment {
            id: Uuid::new_v4(),
            message_id: msg_id,
            original_filename,
            stored_filename,
            mime_type,
            size_bytes,
            checksum,
            is_image,
            width,
            height,
            created_at: Utc::now(),
        };

        // Insert into database
        sqlx::query(
            r#"
            INSERT INTO attachments (id, message_id, original_filename, stored_filename,
                                     mime_type, size_bytes, checksum, is_image, width, height, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(attachment.id.to_string())
        .bind(attachment.message_id.to_string())
        .bind(&attachment.original_filename)
        .bind(&attachment.stored_filename)
        .bind(&attachment.mime_type)
        .bind(attachment.size_bytes)
        .bind(&attachment.checksum)
        .bind(attachment.is_image)
        .bind(attachment.width)
        .bind(attachment.height)
        .bind(attachment.created_at.to_rfc3339())
        .execute(state.database.pool())
        .await
        .map_err(|e| e.to_string())?;

        attachments.push(attachment);
    }

    Ok(attachments)
}

/// Start downloading an attachment.
#[tauri::command]
pub async fn start_download(
    state: State<'_, Arc<AppState>>,
    attachment_id: String,
) -> Result<Download, String> {
    let att_id = Uuid::parse_str(&attachment_id).map_err(|e| e.to_string())?;

    let now = Utc::now();
    let download = Download {
        id: Uuid::new_v4(),
        attachment_id: att_id,
        status: TransferStatus::InProgress,
        progress_bytes: 0,
        local_path: None,
        started_at: Some(now),
        completed_at: None,
        created_at: now,
        updated_at: now,
    };

    sqlx::query(
        r#"
        INSERT INTO downloads (id, attachment_id, status, progress_bytes, local_path,
                               started_at, completed_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(download.id.to_string())
    .bind(download.attachment_id.to_string())
    .bind("in_progress")
    .bind(download.progress_bytes)
    .bind(&download.local_path)
    .bind(download.started_at.map(|d| d.to_rfc3339()))
    .bind(download.completed_at.map(|d| d.to_rfc3339()))
    .bind(download.created_at.to_rfc3339())
    .bind(download.updated_at.to_rfc3339())
    .execute(state.database.pool())
    .await
    .map_err(|e| e.to_string())?;

    let requester_id = state
        .current_user
        .read()
        .await
        .as_ref()
        .ok_or("No current user")?
        .id;
    crate::network::peer_connection::request_attachment(
        state.inner().clone(),
        download.id,
        att_id,
        requester_id,
    )
    .await
    .map_err(|error| error.to_string())?;

    Ok(download)
}

/// Pause a download.
#[tauri::command]
pub async fn pause_download(
    state: State<'_, Arc<AppState>>,
    download_id: String,
) -> Result<Download, String> {
    let id = Uuid::parse_str(&download_id).map_err(|e| e.to_string())?;
    let now = Utc::now();

    sqlx::query("UPDATE downloads SET status = 'paused', updated_at = ? WHERE id = ?")
        .bind(now.to_rfc3339())
        .bind(id.to_string())
        .execute(state.database.pool())
        .await
        .map_err(|e| e.to_string())?;

    // Return updated download (simplified)
    Ok(Download {
        id,
        attachment_id: Uuid::new_v4(),
        status: TransferStatus::Paused,
        progress_bytes: 0,
        local_path: None,
        started_at: None,
        completed_at: None,
        created_at: now,
        updated_at: now,
    })
}

/// Cancel a download.
#[tauri::command]
pub async fn cancel_download(
    state: State<'_, Arc<AppState>>,
    download_id: String,
) -> Result<(), String> {
    let id = Uuid::parse_str(&download_id).map_err(|e| e.to_string())?;
    let now = Utc::now();

    sqlx::query("UPDATE downloads SET status = 'cancelled', updated_at = ? WHERE id = ?")
        .bind(now.to_rfc3339())
        .bind(id.to_string())
        .execute(state.database.pool())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Get download progress.
#[tauri::command]
pub async fn get_download_progress(
    state: State<'_, Arc<AppState>>,
    download_id: String,
) -> Result<DownloadProgress, String> {
    let id = Uuid::parse_str(&download_id).map_err(|e| e.to_string())?;

    let row = sqlx::query(
        "SELECT d.id, d.attachment_id, d.progress_bytes, a.size_bytes FROM downloads d JOIN attachments a ON d.attachment_id = a.id WHERE d.id = ?",
    )
    .bind(id.to_string())
    .fetch_one(state.database.pool())
    .await
    .map_err(|e| e.to_string())?;

    use sqlx::Row;
    let progress_bytes: i64 = row.try_get("progress_bytes").map_err(|e| e.to_string())?;
    let total_bytes: i64 = row.try_get("size_bytes").map_err(|e| e.to_string())?;
    let attachment_id: String = row.try_get("attachment_id").map_err(|e| e.to_string())?;

    let percentage = if total_bytes > 0 {
        (progress_bytes as f64 / total_bytes as f64) * 100.0
    } else {
        0.0
    };

    Ok(DownloadProgress {
        download_id: id,
        attachment_id: Uuid::parse_str(&attachment_id).map_err(|e| e.to_string())?,
        bytes_downloaded: progress_bytes,
        total_bytes,
        percentage,
        bytes_per_second: 0.0,
        estimated_time_remaining: None,
    })
}
/// Persist an image currently stored in the native clipboard as an attachment.
#[tauri::command]
pub async fn paste_clipboard_image(
    app: tauri::AppHandle,
    state: State<'_, Arc<AppState>>,
) -> Result<Attachment, String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    let clipboard_image = app
        .clipboard()
        .read_image()
        .map_err(|error| error.to_string())?;
    let width = clipboard_image.width();
    let height = clipboard_image.height();
    let rgba = clipboard_image.rgba().to_vec();
    let pixels = image::RgbaImage::from_raw(width, height, rgba)
        .ok_or("Clipboard returned invalid image pixels")?;
    let attachment_id = Uuid::new_v4();
    let stored_filename = format!("{attachment_id}.png");
    let destination = state.uploads_dir().join("images").join(&stored_filename);
    tokio::task::spawn_blocking({
        let destination = destination.clone();
        move || pixels.save(destination)
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| error.to_string())?;
    let bytes = tokio::fs::read(&destination)
        .await
        .map_err(|error| error.to_string())?;
    let attachment = Attachment {
        id: attachment_id,
        message_id: Uuid::new_v4(),
        original_filename: format!("clipboard-{attachment_id}.png"),
        stored_filename,
        mime_type: "image/png".into(),
        size_bytes: bytes.len() as i64,
        checksum: hex::encode(Sha256::digest(&bytes)),
        is_image: true,
        width: Some(width as i32),
        height: Some(height as i32),
        created_at: Utc::now(),
    };
    sqlx::query("INSERT INTO attachments (id, message_id, original_filename, stored_filename, mime_type, size_bytes, checksum, is_image, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)")
        .bind(attachment.id.to_string()).bind(attachment.message_id.to_string())
        .bind(&attachment.original_filename).bind(&attachment.stored_filename)
        .bind(&attachment.mime_type).bind(attachment.size_bytes).bind(&attachment.checksum)
        .bind(attachment.width).bind(attachment.height).bind(attachment.created_at.to_rfc3339())
        .execute(state.database.pool()).await.map_err(|error| error.to_string())?;
    Ok(attachment)
}

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

    let supplied_message_id = message_id.is_some();
    let msg_id = message_id
        .map(|s| Uuid::parse_str(&s))
        .transpose()
        .map_err(|e| e.to_string())?
        .unwrap_or_else(Uuid::new_v4);

    // Attachments are selected before the final chat message exists. Because
    // attachments.message_id is a foreign key, create a private draft parent
    // rather than referencing a random/nonexistent UUID.
    if !supplied_message_id {
        let sender_id = state
            .current_user
            .read()
            .await
            .as_ref()
            .ok_or("No current user")?
            .id;
        let now = Utc::now().to_rfc3339();
        sqlx::query("INSERT INTO messages (id, sender_id, content, is_edited, is_deleted, status, created_at, updated_at) VALUES (?, ?, '__attachment_draft__', 0, 1, 'sending', ?, ?)")
            .bind(msg_id.to_string()).bind(sender_id.to_string())
            .bind(&now).bind(&now).execute(state.database.pool()).await
            .map_err(|error| error.to_string())?;
    }

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

        tracing::info!(attachment_id = %attachment.id, filename = %attachment.original_filename, bytes = attachment.size_bytes, "attachment staged");
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
    let draft_message_id = Uuid::new_v4();
    let sender_id = state
        .current_user
        .read()
        .await
        .as_ref()
        .ok_or("No current user")?
        .id;
    let now = Utc::now().to_rfc3339();
    sqlx::query("INSERT INTO messages (id, sender_id, content, is_edited, is_deleted, status, created_at, updated_at) VALUES (?, ?, '__attachment_draft__', 0, 1, 'sending', ?, ?)")
        .bind(draft_message_id.to_string()).bind(sender_id.to_string())
        .bind(&now).bind(&now).execute(state.database.pool()).await
        .map_err(|error| error.to_string())?;
    let attachment = Attachment {
        id: attachment_id,
        message_id: draft_message_id,
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

/// Return a local image as a data URL only when its bytes exist on this device.
#[tauri::command]
pub async fn get_attachment_preview(
    state: State<'_, Arc<AppState>>,
    attachment_id: String,
) -> Result<Option<String>, String> {
    use base64::Engine;
    use sqlx::Row;
    let id = Uuid::parse_str(&attachment_id).map_err(|error| error.to_string())?;
    let row =
        sqlx::query("SELECT stored_filename, mime_type, is_image FROM attachments WHERE id = ?")
            .bind(id.to_string())
            .fetch_optional(state.database.pool())
            .await
            .map_err(|error| error.to_string())?;
    let Some(row) = row else {
        return Ok(None);
    };
    if row
        .try_get::<i32, _>("is_image")
        .map_err(|e| e.to_string())?
        != 1
    {
        return Ok(None);
    }
    let stored: String = row.try_get("stored_filename").map_err(|e| e.to_string())?;
    let mime: String = row.try_get("mime_type").map_err(|e| e.to_string())?;
    let upload = state.uploads_dir().join("images").join(stored);
    let downloaded: Option<String> = sqlx::query_scalar(
        "SELECT local_path FROM downloads WHERE attachment_id = ? AND status = 'completed' ORDER BY completed_at DESC LIMIT 1",
    ).bind(id.to_string()).fetch_optional(state.database.pool()).await
        .map_err(|error| error.to_string())?.flatten();
    let path = if upload.is_file() {
        upload
    } else if let Some(path) = downloaded {
        path.into()
    } else {
        return Ok(None);
    };
    let metadata = tokio::fs::metadata(&path)
        .await
        .map_err(|e| e.to_string())?;
    if metadata.len() > 25 * 1024 * 1024 {
        return Err("Image is too large for inline preview".into());
    }
    let bytes = tokio::fs::read(path).await.map_err(|e| e.to_string())?;
    Ok(Some(format!(
        "data:{mime};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    )))
}

/// Import an image URL dropped from a browser. The response is bounded and
/// validated before it is persisted as an attachment draft.
#[tauri::command]
pub async fn import_image_url(
    state: State<'_, Arc<AppState>>,
    url: String,
) -> Result<Attachment, String> {
    use futures_util::StreamExt;
    use image::GenericImageView;
    const MAX_IMAGE_BYTES: usize = 25 * 1024 * 1024;
    let parsed = reqwest::Url::parse(&url).map_err(|_| "Invalid image URL")?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("Only HTTP and HTTPS image URLs are allowed".into());
    }
    let response = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|e| e.to_string())?
        .get(parsed)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?;
    if response
        .content_length()
        .is_some_and(|size| size > MAX_IMAGE_BYTES as u64)
    {
        return Err("Dropped image exceeds the 25 MiB limit".into());
    }
    let mime = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(';').next())
        .unwrap_or("application/octet-stream")
        .to_string();
    if !mime.starts_with("image/") {
        return Err("Dropped URL is not an image".into());
    }
    let mut bytes = Vec::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        if bytes.len() + chunk.len() > MAX_IMAGE_BYTES {
            return Err("Dropped image exceeds the 25 MiB limit".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    let format = image::guess_format(&bytes).map_err(|_| "Unsupported or invalid image data")?;
    let extension = match format {
        image::ImageFormat::Png => "png",
        image::ImageFormat::Jpeg => "jpg",
        image::ImageFormat::Gif => "gif",
        image::ImageFormat::WebP => "webp",
        _ => return Err("Unsupported image format".into()),
    };
    let (width, height) = image::load_from_memory(&bytes)
        .map_err(|e| e.to_string())?
        .dimensions();
    let attachment_id = Uuid::new_v4();
    let stored_filename = format!("{attachment_id}.{extension}");
    tokio::fs::write(
        state.uploads_dir().join("images").join(&stored_filename),
        &bytes,
    )
    .await
    .map_err(|e| e.to_string())?;
    let draft_id = create_attachment_draft(&state).await?;
    let attachment = Attachment {
        id: attachment_id,
        message_id: draft_id,
        original_filename: format!("dropped-image-{attachment_id}.{extension}"),
        stored_filename,
        mime_type: mime,
        size_bytes: bytes.len() as i64,
        checksum: hex::encode(Sha256::digest(&bytes)),
        is_image: true,
        width: Some(width as i32),
        height: Some(height as i32),
        created_at: Utc::now(),
    };
    insert_attachment(state.database.pool(), &attachment).await?;
    tracing::info!(attachment_id = %attachment.id, source = %url, "browser image imported");
    Ok(attachment)
}

async fn create_attachment_draft(state: &State<'_, Arc<AppState>>) -> Result<Uuid, String> {
    let id = Uuid::new_v4();
    let sender = state
        .current_user
        .read()
        .await
        .as_ref()
        .ok_or("No current user")?
        .id;
    let now = Utc::now().to_rfc3339();
    sqlx::query("INSERT INTO messages (id, sender_id, content, is_edited, is_deleted, status, created_at, updated_at) VALUES (?, ?, '__attachment_draft__', 0, 1, 'sending', ?, ?)")
        .bind(id.to_string()).bind(sender.to_string()).bind(&now).bind(&now)
        .execute(state.database.pool()).await.map_err(|e| e.to_string())?;
    Ok(id)
}

async fn insert_attachment(pool: &sqlx::SqlitePool, attachment: &Attachment) -> Result<(), String> {
    sqlx::query("INSERT INTO attachments (id, message_id, original_filename, stored_filename, mime_type, size_bytes, checksum, is_image, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(attachment.id.to_string()).bind(attachment.message_id.to_string())
        .bind(&attachment.original_filename).bind(&attachment.stored_filename).bind(&attachment.mime_type)
        .bind(attachment.size_bytes).bind(&attachment.checksum).bind(attachment.is_image)
        .bind(attachment.width).bind(attachment.height).bind(attachment.created_at.to_rfc3339())
        .execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

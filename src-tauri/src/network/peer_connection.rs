//! TCP peer connections for messaging.

use crate::models::{MessageWithDetails, TypingIndicator};
use crate::state::AppState;
use base64::Engine;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::Row;
use std::sync::Arc;
use tauri::Emitter;
use tokio::io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::time::{timeout, Duration};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NetworkMessageType {
    ChatMessage,
    MessageEdit,
    MessageDelete,
    Reaction,
    TypingIndicator,
    Presence,
    FileMetadata,
    FileRequest,
    FileChunk,
    FileComplete,
    UserInfo,
    SyncRequest,
    SyncResponse,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct NetworkPacket {
    #[serde(rename = "type")]
    packet_type: NetworkMessageType,
    sender_id: String,
    payload: serde_json::Value,
    timestamp: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FileRequestPayload {
    attachment_id: Uuid,
    download_id: Uuid,
    requester_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FileChunkPayload {
    attachment_id: Uuid,
    checksum: String,
    chunk_index: u64,
    data: String,
    download_id: Uuid,
    receiver_id: Uuid,
    total_bytes: i64,
    total_chunks: u64,
}

const CONNECT_TIMEOUT: Duration = Duration::from_secs(3);
const WRITE_TIMEOUT: Duration = Duration::from_secs(5);
const PREFERRED_TCP_PORT: u16 = 42_422;
const MAX_PACKET_BYTES: usize = 8 * 1024 * 1024;

/// Start TCP listener for incoming peer connections.
pub async fn start_tcp_listener(
    state: Arc<AppState>,
) -> Result<u16, Box<dyn std::error::Error + Send + Sync>> {
    // Prefer a stable, firewall-friendly port. Fall back to an ephemeral port so
    // multiple local profiles can still run; discovery advertises the actual port.
    let listener = match TcpListener::bind(("0.0.0.0", PREFERRED_TCP_PORT)).await {
        Ok(listener) => listener,
        Err(error) if error.kind() == std::io::ErrorKind::AddrInUse => {
            tracing::warn!(
                port = PREFERRED_TCP_PORT,
                "preferred TCP port is busy; using an ephemeral port"
            );
            TcpListener::bind(("0.0.0.0", 0)).await?
        }
        Err(error) => return Err(error.into()),
    };
    let port = listener.local_addr()?.port();

    // Store port in state
    *state.local_tcp_port.write().await = Some(port);
    tracing::info!("TCP listener started on port {}", port);

    tokio::spawn(async move {
        loop {
            match listener.accept().await {
                Ok((stream, addr)) => {
                    tracing::info!("Incoming peer connection from {}", addr);
                    let state_clone = state.clone();
                    tokio::spawn(async move {
                        if let Err(e) = handle_peer_stream(state_clone, stream).await {
                            tracing::error!("Peer stream error: {}", e);
                        }
                    });
                }
                Err(e) => {
                    tracing::error!("TCP accept error: {}", e);
                }
            }
        }
    });

    Ok(port)
}

async fn handle_peer_stream(
    state: Arc<AppState>,
    stream: TcpStream,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let (mut reader, writer) = stream.into_split();
    let writer = Arc::new(tokio::sync::Mutex::new(writer));
    let mut registered_user = None;
    let mut buf = vec![0u8; 4096];
    let mut accumulated = Vec::new();

    loop {
        match reader.read(&mut buf).await {
            Ok(0) => {
                tracing::info!("Peer disconnected");
                break;
            }
            Ok(n) => {
                accumulated.extend_from_slice(&buf[..n]);

                // Parse length-prefixed messages
                while accumulated.len() >= 4 {
                    let len = u32::from_be_bytes([
                        accumulated[0],
                        accumulated[1],
                        accumulated[2],
                        accumulated[3],
                    ]) as usize;

                    if len == 0 || len > MAX_PACKET_BYTES {
                        return Err(format!("invalid network packet length: {len}").into());
                    }
                    if accumulated.len() < 4 + len {
                        break;
                    }

                    let json_bytes = accumulated[4..4 + len].to_vec();
                    accumulated.drain(..4 + len);

                    match serde_json::from_slice::<NetworkPacket>(&json_bytes) {
                        Ok(packet) => {
                            if registered_user.is_none() {
                                if let Ok(user_id) = Uuid::parse_str(&packet.sender_id) {
                                    state
                                        .peer_writers
                                        .write()
                                        .await
                                        .insert(user_id, writer.clone());
                                    registered_user = Some(user_id);
                                    let _ = sqlx::query("UPDATE peers SET is_connected = 1, last_seen_at = ?, updated_at = ? WHERE user_id = ?")
                                        .bind(chrono::Utc::now().to_rfc3339())
                                        .bind(chrono::Utc::now().to_rfc3339())
                                        .bind(user_id.to_string())
                                        .execute(state.database.pool())
                                        .await;
                                    tracing::info!(%user_id, "registered bidirectional peer stream");
                                }
                            }
                            if let Err(error) = handle_network_packet(&state, packet).await {
                                tracing::error!(%error, "failed to persist network packet");
                            }
                        }
                        Err(error) => {
                            tracing::warn!(%error, "rejected malformed network packet");
                        }
                    }
                }
            }
            Err(e) => {
                tracing::error!("Read error: {}", e);
                break;
            }
        }
    }

    if let Some(user_id) = registered_user {
        // A reconnect can replace this writer before the old reader notices its
        // socket has closed. Only remove/mark offline when this task still owns
        // the currently registered generation.
        let removed_current = {
            let mut writers = state.peer_writers.write().await;
            let is_current = writers
                .get(&user_id)
                .map(|current| Arc::ptr_eq(current, &writer))
                .unwrap_or(false);
            if is_current {
                writers.remove(&user_id);
            }
            is_current
        };
        if removed_current {
            let _ =
                sqlx::query("UPDATE peers SET is_connected = 0, updated_at = ? WHERE user_id = ?")
                    .bind(chrono::Utc::now().to_rfc3339())
                    .bind(user_id.to_string())
                    .execute(state.database.pool())
                    .await;
            tracing::info!(%user_id, "active peer stream disconnected");
        } else {
            tracing::debug!(%user_id, "superseded peer stream closed; active reconnect retained");
        }
    }
    Ok(())
}

async fn handle_network_packet(
    state: &Arc<AppState>,
    packet: NetworkPacket,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    match packet.packet_type {
        NetworkMessageType::ChatMessage => {
            match serde_json::from_value::<MessageWithDetails>(packet.payload) {
                Ok(msg) => {
                    // A remote message must retain its original UUID and timestamps. Creating a
                    // new local Message here used to make replies, deduplication and attachments
                    // point at an ID that did not exist on the receiver.
                    state
                        .user_service
                        .upsert_remote_user(msg.sender.id, msg.sender.username.clone())
                        .await?;
                    let result = sqlx::query(
                    "INSERT OR IGNORE INTO messages (id, sender_id, content, reply_to_id, is_edited, is_deleted, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                )
                .bind(msg.message.id.to_string())
                .bind(msg.message.sender_id.to_string())
                .bind(&msg.message.content)
                .bind(msg.message.reply_to_id.map(|id| id.to_string()))
                .bind(msg.message.is_edited)
                .bind(msg.message.is_deleted)
                .bind(format!("{:?}", msg.message.status).to_lowercase())
                .bind(msg.message.created_at.to_rfc3339())
                .bind(msg.message.updated_at.to_rfc3339())
                .execute(state.database.pool())
                .await?;

                    if result.rows_affected() == 1 {
                        for attachment in &msg.attachments {
                            sqlx::query("INSERT OR IGNORE INTO attachments (id, message_id, original_filename, stored_filename, mime_type, size_bytes, checksum, is_image, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                            .bind(attachment.id.to_string()).bind(msg.message.id.to_string())
                            .bind(&attachment.original_filename).bind(&attachment.stored_filename)
                            .bind(&attachment.mime_type).bind(attachment.size_bytes)
                            .bind(&attachment.checksum).bind(attachment.is_image)
                            .bind(attachment.width).bind(attachment.height)
                            .bind(attachment.created_at.to_rfc3339())
                            .execute(state.database.pool()).await?;
                        }
                    }

                    // Emit only once. UDP discovery and reconnects may legitimately cause
                    // the same packet to be delivered more than once.
                    if result.rows_affected() == 1 {
                        if let Some(app_handle) = state.app_handle.read().await.as_ref() {
                            let _ = app_handle.emit("message:created", msg);
                        }
                    }
                }
                Err(error) => {
                    tracing::warn!(%error, "rejected invalid chat message payload");
                }
            }
        }
        NetworkMessageType::UserInfo => {
            if let Ok(user) = serde_json::from_value::<crate::models::User>(packet.payload) {
                let _ = state
                    .user_service
                    .upsert_remote_user(user.id, user.username)
                    .await;
            }
        }
        NetworkMessageType::TypingIndicator => {
            if let Ok(indicator) = serde_json::from_value::<TypingIndicator>(packet.payload) {
                if let Some(app_handle) = state.app_handle.read().await.as_ref() {
                    if indicator.is_typing {
                        let _ = app_handle.emit("typing:started", indicator);
                    } else {
                        let _ = app_handle.emit("typing:stopped", indicator);
                    }
                }
            }
        }
        NetworkMessageType::MessageEdit => {
            let message = serde_json::from_value::<MessageWithDetails>(packet.payload)?;
            sqlx::query("UPDATE messages SET content = ?, is_edited = 1, updated_at = ? WHERE id = ? AND sender_id = ?")
                .bind(&message.message.content)
                .bind(message.message.updated_at.to_rfc3339())
                .bind(message.message.id.to_string())
                .bind(packet.sender_id)
                .execute(state.database.pool()).await?;
            if let Some(app_handle) = state.app_handle.read().await.as_ref() {
                let _ = app_handle.emit("message:updated", message);
            }
        }
        NetworkMessageType::MessageDelete => {
            let message_id = packet
                .payload
                .get("messageId")
                .and_then(|value| value.as_str())
                .ok_or("delete packet missing messageId")?;
            sqlx::query("UPDATE messages SET content = NULL, is_deleted = 1, updated_at = ? WHERE id = ? AND sender_id = ?")
                .bind(chrono::Utc::now().to_rfc3339()).bind(message_id).bind(packet.sender_id)
                .execute(state.database.pool()).await?;
            if let Some(app_handle) = state.app_handle.read().await.as_ref() {
                let _ = app_handle.emit(
                    "message:deleted",
                    serde_json::json!({"messageId": message_id}),
                );
            }
        }
        NetworkMessageType::FileRequest => {
            let request = serde_json::from_value::<FileRequestPayload>(packet.payload)?;
            let transfer_state = state.clone();
            tokio::spawn(async move {
                if let Err(error) = send_attachment_chunks(transfer_state, request).await {
                    tracing::error!(%error, "attachment upload failed");
                }
            });
        }
        NetworkMessageType::FileChunk => {
            let chunk = serde_json::from_value::<FileChunkPayload>(packet.payload)?;
            receive_attachment_chunk(state, chunk).await?;
        }
        NetworkMessageType::Reaction => {
            let reaction = serde_json::from_value::<crate::models::Reaction>(packet.payload)?;
            sqlx::query("INSERT OR IGNORE INTO reactions (id, message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?, ?)")
                .bind(reaction.id.to_string()).bind(reaction.message_id.to_string())
                .bind(reaction.user_id.to_string()).bind(&reaction.emoji)
                .bind(reaction.created_at.to_rfc3339()).execute(state.database.pool()).await?;
            if let Some(app_handle) = state.app_handle.read().await.as_ref() {
                let _ = app_handle.emit("reaction:added", reaction);
            }
        }
        _ => {}
    }

    Ok(())
}

/// Connect to a discovered peer.
pub async fn connect_to_peer(
    state: Arc<AppState>,
    peer_id: Uuid,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let row = match sqlx::query("SELECT id, address, port FROM peers WHERE id = ?")
        .bind(peer_id.to_string())
        .fetch_one(state.database.pool())
        .await
    {
        Ok(row) => row,
        Err(_) => return Ok(()),
    };

    let id: String = row.try_get("id")?;
    let address: String = row.try_get("address")?;
    let port: i32 = row.try_get("port")?;

    let addr = format!("{}:{}", address, port);
    match timeout(CONNECT_TIMEOUT, TcpStream::connect(&addr)).await {
        Ok(Ok(mut stream)) => {
            tracing::info!("Connected to peer at {}", addr);

            // Update peer status
            sqlx::query(
                "UPDATE peers SET is_connected = 1, last_seen_at = ?, updated_at = ? WHERE id = ?",
            )
            .bind(chrono::Utc::now().to_rfc3339())
            .bind(chrono::Utc::now().to_rfc3339())
            .bind(&id)
            .execute(state.database.pool())
            .await?;

            // Send user info
            if let Some(user) = state.current_user.read().await.as_ref() {
                let packet = NetworkPacket {
                    packet_type: NetworkMessageType::UserInfo,
                    sender_id: user.id.to_string(),
                    payload: serde_json::to_value(user.clone())?,
                    timestamp: chrono::Utc::now().to_rfc3339(),
                };
                let _ = send_packet_to_stream(&mut stream, &packet).await;
            }

            if let Some(app_handle) = state.app_handle.read().await.as_ref() {
                if let Ok(Some(peer)) =
                    crate::services::get_peer_by_id(state.database.clone(), peer_id).await
                {
                    let _ = app_handle.emit("peer:connected", peer);
                }
            }

            // Keep this socket alive. The receiver registers its write half by
            // sender UUID and can reply over the same connection even when its
            // OS cannot establish a reverse TCP route (common with Wi-Fi firewalls).
            handle_peer_stream(state, stream).await
        }
        Ok(Err(e)) => {
            mark_peer_disconnected(&state, &id).await;
            tracing::warn!("Failed to connect to peer {}: {}", addr, e);
            Ok(())
        }
        Err(_) => {
            mark_peer_disconnected(&state, &id).await;
            tracing::warn!("Connection timeout to peer {}", addr);
            Ok(())
        }
    }
}

async fn mark_peer_disconnected(state: &Arc<AppState>, peer_id: &str) {
    let _ = sqlx::query("UPDATE peers SET is_connected = 0, updated_at = ? WHERE id = ?")
        .bind(chrono::Utc::now().to_rfc3339())
        .bind(peer_id)
        .execute(state.database.pool())
        .await;
}

async fn send_packet_to_stream(
    stream: &mut TcpStream,
    packet: &NetworkPacket,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let json = serde_json::to_vec(packet)?;
    let len = (json.len() as u32).to_be_bytes();
    let mut data = Vec::new();
    data.extend_from_slice(&len);
    data.extend_from_slice(&json);

    timeout(WRITE_TIMEOUT, async {
        stream.write_all(&data).await?;
        stream.flush().await?;
        Ok::<(), std::io::Error>(())
    })
    .await
    .map_err(|_| std::io::Error::new(std::io::ErrorKind::TimedOut, "write timeout"))??;

    Ok(())
}

/// Broadcast a message to all connected peers.
pub async fn broadcast_message(
    state: Arc<AppState>,
    message: &MessageWithDetails,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let packet = NetworkPacket {
        packet_type: NetworkMessageType::ChatMessage,
        sender_id: message.message.sender_id.to_string(),
        payload: serde_json::to_value(message)?,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };

    let json = serde_json::to_vec(&packet)?;
    let len = (json.len() as u32).to_be_bytes();
    let mut data = Vec::new();
    data.extend_from_slice(&len);
    data.extend_from_slice(&json);

    // Get all peers and try to send
    let rows = sqlx::query("SELECT user_id, address, port FROM peers")
        .fetch_all(state.database.pool())
        .await?;

    for row in rows {
        let user_id = Uuid::parse_str(&row.try_get::<String, _>("user_id")?)?;
        let address: String = row.try_get("address")?;
        let port: i32 = row.try_get("port")?;
        let addr = format!("{}:{}", address, port);

        let persistent_writer = state.peer_writers.read().await.get(&user_id).cloned();
        if let Some(writer) = persistent_writer {
            let result = timeout(WRITE_TIMEOUT, async {
                let mut stream = writer.lock().await;
                stream.write_all(&data).await?;
                stream.flush().await
            })
            .await;
            if matches!(result, Ok(Ok(()))) {
                tracing::info!(peer = %addr, message_id = %message.message.id, "message delivered over persistent peer stream");
                continue;
            }
            remove_writer_if_current(&state, user_id, &writer).await;
            tracing::warn!(peer = %addr, "persistent stream failed; trying direct connection");
        }

        match timeout(CONNECT_TIMEOUT, TcpStream::connect(&addr)).await {
            Ok(Ok(mut stream)) => {
                match timeout(WRITE_TIMEOUT, async {
                    stream.write_all(&data).await?;
                    stream.flush().await
                })
                .await
                {
                    Ok(Ok(())) => {
                        tracing::info!(peer = %addr, message_id = %message.message.id, "message delivered to peer socket")
                    }
                    Ok(Err(error)) => {
                        tracing::warn!(peer = %addr, %error, "failed writing message")
                    }
                    Err(_) => tracing::warn!(peer = %addr, "message write timed out"),
                }
            }
            Ok(Err(error)) => {
                tracing::warn!(peer = %addr, %error, "cannot deliver message: connection refused or unavailable")
            }
            Err(_) => tracing::warn!(peer = %addr, "cannot deliver message: connection timed out"),
        }
    }

    Ok(())
}

/// Broadcast typing indicator.
pub async fn broadcast_typing(
    state: Arc<AppState>,
    indicator: &TypingIndicator,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let packet = NetworkPacket {
        packet_type: NetworkMessageType::TypingIndicator,
        sender_id: indicator.user_id.to_string(),
        payload: serde_json::to_value(indicator)?,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };

    let json = serde_json::to_vec(&packet)?;
    let len = (json.len() as u32).to_be_bytes();
    let mut data = Vec::new();
    data.extend_from_slice(&len);
    data.extend_from_slice(&json);

    let rows = sqlx::query("SELECT user_id, address, port FROM peers")
        .fetch_all(state.database.pool())
        .await?;

    for row in rows {
        let address: String = row.try_get("address")?;
        let port: i32 = row.try_get("port")?;
        let addr = format!("{}:{}", address, port);

        if let Ok(Ok(mut stream)) = timeout(CONNECT_TIMEOUT, TcpStream::connect(&addr)).await {
            let _ = timeout(WRITE_TIMEOUT, async {
                let _ = stream.write_all(&data).await;
                let _ = stream.flush().await;
            })
            .await;
        }
    }

    Ok(())
}
/// Broadcast an edited message to every peer.
pub async fn broadcast_message_edit(
    state: Arc<AppState>,
    message: &MessageWithDetails,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    broadcast_control_packet(
        state,
        NetworkMessageType::MessageEdit,
        message.message.sender_id,
        serde_json::to_value(message)?,
    )
    .await
}

/// Broadcast a message tombstone.
pub async fn broadcast_message_delete(
    state: Arc<AppState>,
    message_id: Uuid,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let sender_id = state
        .current_user
        .read()
        .await
        .as_ref()
        .map(|user| user.id)
        .ok_or("No current user")?;
    broadcast_control_packet(
        state,
        NetworkMessageType::MessageDelete,
        sender_id,
        serde_json::json!({ "messageId": message_id }),
    )
    .await
}

/// Broadcast a reaction using its stable UUID for idempotency.
pub async fn broadcast_reaction(
    state: Arc<AppState>,
    reaction: &crate::models::Reaction,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    broadcast_control_packet(
        state,
        NetworkMessageType::Reaction,
        reaction.user_id,
        serde_json::to_value(reaction)?,
    )
    .await
}

async fn broadcast_control_packet(
    state: Arc<AppState>,
    packet_type: NetworkMessageType,
    sender_id: Uuid,
    payload: serde_json::Value,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let packet = NetworkPacket {
        packet_type,
        sender_id: sender_id.to_string(),
        payload,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };
    let json = serde_json::to_vec(&packet)?;
    if json.len() > MAX_PACKET_BYTES {
        return Err("network packet too large".into());
    }
    let mut data = Vec::with_capacity(json.len() + 4);
    data.extend_from_slice(&(json.len() as u32).to_be_bytes());
    data.extend_from_slice(&json);
    let rows = sqlx::query("SELECT user_id, address, port FROM peers")
        .fetch_all(state.database.pool())
        .await?;
    for row in rows {
        let user_id = Uuid::parse_str(&row.try_get::<String, _>("user_id")?)?;
        let address: String = row.try_get("address")?;
        let port: i32 = row.try_get("port")?;
        let writer = state.peer_writers.read().await.get(&user_id).cloned();
        if let Some(writer) = writer {
            let result = timeout(WRITE_TIMEOUT, async {
                let mut stream = writer.lock().await;
                stream.write_all(&data).await?;
                stream.flush().await
            })
            .await;
            if matches!(result, Ok(Ok(()))) {
                continue;
            }
            remove_writer_if_current(&state, user_id, &writer).await;
        }
        let target = format!("{address}:{port}");
        if let Ok(Ok(mut stream)) = timeout(CONNECT_TIMEOUT, TcpStream::connect(&target)).await {
            send_raw(&mut stream, &data).await?;
        }
    }
    Ok(())
}

async fn send_raw(
    stream: &mut TcpStream,
    data: &[u8],
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    timeout(WRITE_TIMEOUT, async {
        stream.write_all(data).await?;
        stream.flush().await
    })
    .await
    .map_err(|_| "network write timed out")??;
    Ok(())
}

async fn remove_writer_if_current(
    state: &Arc<AppState>,
    user_id: Uuid,
    writer: &Arc<tokio::sync::Mutex<tokio::net::tcp::OwnedWriteHalf>>,
) {
    let mut writers = state.peer_writers.write().await;
    let is_current = writers
        .get(&user_id)
        .map(|current| Arc::ptr_eq(current, writer))
        .unwrap_or(false);
    if is_current {
        writers.remove(&user_id);
    }
}

const FILE_CHUNK_BYTES: usize = 192 * 1024;

pub async fn request_attachment(
    state: Arc<AppState>,
    download_id: Uuid,
    attachment_id: Uuid,
    requester_id: Uuid,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let payload = FileRequestPayload {
        attachment_id,
        download_id,
        requester_id,
    };
    tracing::info!(%attachment_id, %download_id, %requester_id, "requesting attachment from peers");
    broadcast_control_packet(
        state,
        NetworkMessageType::FileRequest,
        requester_id,
        serde_json::to_value(payload)?,
    )
    .await
}

async fn send_attachment_chunks(
    state: Arc<AppState>,
    request: FileRequestPayload,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let row = sqlx::query(
        "SELECT stored_filename, is_image, size_bytes, checksum FROM attachments WHERE id = ?",
    )
    .bind(request.attachment_id.to_string())
    .fetch_optional(state.database.pool())
    .await?;
    let Some(row) = row else {
        return Ok(());
    };
    let stored_filename: String = row.try_get("stored_filename")?;
    let is_image = row.try_get::<i32, _>("is_image")? == 1;
    let size_bytes: i64 = row.try_get("size_bytes")?;
    let checksum: String = row.try_get("checksum")?;
    let folder = if is_image { "images" } else { "files" };
    let path = state.uploads_dir().join(folder).join(stored_filename);
    if !path.is_file() {
        return Ok(());
    }

    tracing::info!(attachment_id = %request.attachment_id, receiver_id = %request.requester_id, bytes = size_bytes, "starting attachment upload");
    let mut file = tokio::fs::File::open(path).await?;
    let total_chunks =
        ((size_bytes.max(0) as usize + FILE_CHUNK_BYTES - 1) / FILE_CHUNK_BYTES) as u64;
    let sender_id = state
        .current_user
        .read()
        .await
        .as_ref()
        .ok_or("No current user")?
        .id;
    let mut buffer = vec![0_u8; FILE_CHUNK_BYTES];
    for chunk_index in 0..total_chunks {
        let count = file.read(&mut buffer).await?;
        if count == 0 {
            break;
        }
        let payload = FileChunkPayload {
            attachment_id: request.attachment_id,
            checksum: checksum.clone(),
            chunk_index,
            data: base64::engine::general_purpose::STANDARD.encode(&buffer[..count]),
            download_id: request.download_id,
            receiver_id: request.requester_id,
            total_bytes: size_bytes,
            total_chunks,
        };
        broadcast_control_packet(
            state.clone(),
            NetworkMessageType::FileChunk,
            sender_id,
            serde_json::to_value(payload)?,
        )
        .await?;
    }
    Ok(())
}

async fn receive_attachment_chunk(
    state: &Arc<AppState>,
    chunk: FileChunkPayload,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let local_id = state
        .current_user
        .read()
        .await
        .as_ref()
        .ok_or("No current user")?
        .id;
    if chunk.receiver_id != local_id {
        return Ok(());
    }
    let bytes = base64::engine::general_purpose::STANDARD.decode(&chunk.data)?;
    let part_path = state.temp_dir().join(format!("{}.part", chunk.download_id));
    let mut file = tokio::fs::OpenOptions::new()
        .create(true)
        .write(true)
        .open(&part_path)
        .await?;
    file.seek(std::io::SeekFrom::Start(
        chunk.chunk_index * FILE_CHUNK_BYTES as u64,
    ))
    .await?;
    file.write_all(&bytes).await?;
    file.flush().await?;
    let downloaded = ((chunk.chunk_index * FILE_CHUNK_BYTES as u64) + bytes.len() as u64)
        .min(chunk.total_bytes.max(0) as u64) as i64;
    sqlx::query("UPDATE downloads SET progress_bytes = ?, updated_at = ? WHERE id = ?")
        .bind(downloaded)
        .bind(chrono::Utc::now().to_rfc3339())
        .bind(chunk.download_id.to_string())
        .execute(state.database.pool())
        .await?;
    if let Some(app) = state.app_handle.read().await.as_ref() {
        let percentage = if chunk.total_bytes > 0 {
            downloaded as f64 * 100.0 / chunk.total_bytes as f64
        } else {
            100.0
        };
        let _ = app.emit(
            "download:progress",
            serde_json::json!({
                "downloadId": chunk.download_id, "attachmentId": chunk.attachment_id,
                "bytesDownloaded": downloaded, "totalBytes": chunk.total_bytes,
                "percentage": percentage, "bytesPerSecond": 0.0, "estimatedTimeRemaining": null
            }),
        );
    }
    if chunk.chunk_index + 1 == chunk.total_chunks {
        finalize_attachment_download(state, &chunk, &part_path).await?;
    }
    Ok(())
}

async fn finalize_attachment_download(
    state: &Arc<AppState>,
    chunk: &FileChunkPayload,
    part_path: &std::path::Path,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let data = tokio::fs::read(part_path).await?;
    let actual = hex::encode(Sha256::digest(&data));
    if actual != chunk.checksum {
        let _ = tokio::fs::remove_file(part_path).await;
        return Err(format!(
            "attachment checksum mismatch: expected {}, got {actual}",
            chunk.checksum
        )
        .into());
    }
    let original: String =
        sqlx::query_scalar("SELECT original_filename FROM attachments WHERE id = ?")
            .bind(chunk.attachment_id.to_string())
            .fetch_one(state.database.pool())
            .await?;
    let safe_name: String = original
        .chars()
        .map(|value| {
            if value.is_alphanumeric() || matches!(value, '.' | '-' | '_' | ' ') {
                value
            } else {
                '_'
            }
        })
        .collect();
    let destination = state
        .downloads_dir()
        .join(format!("{}-{safe_name}", chunk.attachment_id));
    tokio::fs::rename(part_path, &destination).await?;
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query("UPDATE downloads SET status = 'completed', progress_bytes = ?, local_path = ?, completed_at = ?, updated_at = ? WHERE id = ?")
        .bind(chunk.total_bytes).bind(destination.to_string_lossy().to_string())
        .bind(&now).bind(&now).bind(chunk.download_id.to_string())
        .execute(state.database.pool()).await?;
    if let Some(app) = state.app_handle.read().await.as_ref() {
        let _ = app.emit(
            "download:completed",
            serde_json::json!({
                "downloadId": chunk.download_id, "localPath": destination.to_string_lossy()
            }),
        );
    }
    Ok(())
}

//! TCP peer connections for messaging.

use crate::models::{MessageWithDetails, TypingIndicator};
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::sync::Arc;
use tauri::Emitter;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
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
    mut stream: TcpStream,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut buf = vec![0u8; 4096];
    let mut accumulated = Vec::new();

    loop {
        match stream.read(&mut buf).await {
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

            // Keep connection alive briefly then let it drop
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

            if let Some(app_handle) = state.app_handle.read().await.as_ref() {
                if let Ok(Some(peer)) =
                    crate::services::get_peer_by_id(state.database.clone(), peer_id).await
                {
                    let _ = app_handle.emit("peer:connected", peer);
                }
            }

            Ok(())
        }
        Ok(Err(e)) => {
            tracing::warn!("Failed to connect to peer {}: {}", addr, e);
            Ok(())
        }
        Err(_) => {
            tracing::warn!("Connection timeout to peer {}", addr);
            Ok(())
        }
    }
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
    let rows =
        sqlx::query("SELECT address, port FROM peers WHERE is_connected = 1 OR is_connected = 0")
            .fetch_all(state.database.pool())
            .await?;

    for row in rows {
        let address: String = row.try_get("address")?;
        let port: i32 = row.try_get("port")?;
        let addr = format!("{}:{}", address, port);

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

    let rows =
        sqlx::query("SELECT address, port FROM peers WHERE is_connected = 1 OR is_connected = 0")
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

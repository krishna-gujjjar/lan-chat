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

/// Start TCP listener for incoming peer connections.
pub async fn start_tcp_listener(
    state: Arc<AppState>,
) -> Result<u16, Box<dyn std::error::Error + Send + Sync>> {
    let listener = TcpListener::bind("0.0.0.0:0").await?;
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

                    if accumulated.len() < 4 + len {
                        break;
                    }

                    let json_bytes = accumulated[4..4 + len].to_vec();
                    accumulated.drain(..4 + len);

                    if let Ok(packet) = serde_json::from_slice::<NetworkPacket>(&json_bytes) {
                        if let Err(e) = handle_network_packet(&state, packet).await {
                            tracing::error!("Error handling packet: {}", e);
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
            if let Ok(msg) = serde_json::from_value::<MessageWithDetails>(packet.payload) {
                // Store in database
                let service = crate::services::MessageService::new(state.database.clone());
                let _ = service
                    .create_message(
                        msg.message.sender_id,
                        crate::models::CreateMessageInput {
                            content: msg.message.content.clone().unwrap_or_default(),
                            reply_to_id: msg.message.reply_to_id,
                            mentioned_user_ids: None,
                            attachment_ids: None,
                        },
                    )
                    .await;

                // Emit to frontend
                if let Some(app_handle) = state.app_handle.read().await.as_ref() {
                    let _ = app_handle.emit("message:created", msg);
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
                let _ = timeout(WRITE_TIMEOUT, async {
                    let _ = stream.write_all(&data).await;
                    let _ = stream.flush().await;
                })
                .await;
            }
            _ => {}
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

//! UDP-based LAN peer discovery.

use crate::models::Peer;
use crate::network::local_address::local_ipv4;
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::net::SocketAddr;
use std::sync::Arc;
use tauri::Emitter;
use tokio::net::UdpSocket;
use tokio::time::{interval, Duration};
use uuid::Uuid;

// Deliberately avoid common development ports. Both UDP discovery and the TCP
// transport must be allowed through the host firewall on private networks.
pub const DISCOVERY_PORT: u16 = 42_421;
const DISCOVERY_INTERVAL_SECS: u64 = 3;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PresencePacket {
    #[serde(rename = "type")]
    packet_type: String,
    user_id: String,
    username: String,
    port: u16,
}

/// Start the discovery service.
pub async fn start_discovery_service(
    state: Arc<AppState>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let local_user = state
        .current_user
        .read()
        .await
        .clone()
        .ok_or("No local user")?;

    let bind_addr = SocketAddr::from(([0, 0, 0, 0], DISCOVERY_PORT));
    let socket = Arc::new(UdpSocket::bind(bind_addr).await?);
    socket.set_broadcast(true)?;

    let local_port = state
        .local_tcp_port
        .read()
        .await
        .ok_or("TCP listener has not started")?;

    // Spawn broadcaster
    let broadcast_socket = socket.clone();
    let user_id = local_user.id.to_string();
    let username = local_user.username.clone();
    tokio::spawn(async move {
        let mut ticker = interval(Duration::from_secs(DISCOVERY_INTERVAL_SECS));
        // Prefer the interface-directed broadcast. macOS may reject the limited
        // 255.255.255.255 route with EHOSTUNREACH even while subnet broadcast works.
        let broadcast_addresses = if let Some(address) = local_ipv4().await {
            let octets = address.octets();
            vec![SocketAddr::from((
                [octets[0], octets[1], octets[2], 255],
                DISCOVERY_PORT,
            ))]
        } else {
            vec![SocketAddr::from(([255, 255, 255, 255], DISCOVERY_PORT))]
        };
        let packet = PresencePacket {
            packet_type: "presence".to_string(),
            user_id: user_id.clone(),
            username: username.clone(),
            port: local_port,
        };
        let json = match serde_json::to_vec(&packet) {
            Ok(j) => j,
            Err(_) => return,
        };

        loop {
            ticker.tick().await;
            for address in &broadcast_addresses {
                if let Err(error) = broadcast_socket.send_to(&json, address).await {
                    tracing::warn!(%address, %error, "failed to broadcast presence");
                }
            }
        }
    });

    // Spawn listener
    let listen_socket = socket.clone();
    let state_clone = state.clone();
    tokio::spawn(async move {
        let mut buf = vec![0u8; 1024];
        loop {
            match listen_socket.recv_from(&mut buf).await {
                Ok((len, addr)) => {
                    if let Ok(packet) = serde_json::from_slice::<PresencePacket>(&buf[..len]) {
                        if packet.packet_type == "presence" {
                            handle_presence(&state_clone, packet, addr.ip().to_string()).await;
                        }
                    }
                }
                Err(_) => continue,
            }
        }
    });

    Ok(())
}

async fn handle_presence(state: &Arc<AppState>, packet: PresencePacket, address: String) {
    // Skip self
    if let Some(user) = state.current_user.read().await.as_ref() {
        if user.id.to_string() == packet.user_id {
            return;
        }
    }

    let user_id = match Uuid::parse_str(&packet.user_id) {
        Ok(id) => id,
        Err(_) => return,
    };

    // Upsert remote user
    let _ = state
        .user_service
        .upsert_remote_user(user_id, packet.username.clone())
        .await;

    // Upsert peer
    let mut peer = Peer::new(user_id, packet.username, address, packet.port);
    peer.last_seen_at = Some(chrono::Utc::now());

    let existing = sqlx::query("SELECT id, is_connected, created_at FROM peers WHERE user_id = ?")
        .bind(user_id.to_string())
        .fetch_optional(state.database.pool())
        .await;

    if let Ok(Some(row)) = existing {
        let id: String = match row.try_get("id") {
            Ok(id) => id,
            Err(_) => return,
        };
        // Presence refreshes must retain the database identity. Generating a new
        // peer UUID on every packet made later connection attempts query a peer
        // that did not exist and produced duplicate frontend entries.
        peer.id = match Uuid::parse_str(&id) {
            Ok(id) => id,
            Err(_) => return,
        };
        peer.is_connected = matches!(row.try_get::<i32, _>("is_connected"), Ok(1));
        if let Ok(created_at) = row.try_get::<String, _>("created_at") {
            if let Ok(value) = chrono::DateTime::parse_from_rfc3339(&created_at) {
                peer.created_at = value.with_timezone(&chrono::Utc);
            }
        }
        peer.last_seen_at = Some(chrono::Utc::now());
        peer.updated_at = chrono::Utc::now();
        let _ = sqlx::query(
            "UPDATE peers SET address = ?, port = ?, last_seen_at = ?, updated_at = ? WHERE id = ?",
        )
        .bind(&peer.address)
        .bind(peer.port as i32)
        .bind(chrono::Utc::now().to_rfc3339())
        .bind(chrono::Utc::now().to_rfc3339())
        .bind(id)
        .execute(state.database.pool())
        .await;
    } else {
        let _ = sqlx::query(
            "INSERT INTO peers (id, user_id, address, port, is_connected, last_seen_at, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?)",
        )
        .bind(peer.id.to_string())
        .bind(peer.user_id.to_string())
        .bind(&peer.address)
        .bind(peer.port as i32)
        .bind(chrono::Utc::now().to_rfc3339())
        .bind(peer.created_at.to_rfc3339())
        .bind(peer.updated_at.to_rfc3339())
        .execute(state.database.pool())
        .await;
    }

    // Keep the Copy UUID before moving the peer payload into Tauri's emitter.
    let peer_id = peer.id;

    // Emit event to frontend
    if let Some(app_handle) = state.app_handle.read().await.as_ref() {
        let _ = app_handle.emit("peer:discovered", peer.clone());
    }

    // Connection lifetime is long-running; never block the UDP discovery loop
    // or open a fresh probe for every three-second presence packet.
    if !peer.is_connected {
        // Reserve the attempt before spawning so duplicate broadcasts received in
        // the same millisecond cannot create parallel TCP connections.
        let _ = sqlx::query("UPDATE peers SET is_connected = 1, updated_at = ? WHERE id = ?")
            .bind(chrono::Utc::now().to_rfc3339())
            .bind(peer_id.to_string())
            .execute(state.database.pool())
            .await;
        let connection_state = state.clone();
        tokio::spawn(async move {
            if let Err(error) =
                crate::network::peer_connection::connect_to_peer(connection_state, peer_id).await
            {
                tracing::warn!(%error, %peer_id, "peer connection task ended with error");
            }
        });
    }
}

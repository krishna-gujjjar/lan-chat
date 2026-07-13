//! Peer domain model.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Connection status for peers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionStatus {
    Connected,
    Disconnected,
    Connecting,
}

impl Default for ConnectionStatus {
    fn default() -> Self {
        Self::Disconnected
    }
}

/// Network peer discovered on LAN.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Peer {
    pub id: Uuid,
    pub user_id: Uuid,
    pub username: String,
    pub address: String,
    pub port: u16,
    pub is_connected: bool,
    pub last_seen_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Peer {
    /// Create a new peer.
    pub fn new(user_id: Uuid, username: String, address: String, port: u16) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            user_id,
            username,
            address,
            port,
            is_connected: false,
            last_seen_at: None,
            created_at: now,
            updated_at: now,
        }
    }

    /// Get the socket address string.
    pub fn socket_addr(&self) -> String {
        format!("{}:{}", self.address, self.port)
    }
}

/// Network statistics.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkStats {
    pub connected_peers: usize,
    pub total_bytes_sent: u64,
    pub total_bytes_received: u64,
    pub active_transfers: usize,
    pub uptime: u64,
}

impl Default for NetworkStats {
    fn default() -> Self {
        Self {
            connected_peers: 0,
            total_bytes_sent: 0,
            total_bytes_received: 0,
            active_transfers: 0,
            uptime: 0,
        }
    }
}

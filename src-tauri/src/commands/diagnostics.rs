//! Self-contained network diagnostics exposed to the troubleshooting UI.

use crate::state::AppState;
use serde::Serialize;
use sqlx::Row;
use std::sync::Arc;
use std::time::Instant;
use tauri::State;
use tokio::net::TcpStream;
use tokio::time::{timeout, Duration};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PeerDiagnostic {
    address: String,
    database_connected: bool,
    error: Option<String>,
    last_seen_at: Option<String>,
    latency_ms: Option<u64>,
    port: u16,
    reachable: bool,
    user_id: String,
    username: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkDiagnosticReport {
    discovery_port: u16,
    generated_at: String,
    local_address: Option<String>,
    local_tcp_port: Option<u16>,
    local_user: Option<String>,
    local_user_id: Option<String>,
    peers: Vec<PeerDiagnostic>,
}

#[tauri::command]
pub async fn run_network_diagnostics(
    state: State<'_, Arc<AppState>>,
) -> Result<NetworkDiagnosticReport, String> {
    let rows = sqlx::query(
        "SELECT u.id AS user_id, u.username, p.address, p.port, p.is_connected, p.last_seen_at FROM peers p JOIN users u ON u.id = p.user_id ORDER BY u.username",
    )
    .fetch_all(state.database.pool())
    .await
    .map_err(|error| error.to_string())?;

    let mut peers = Vec::with_capacity(rows.len());
    for row in rows {
        let address: String = row.try_get("address").map_err(|e| e.to_string())?;
        let port = row.try_get::<i32, _>("port").map_err(|e| e.to_string())? as u16;
        let target = format!("{address}:{port}");
        let started = Instant::now();
        let probe = timeout(Duration::from_secs(2), TcpStream::connect(&target)).await;
        let (reachable, latency_ms, error) = match probe {
            Ok(Ok(_)) => (true, Some(started.elapsed().as_millis() as u64), None),
            Ok(Err(error)) => (false, None, Some(error.to_string())),
            Err(_) => (
                false,
                None,
                Some("connection timed out after 2 seconds".into()),
            ),
        };
        peers.push(PeerDiagnostic {
            address,
            database_connected: row.try_get::<i32, _>("is_connected").unwrap_or_default() == 1,
            error,
            last_seen_at: row.try_get("last_seen_at").unwrap_or_default(),
            latency_ms,
            port,
            reachable,
            user_id: row.try_get("user_id").map_err(|e| e.to_string())?,
            username: row.try_get("username").map_err(|e| e.to_string())?,
        });
    }

    Ok(NetworkDiagnosticReport {
        discovery_port: crate::network::discovery::DISCOVERY_PORT,
        generated_at: chrono::Utc::now().to_rfc3339(),
        local_address: crate::network::local_address::local_ipv4()
            .await
            .map(|address| address.to_string()),
        local_tcp_port: *state.local_tcp_port.read().await,
        local_user: state
            .current_user
            .read()
            .await
            .as_ref()
            .map(|user| user.username.clone()),
        local_user_id: state
            .current_user
            .read()
            .await
            .as_ref()
            .map(|user| user.id.to_string()),
        peers,
    })
}

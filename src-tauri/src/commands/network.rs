//! Network-related commands.

use crate::models::Peer;
use crate::state::AppState;
use sqlx::Row;
use std::sync::Arc;
use tauri::State;

/// Get all discovered peers.
#[tauri::command]
pub async fn get_peers(state: State<'_, Arc<AppState>>) -> Result<Vec<Peer>, String> {
    let rows = sqlx::query(
        r#"
        SELECT p.id, p.user_id, u.username, p.address, p.port, p.is_connected,
               p.last_seen_at, p.created_at, p.updated_at
        FROM peers p
        JOIN users u ON p.user_id = u.id
        ORDER BY u.username ASC
        "#,
    )
    .fetch_all(state.database.pool())
    .await
    .map_err(|e| e.to_string())?;

    let mut peers = Vec::new();
    for row in rows {
        let id: String = row.try_get("id").map_err(|e| e.to_string())?;
        let user_id: String = row.try_get("user_id").map_err(|e| e.to_string())?;
        let last_seen_at: Option<String> =
            row.try_get("last_seen_at").map_err(|e| e.to_string())?;
        let created_at: String = row.try_get("created_at").map_err(|e| e.to_string())?;
        let updated_at: String = row.try_get("updated_at").map_err(|e| e.to_string())?;

        peers.push(Peer {
            id: uuid::Uuid::parse_str(&id).map_err(|e| e.to_string())?,
            user_id: uuid::Uuid::parse_str(&user_id).map_err(|e| e.to_string())?,
            username: row.try_get("username").map_err(|e| e.to_string())?,
            address: row.try_get("address").map_err(|e| e.to_string())?,
            port: row.try_get::<i32, _>("port").map_err(|e| e.to_string())? as u16,
            is_connected: row
                .try_get::<i32, _>("is_connected")
                .map_err(|e| e.to_string())?
                == 1,
            last_seen_at: last_seen_at
                .map(|s| chrono::DateTime::parse_from_rfc3339(&s))
                .transpose()
                .map_err(|e| e.to_string())?
                .map(|d| d.with_timezone(&chrono::Utc)),
            created_at: chrono::DateTime::parse_from_rfc3339(&created_at)
                .map_err(|e| e.to_string())?
                .with_timezone(&chrono::Utc),
            updated_at: chrono::DateTime::parse_from_rfc3339(&updated_at)
                .map_err(|e| e.to_string())?
                .with_timezone(&chrono::Utc),
        });
    }

    Ok(peers)
}

/// Start mDNS discovery service.
#[tauri::command]
pub async fn start_discovery(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let state_arc = state.inner().clone();
    tokio::spawn(async move {
        if let Err(e) = crate::network::discovery::start_discovery_service(state_arc).await {
            tracing::error!("Discovery error: {}", e);
        }
    });
    Ok(())
}

/// Stop mDNS discovery service.
#[tauri::command]
pub async fn stop_discovery(_state: State<'_, Arc<AppState>>) -> Result<(), String> {
    // TODO: Implement proper discovery shutdown
    tracing::info!("Stopping peer discovery...");
    Ok(())
}

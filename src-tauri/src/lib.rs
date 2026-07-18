//! LAN Chat application library.
//!
//! This module contains the core application logic and Tauri setup.

pub mod commands;
pub mod database;
pub mod errors;
pub mod models;
pub mod network;
pub mod services;
pub mod state;

use state::AppState;
use std::sync::Arc;
use tauri::Manager;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

/// Initialize and run the Tauri application.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "lan_chat=debug,tauri=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting LAN Chat application");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let handle = app.handle().clone();

            // Initialize application state
            tauri::async_runtime::block_on(async {
                let state = AppState::new(&handle)
                    .await
                    .expect("Failed to initialize application state");
                let state_arc = Arc::new(state);
                app.manage(state_arc.clone());

                // Start TCP listener for peer connections
                match network::peer_connection::start_tcp_listener(state_arc.clone()).await {
                    Ok(port) => {
                        tracing::info!("TCP listener active on port {}", port);
                    }
                    Err(e) => {
                        tracing::error!("Failed to start TCP listener: {}", e);
                    }
                }

                // Start discovery if user exists
                if state_arc.current_user.read().await.is_some() {
                    if let Err(e) = network::discovery::start_discovery_service(state_arc).await {
                        tracing::error!("Failed to start discovery: {}", e);
                    }
                }
            });

            tracing::info!("Application setup complete");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // User commands
            commands::user::get_current_user,
            commands::user::update_user,
            commands::user::set_avatar,
            commands::user::get_all_users,
            // Message commands
            commands::message::send_message,
            commands::message::edit_message,
            commands::message::delete_message,
            commands::message::get_messages,
            commands::message::search_messages,
            commands::message::add_reaction,
            commands::message::remove_reaction,
            // Attachment commands
            commands::attachment::upload_files,
            commands::attachment::paste_clipboard_image,
            commands::attachment::start_download,
            commands::attachment::pause_download,
            commands::attachment::cancel_download,
            commands::attachment::get_download_progress,
            // Settings commands
            commands::settings::get_settings,
            commands::settings::update_settings,
            // Network commands
            commands::network::get_peers,
            commands::network::start_discovery,
            commands::network::stop_discovery,
            commands::diagnostics::run_network_diagnostics,
            // App commands
            commands::app::initialize_app,
            commands::app::get_app_data_dir,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running tauri application");
}

//! Network module for LAN peer discovery and messaging.

pub mod discovery;
pub mod local_address;
pub mod peer_connection;

pub use discovery::start_discovery_service;
pub use peer_connection::{broadcast_message, broadcast_typing, start_tcp_listener};

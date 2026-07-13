//! Database module.
//!
//! Handles SQLite database connections and migrations.

mod connection;
mod migrations;

pub use connection::Database;

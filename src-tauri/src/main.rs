//! Application entry point.
//! 
//! This is the main entry point for the desktop application.
//! It initializes the Tauri runtime and starts the application.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    lan_chat_lib::run();
}

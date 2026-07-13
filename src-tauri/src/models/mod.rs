//! Domain models.
//!
//! This module contains all data structures used throughout the application.

pub mod user;
pub mod message;
pub mod attachment;
pub mod peer;
pub mod settings;

pub use user::*;
pub use message::*;
pub use attachment::*;
pub use peer::*;
pub use settings::*;

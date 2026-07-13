//! Database migrations.
//!
//! Contains SQL statements for creating and updating the database schema.

/// SQL to create all tables.
pub const CREATE_TABLES: &str = r#"
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    avatar_path TEXT,
    is_local INTEGER NOT NULL DEFAULT 0,
    last_seen_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL REFERENCES users(id),
    content TEXT,
    reply_to_id TEXT REFERENCES messages(id),
    is_edited INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'sending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Attachments table
CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES messages(id),
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    checksum TEXT NOT NULL,
    is_image INTEGER NOT NULL DEFAULT 0,
    width INTEGER,
    height INTEGER,
    created_at TEXT NOT NULL
);

-- Reactions table
CREATE TABLE IF NOT EXISTS reactions (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES messages(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    emoji TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(message_id, user_id, emoji)
);

-- Mentions table
CREATE TABLE IF NOT EXISTS mentions (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES messages(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
);

-- Read receipts table
CREATE TABLE IF NOT EXISTS read_receipts (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES messages(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    read_at TEXT NOT NULL,
    UNIQUE(message_id, user_id)
);

-- Peers table
CREATE TABLE IF NOT EXISTS peers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    address TEXT NOT NULL,
    port INTEGER NOT NULL,
    is_connected INTEGER NOT NULL DEFAULT 0,
    last_seen_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Downloads table
CREATE TABLE IF NOT EXISTS downloads (
    id TEXT PRIMARY KEY,
    attachment_id TEXT NOT NULL REFERENCES attachments(id),
    status TEXT NOT NULL DEFAULT 'pending',
    progress_bytes INTEGER NOT NULL DEFAULT 0,
    local_path TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
"#;

/// SQL to create indexes.
pub const CREATE_INDEXES: &str = r#"
-- Message indexes
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id ON messages(reply_to_id);

-- Attachment indexes
CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id);

-- Reaction indexes
CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON reactions(user_id);

-- Mention indexes
CREATE INDEX IF NOT EXISTS idx_mentions_message_id ON mentions(message_id);
CREATE INDEX IF NOT EXISTS idx_mentions_user_id ON mentions(user_id);

-- Download indexes
CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
CREATE INDEX IF NOT EXISTS idx_downloads_attachment_id ON downloads(attachment_id);

-- Peer indexes
CREATE INDEX IF NOT EXISTS idx_peers_user_id ON peers(user_id);
CREATE INDEX IF NOT EXISTS idx_peers_is_connected ON peers(is_connected);

-- Full-text search for messages (optional)
-- CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(content, content=messages);
"#;

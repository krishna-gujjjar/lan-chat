# LAN Chat Application Architecture

## Overview

A production-ready, offline-first desktop chat application built with Tauri v2, enabling direct peer-to-peer communication over LAN without any cloud dependencies.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    React 19 + TypeScript                     │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐│ │
│  │  │  Chat    │ │  Users   │ │ Settings │ │   Attachments    ││ │
│  │  │  Feature │ │  Feature │ │  Feature │ │     Feature      ││ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘│ │
│  │                                                              │ │
│  │  ┌─────────────────────────────────────────────────────────┐│ │
│  │  │  Shared: Hooks, Components, Types, Stores (Zustand)     ││ │
│  │  └─────────────────────────────────────────────────────────┘│ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────┘
                               │ Tauri IPC (invoke/listen)
┌──────────────────────────────▼──────────────────────────────────┐
│                       APPLICATION LAYER                          │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                     Tauri Commands                           │ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌───────────┐ │ │
│  │  │   Chat     │ │   User     │ │  Network   │ │  Storage  │ │ │
│  │  │  Commands  │ │  Commands  │ │  Commands  │ │  Commands │ │ │
│  │  └────────────┘ └────────────┘ └────────────┘ └───────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                        DOMAIN LAYER                              │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                      Services                                │ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌───────────┐ │ │
│  │  │   Chat     │ │   User     │ │  Transfer  │ │  Discovery│ │ │
│  │  │  Service   │ │  Service   │ │  Service   │ │  Service  │ │ │
│  │  └────────────┘ └────────────┘ └────────────┘ └───────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                      Domain Models                           │ │
│  │  Message, User, Attachment, Peer, Transfer, Settings         │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                     INFRASTRUCTURE LAYER                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │
│  │  SQLite     │ │  Network    │ │  FileSystem │ │  Clipboard │ │
│  │  Repository │ │  (TCP/WS)   │ │  Storage    │ │  Manager   │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘ │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│  │  mDNS       │ │  Image      │ │  Tray       │                │
│  │  Discovery  │ │  Processing │ │  Manager    │                │
│  └─────────────┘ └─────────────┘ └─────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Message Sending
1. User types message in React UI
2. UI calls `invoke("send_message", { content, attachments })`
3. ChatService creates Message domain model
4. MessageRepository persists to SQLite
5. NetworkService broadcasts to connected peers
6. Peers receive and store message
7. Event emitted to update all UIs

### File Transfer
1. Sender attaches file
2. File copied to `uploads/` with UUID name
3. Metadata stored in SQLite
4. Only metadata sent to peers
5. Receiver sees download button
6. On click: request file from sender
7. Chunked transfer with progress
8. Receiver saves to `downloads/`
9. Checksum verification

### Peer Discovery
1. App starts mDNS service on launch
2. Broadcasts presence on LAN
3. Discovers other peers automatically
4. Establishes TCP/WebSocket connections
5. Maintains heartbeat for connection health
6. Auto-reconnect on disconnect

## Database Schema

```sql
-- Users table
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    avatar_path TEXT,
    is_local INTEGER NOT NULL DEFAULT 0,
    last_seen_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Messages table
CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL REFERENCES users(id),
    content TEXT,
    reply_to_id TEXT REFERENCES messages(id),
    is_edited INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Attachments table
CREATE TABLE attachments (
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
CREATE TABLE reactions (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES messages(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    emoji TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(message_id, user_id, emoji)
);

-- Peers table
CREATE TABLE peers (
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
CREATE TABLE downloads (
    id TEXT PRIMARY KEY,
    attachment_id TEXT NOT NULL REFERENCES attachments(id),
    status TEXT NOT NULL,
    progress_bytes INTEGER NOT NULL DEFAULT 0,
    local_path TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Settings table
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Message mentions
CREATE TABLE mentions (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES messages(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
);

-- Typing indicators (in-memory, not persisted)
-- Read receipts
CREATE TABLE read_receipts (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES messages(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    read_at TEXT NOT NULL,
    UNIQUE(message_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_attachments_message_id ON attachments(message_id);
CREATE INDEX idx_reactions_message_id ON reactions(message_id);
CREATE INDEX idx_downloads_status ON downloads(status);
CREATE INDEX idx_mentions_user_id ON mentions(user_id);
```

## Directory Structure

### Application Data
```
Documents/LanChat/
├── database/
│   └── chat.db
├── uploads/
│   ├── images/
│   └── files/
├── downloads/
├── avatars/
├── logs/
├── cache/
└── temp/
```

## Security Considerations

1. **Path Traversal Protection**: All file paths sanitized
2. **Filename Sanitization**: UUID-based stored filenames
3. **Checksum Validation**: SHA-256 for file integrity
4. **Size Limits**: Configurable max upload size
5. **LAN Only**: No external network access
6. **No Credentials**: No authentication needed (trusted LAN)

## Performance Targets

- Support 100,000+ messages
- Virtualized list rendering
- Lazy image loading
- Background database indexing
- Chunked file transfers
- Connection pooling

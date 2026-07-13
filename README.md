# LAN Chat

A production-ready, offline-first desktop chat application built with Tauri v2.

## Tech Stack

### Frontend
- React 19
- TypeScript 5.9
- Vite 7
- Tailwind CSS 4
- TanStack Query
- Zustand (state management)
- Zod (validation)

### Backend (Rust)
- Tauri v2
- SQLite + SQLx
- Tokio (async runtime)
- mDNS (peer discovery)
- Serde (serialization)
- Tracing (logging)

## Features

- **Offline-first**: All data stored locally in SQLite
- **LAN messaging**: Direct peer-to-peer communication
- **Auto-discovery**: Automatic peer discovery via mDNS
- **File sharing**: Drag & drop, clipboard paste support
- **Rich messaging**: Replies, reactions, mentions, edit/delete
- **Search**: Full-text message search
- **Themes**: Light/dark/system themes

## Project Structure

```
├── src/                          # Frontend source
│   ├── app/                      # App-level code
│   │   ├── layout/               # Layout components
│   │   └── providers/            # React providers
│   ├── features/                 # Feature modules
│   │   └── chat/                 # Chat feature
│   │       └── components/       # Chat components
│   └── shared/                   # Shared code
│       ├── components/           # Shared UI components
│       ├── hooks/                # Custom hooks
│       ├── lib/                  # Libraries/utilities
│       │   ├── schemas/          # Zod schemas
│       │   └── tauri/            # Tauri API bridge
│       ├── stores/               # Zustand stores
│       └── types/                # TypeScript types
│
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── commands/             # Tauri commands
│   │   ├── database/             # Database layer
│   │   ├── models/               # Domain models
│   │   ├── services/             # Business logic
│   │   └── state/                # App state
│   ├── capabilities/             # Tauri v2 permissions
│   └── Cargo.toml
│
└── docs/                         # Documentation
    └── architecture.md
```

## Data Storage

Application data is stored in:
- **Windows**: `Documents/LanChat/`
- **macOS**: `~/Documents/LanChat/`
- **Linux**: `~/Documents/LanChat/`

```
LanChat/
├── database/
│   └── chat.db              # SQLite database
├── uploads/
│   ├── images/              # Uploaded images
│   └── files/               # Uploaded files
├── downloads/               # Downloaded files
├── avatars/                 # User avatars
├── logs/                    # Application logs
├── cache/                   # Cache data
└── temp/                    # Temporary files
```

## Development

### Prerequisites
- Node.js 20+
- Rust 1.70+
- Tauri CLI

### Setup

```bash
# Install dependencies
npm install

# Run development server
npm run tauri dev

# Build for production
npm run tauri build
```

## Architecture

See [docs/architecture.md](docs/architecture.md) for detailed architecture documentation.

## License

MIT

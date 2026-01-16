# Project Structure

This document provides a detailed overview of the VerseConnect project structure.

## Directory Tree

```
VerseConnect/
├── .gemini/                # Metadata and AI artifacts
├── docs/                   # Documentation (this folder)
├── src/
│   ├── main/               # Electron Main Process Code
│   │   ├── handlers/       # IPC Handlers (Renderer -> Main communication)
│   │   ├── services/       # Business Logic and External Services (File system, API)
│   │   ├── index.js        # Entry point for Electron
│   │   ├── store.js        # Electron Store configuration
│   │   └── windowManager.js # Browser Window management
│   ├── lib/                # SvelteKit Library Code (Renderer)
│   │   ├── components/     # Reusable Svelte components
│   │   └── stores/         # State management using Svelte 5 Runes
│   └── routes/             # SvelteKit Routes (Pages)
│       ├── import/         # Import page (+page.svelte)
│       ├── +layout.svelte  # Root layout
│       └── +page.svelte    # Main image viewer page
├── static/                 # Static assets
├── GEMINI.md               # High-level project overview
└── package.json            # Dependencies and scripts
```

## Module Separation

The project strictly separates the **Main Process** (Electron/Node.js) and the **Renderer Process** (SvelteKit/Browser).

### Main Process (`src/main`)
- Handles all native capabilities: File System access, HTTP requests (bypassing CORS), Shell integration.
- Exposes functionality to the Renderer via **IPC (Inter-Process Communication)**.
- **Entry Point**: `src/main/index.js`
- See [Main Process Documentation](./main_process.md) for details.

### Renderer Process (`src/lib`, `src/routes`)
- Handles UI, Interaction, and State Management.
- Uses **Svelte 5 Runes** for reactivity.
- Communicate with Main Process strictly via `window.electronAPI`.
- See [Renderer Process Documentation](./renderer_process.md) for details.

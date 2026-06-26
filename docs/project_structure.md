# Project Structure

This document provides a detailed overview of the VerseConnect project structure.

## Directory Tree

```
VerseConnect/
├── .agents/                # Project customizations and rules
├── docs/                   # Documentation (this folder)
├── src/
│   ├── main/               # Electron Main Process Code
│   │   ├── handlers/       # IPC Handlers (Renderer -> Main communication)
│   │   │   ├── aipriHandlers.js
│   │   │   ├── appHandlers.js
│   │   │   └── fileHandlers.js
│   │   ├── services/       # Business Logic and Services
│   │   │   ├── aipriService.js
│   │   │   ├── fileService.js
│   │   │   └── updateService.js # Auto-updater service
│   │   ├── index.js        # Entry point for Electron
│   │   ├── store.js        # Electron Store configuration
│   │   └── windowManager.js # Browser Window management
│   ├── lib/                # SvelteKit Library Code (Renderer)
│   │   ├── components/     # Reusable Svelte components
│   │   │   ├── AccountSelector.svelte
│   │   │   ├── BulkEditPanel.svelte
│   │   │   ├── ImageModal.svelte
│   │   │   ├── ImageTile.svelte
│   │   │   ├── MetadataEditor.svelte
│   │   │   └── SearchPanel.svelte
│   │   └── stores/         # State management using Svelte 5 Runes
│   │       ├── session.svelte.ts
│   │       ├── settings.svelte.ts
│   │       └── update.svelte.ts # Auto-updater UI state
│   ├── routes/             # SvelteKit Routes (Pages)
│   │   ├── import/         # Import page (+page.svelte)
│   │   ├── settings/       # Settings page (+page.svelte)
│   │   ├── +layout.svelte  # Root layout
│   │   ├── +layout.ts      # Page loading configuration
│   │   └── +page.svelte    # Main image viewer page
│   └── preload.cjs         # Electron Context Bridge preload script
├── static/                 # Static assets
├── AGENTS.md               # Workspace rules and AI persona configuration
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

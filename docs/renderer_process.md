# Renderer Process Documentation

The Renderer Process is a **SvelteKit** application serving as the user interface. It communicates with the Main Process via the `window.electronAPI` bridge.

**Root Directory**: [`src/`](../src/) (specifically `lib/` and `routes/`)

## State Management (`src/lib/stores/`)

The application uses **Svelte 5 Runes** (`$state`, `$derived`, `$props`) for fine-grained reactivity.

### [session.svelte.ts](../src/lib/stores/session.svelte.ts)

Manages the current user's Aipri account session.

- **State**: `isLoggedIn`, `profileImageUrl`, `accounts`, `activeAccountName`.
- **Key Actions**:
  - `checkSession()`: Verifies validity on startup.
  - `login()`: Authenticates a new user.
  - `switchAccount()`: Changes the active user.
  - `loadAccounts()`: Syncs the account list from Electron store.

### [settings.svelte.ts](../src/lib/stores/settings.svelte.ts)

Manages global application configurations.

- **State**: `folderPath` (target scanning folder), `itemImageFolderPath` (folder containing item overlays/icons), `customCharacters` (user-defined characters list), `customTags` (user-defined tags list), `autoUpdateCheck` (auto-update preference flag), and `debugMode` (developer simulator flag).
- **Actions**:
  - `loadSettings()`: Syncs config from Electron.
  - `selectFolder()` / `selectItemImageFolder()`: Triggers native OS directory dialogs to select paths.
  - `addCustomCharacter()` / `removeCustomCharacter()`: Manages custom character presets.
  - `addCustomTag()` / `removeCustomTag()`: Manages custom tags.

### [update.svelte.ts](../src/lib/stores/update.svelte.ts)

Manages application auto-updater UI states and IPC callbacks.

- **State**: `currentVersion`, `status` (`idle`, `checking`, `available`, `downloading`, `downloaded`, `error`), `progress` (download percentage), `errorMessage`, `newVersion`, and `releaseNotes`.
- **Actions**:
  - `initUpdateListeners()`: Sets up listeners for Electron main process events and returns a cleanup/unsubscription function.
  - `checkForUpdates()`: Manages manual checks.
  - `quitAndInstall()`: Applies updates and restarts.

## Pages (`src/routes/`)

### Main Viewer (`+page.svelte`)

The primary interface for browsing images.

- **Features**:
  - **Infinite Scroll**: Uses an `IntersectionObserver` action on a sentinel element to dynamically load images in batches (`BATCH_SIZE = 24`).
  - **Filtering**: Filters by Character, Tag, Item, Play Month, and Friend Card presence. Uses `$derived.by` to recalculate view models. Toggles allow swapping between partial match (AND) and exact match for characters and tags.
  - **Sorting**: Sorts by date and sequential index in descending, ascending, or original order.
  - **Bulk Edit**: Toggles multi-select mode to select multiple items and batch update character labels simultaneously.
  - **Grid Options**: Toggles info overlays directly on image tiles for easy metadata browsing.

### Import Page (`import/+page.svelte`)

Dedicated interface for downloading photos from Aipri My Page.

- **Features**:
  - **Account Management**: Select, add, edit, switch, or remove multiple Aipri My Page profiles using cookie sessions.
  - **API Interaction**: Fetches photo lists by month (YYYYMM) using target dropdowns.
  - **Download Loop**: Downloads files sequentially with a 200ms sleep delay to reduce server load.
  - **Early Stop Option**: Toggles checking all images or stopping download loops immediately when encountering an already downloaded image.

### Settings Page (`settings/+page.svelte`)

Dedicated settings dashboard screen.

- **Features**:
  - **Folder Selection**: Configures main scanned directory path and item icon lookup directories.
  - **Updates**: View application version information, toggle automatic background check on boot, trigger manual updates, and monitor async download progress.
  - **Debigger Simulation**: Toggles simulated update flow (checks, download increments, reload banner) when running in development mode.
  - **Preset Management**: Displays hardcoded system character presets, and lets users add/delete custom characters or custom tags.

## Key Components (`src/lib/components/`)

- **[ImageTile.svelte](../src/lib/components/ImageTile.svelte)**: Renders individual image thumbnails, showing lazy loading, multi-select check overlays, and metadata tooltips (characters, items, tags).
- **[MetadataEditor.svelte](../src/lib/components/MetadataEditor.svelte)**: Editor pane for managing tags, characters, items, and linking/unlinking associated Friend Cards for a single image.
- **[SearchPanel.svelte](../src/lib/components/SearchPanel.svelte)**: Left sidebar drawer organizing filtering toggles (characters, tags, months, missing metadata filters, exact-match options) and sorting orders.
- **[ImageModal.svelte](../src/lib/components/ImageModal.svelte)**: High-performance detailed overlay viewer.
  - Supports zoom and pan controls (double click to zoom 2x, mouse wheel scroll zoom 0.5x to 5x, drag-to-pan).
  - Handles keyboard shortcuts (Esc to close, Arrow keys to navigate between next/previous items).
  - Exposes actions like copying images directly to clipboard (`copyImageToClipboard`) or opening parent folder directories (`showItemInFolder`).
  - Allows managing, switching between, or deleting associated "Friend Card" images.
- **[BulkEditPanel.svelte](../src/lib/components/BulkEditPanel.svelte)**: Footer panel appearing in multi-select mode. Allows adding characters to selected images in "overwrite" or "append" mode, showing application progress.
- **[AccountSelector.svelte](../src/lib/components/AccountSelector.svelte)**: Account manager popover for switching profiles, viewing user thumbnails, and deleting profiles.

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
Manages global application settings.
- **State**: `folderPath` (scan target), `customCharacters`, `customTags`.
- **Actions**:
    - `loadSettings()`: Fetches config from Electron.
    - `addCustomCharacter()` / `addCustomTag()`: Updates the local list and persists via Electron.

## Pages (`src/routes/`)

### Main Viewer (`+page.svelte`)
The primary interface for browsing images.
- **Features**:
    - **Infinite Scroll**: Uses an `IntersectionObserver` action to load images in batches (`BATCH_SIZE = 24`).
    - **Filtering**: Filters by Character, Tag, Item, or Missing Metadata. Logic uses `$derived.by` to efficiently re-calculate the view model.
    - **Bulk Edit**: Allows selecting multiple images to apply tags/characters simultaneously.
    - **Modal**: Displays high-res image and `MetadataEditor`.

### Import Page (`import/+page.svelte`)
Dedicated interface for downloading photos from Aipri My Page.
- **Features**:
    - **Account Management**: Add/Edit/Remove/Switch accounts.
    - **API Interaction**: Fetches photo lists by month (YYYYMM).
    - **Download Loop**: Sequentially downloads photos, tracking success/skip/error counts.

## Key Components (`src/lib/components/`)
- **[ImageTile.svelte](../src/lib/components/ImageTile.svelte)**: Displays a single thumbnail with metadata overlays.
- **[MetadataEditor.svelte](../src/lib/components/MetadataEditor.svelte)**: Form for editing characters, items, and tags for a single image.
- **[SearchPanel.svelte](../src/lib/components/SearchPanel.svelte)**: Sidebar/Top bar containing all filter controls.

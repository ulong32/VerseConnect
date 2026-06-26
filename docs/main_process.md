# Main Process Documentation

The Main Process runs in a Node.js environment and manages the application lifecycle, native windows, and system resources.

**Root Directory**: [`src/main/`](../src/main/)

## Entry Point: `index.js`

- **Path**: [`src/main/index.js`](../src/main/index.js)
- **Responsibilities**:
  - Initializes the Electron app.
  - Registers custom protocols (`local-image://`, `item-image://`) for secure file serving.
  - Sets up IPC handlers.
  - Creates the main application window.

## Preload Script: `preload.cjs`

- **Path**: [`src/preload.cjs`](../src/preload.cjs)
- **Responsibilities**:
  - Acts as the secure bridge (`contextBridge`) between the Main and Renderer processes.
  - Exposes safe APIs globally under `window.electronAPI`.
  - Controls the communication pathways by exposing `ipcRenderer.invoke` wrapper functions rather than raw IPC access, securing the frontend environment.

## Handlers (`src/main/handlers/`)

Handlers act as the "Controllers" or "API Endpoints" for the Renderer process. They listen for IPC events/invocations.

### [aipriHandlers.js](../src/main/handlers/aipriHandlers.js)

Manages Aipri (arcade game) account integration and operations.

- Legacy `aipri-login` handler was removed; login is now handled through multi-account IPC flows.
- `aipri-get-accounts`: Returns the list of registered accounts.
- `aipri-add-account`: Validates credentials by logging in and saving a new account.
- `aipri-remove-account`: Removes an account and deletes its local cached profile image.
- `aipri-update-account`: Updates credentials/re-authenticates an existing account.
- `aipri-switch-account`: Switches the active session to another account.
- `aipri-check-session`: Verifies if the current session cookie is valid.
- `aipri-fetch-photos`: Fetches the list of photos from the "My Photo" API for a specific year and month.
- `aipri-download-photo`: Downloads a specific photo from the My Photo CDN to the local disk.

### [appHandlers.js](../src/main/handlers/appHandlers.js)

Manages general application utilities and window controls.

- `select-folder`: Opens a native folder selection dialog (used to choose scan directories or image folders).
- `select-file`: Opens a native file selection dialog with configurable extension filters (used to locate Friend Cards).
- `get-settings` / `set-settings`: Reads/Writes application configurations (folder path, custom tag lists, auto update flag, debug mode) via `electron-store`.
- `show-confirm-dialog`: Shows a synchronous, native warning/confirmation message box with customizable buttons.
- `copy-image-to-clipboard`: Securely reads a local image file (validates extensions to prevent arbitrary read traversal) and copies it to the OS clipboard.
- `window-minimize`, `window-maximize`, `window-close`: Handlers executing window commands for the custom Frameless Window title bar.

### [fileHandlers.js](../src/main/handlers/fileHandlers.js)

Manages local file system operations involving images.

- `get-images`: Scans a directory recursively for images and returns their metadata.
- `get-image-metadata` / `set-image-metadata`: Loads or saves individual image metadata (characters, tags, items, associated friend cards).
- `save-friend-card`: Copies a Base64 encoded image as a Friend Card under the `friend_card/` subdirectory inside the scan folder.
- `delete-friend-card`: Deletes a saved Friend Card image.
- `show-item-in-folder`: Reveals the specified file in the OS file explorer.

## Services (`src/main/services/`)

Services contain the core business logic, decoupled from the IPC layer.

### [aipriService.js](../src/main/services/aipriService.js)

Handles interaction with the `aipri.jp` website.

- **Key Functions**:
  - `performLogin`: Submits credentials to `/mypage/login`, handles redirects, parsing cookies, and extracting profile images.
  - `fetchPhotos`: Calls the `/mypage/api/myphoto-list` endpoint.
  - `downloadPhoto`: Downloads image data and saves it using `fs`.
  - `verifySession`: Checks if the current session cookie allows access to My Page.
- **Cookie Management**: Manages Electron `session.defaultSession.cookies` to ensure requests are authenticated.

### [fileService.js](../src/main/services/fileService.js)

Handles low-level file manipulations.

- **Key Functions**:
  - `scanFolder`: Recursively walks directories.
  - `parseFilename`: Extracts dates and serial numbers from standard filenames (e.g., `aipriverse_album_YYYYMMDD_N.jpg` or `aipriverse_album_YYYYMM-DD_N.jpg`).
  - `loadFolderMetadata` / `saveFolderMetadata`: Reads/Writes `.image_metadata.json` in each scanned folder.
  - `saveFriendCard` / `deleteFriendCard`: Physical operations for placing or removing Friend Cards inside the `friend_card` subfolder.

### [updateService.js](../src/main/services/updateService.js)

Manages application auto-updates using the `electron-updater` package.

- **Key Functions**:
  - `setupUpdateService`: Configures updater logs, sets behavior, and sets up IPC event bridges.
  - Emits IPC update event channels to the renderer: `update-checking`, `update-available`, `update-not-available`, `update-download-progress`, `update-downloaded`, and `update-error`.
  - Handles updater lifecycle actions: checking for updates, downloading updates asynchronously, and triggering `quitAndInstall()`.
  - **Simulation Mode**: Includes a development debug simulator flow triggered via `debugMode` settings to verify update banners, downloads, and progress bar animations in non-packaged states.

## Data Persistence

- **Store**: Uses `electron-store` (initialized in [`src/main/store.js`](../src/main/store.js)) to save:
  - User settings (paths, custom tags, auto check update flags, debug mode).
  - Account information (Aipri accounts, including name, card ID, birthday, session cookies, and profile image paths).
- **Profile Images**: Profile thumbnails for registered accounts are saved in the app's native userData folder under the `profile_images/` directory.

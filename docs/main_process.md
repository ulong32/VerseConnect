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

## Handlers (`src/main/handlers/`)
Handlers act as the "Controllers" or "API Endpoints" for the Renderer process. They listen for IPC events/invocations.

### [aipriHandlers.js](../src/main/handlers/aipriHandlers.js)
Manages Aipri (arcade game) account integration and operations.
- `aipri-get-accounts`: Returns list of saved accounts.
- `aipri-add-account`: Logs in and saves a new account.
- `aipri-remove-account`: Removes an account and its local profile image.
- `aipri-update-account`: Updates credentials for an existing account.
- `aipri-switch-account`: Switches the active session to another account.
- `aipri-check-session`: Verifies if the current session cookie is valid.
- `aipri-fetch-photos`: Fetches the list of photos from the "My Photo" API.
- `aipri-download-photo`: Downloads a specific photo to the local disk.

### [appHandlers.js](../src/main/handlers/appHandlers.js)
Manages general application utilities and window controls.
- `select-folder`: Opens a native folder selection dialog.
- `get-settings` / `set-settings`: Reads/Writes application settings (paths, custom tags) via `electron-store`.
- `window-minimize`, `window-maximize`, `window-close`: Controls for the custom title bar.

### [fileHandlers.js](../src/main/handlers/fileHandlers.js)
Manages local file system operations involving images.
- `get-images`: Scans a directory recursively for images and metadata.
- `set-image-metadata`: Updates metadata (characters, tags) for a specific image.
- `save-friend-card`: Saves a Base64 encoded image as a Friend Card.
- `show-item-in-folder`: Reveals a file in the OS file explorer.

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
    - `parseFilename`: Extracts dates and serial numbers from standard filenames (e.g., `aipriverse_album_YYYYMMDD_N.jpg`).
    - `loadFolderMetadata` / `saveFolderMetadata`: Reads/Writes `.image_metadata.json` in each scanned folder.

## Data Persistence
- **Store**: Uses `electron-store` (initialized in [`src/main/store.js`](../src/main/store.js)) to save:
    - User settings (paths, custom tags).
    - Account information (credentials are NOT saved directly; session cookies and metadata are).

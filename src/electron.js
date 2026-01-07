import windowStateManager from 'electron-window-state';
import { app, BrowserWindow, ipcMain, dialog, protocol, net, shell, session } from 'electron';
import contextMenu from 'electron-context-menu';
import serve from 'electron-serve';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { fileURLToPath, pathToFileURL } from 'url';

// ESMでは__dirnameが使えないので、代替手段を使用
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// electron-storeはESMで動的インポート
/** @type {import('electron-store').default<{folderPath: string, customCharacters: string[], customTags: string[], aipriAccounts: Array<{name: string, cardId: string, birthdayM: string, birthdayD: string, sessionCookie: string | null, profileImagePath: string | null}>, aipriActiveAccountName: string | null}> | undefined} */
let store;

// Profile images directory
let profileImagesDir = '';

async function initStore() {
  const Store = (await import('electron-store')).default;
  // @ts-expect-error
  store = new Store({
    defaults: {
      folderPath: '',
      customCharacters: [],
      customTags: [],
      aipriAccounts: [],           // Array of AipriAccount
      aipriActiveAccountName: null // Currently active account name
    }
  });

  // Initialize profile images directory
  profileImagesDir = path.join(app.getPath('userData'), 'profile_images');
  if (!fs.existsSync(profileImagesDir)) {
    fs.mkdirSync(profileImagesDir, { recursive: true });
  }
}

// 画像ファイルの拡張子
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico'];

const serveURL = serve({ directory: '.' });
const port = process.env.PORT || 5173;
const dev = !app.isPackaged;
/** @type {BrowserWindow | null} */
let mainWindow = null;

function createWindow() {
  let windowState = windowStateManager({
    defaultWidth: 1280,
    defaultHeight: 720,
  });

  const mainWindow = new BrowserWindow({
    backgroundColor: 'whitesmoke',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#120b18',
      symbolColor: '#ffffff',
      height: 32
    },
    title: 'VerseConnect',
    icon: path.join(__dirname, 'lib/assets/favicon.png'),
    autoHideMenuBar: true,
    trafficLightPosition: {
      x: 17,
      y: 32,
    },
    minHeight: 450,
    minWidth: 500,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      devTools: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    fullscreenable: false,
    fullscreen: false,
    frame: false,
  });

  windowState.manage(mainWindow);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('close', () => {
    windowState.saveState(mainWindow);
  });

  return mainWindow;
}

contextMenu({
  showLookUpSelection: false,
  showSearchWithGoogle: false,
  showCopyImage: false,
});

/**
 * @param {number | string} port
 */
function loadVite(port) {
  if (!mainWindow) return;
  mainWindow.loadURL(`http://localhost:${port}`).catch((e) => {
    console.log('Error loading URL, retrying', e);
    setTimeout(() => {
      loadVite(port);
    }, 200);
  });
}

function createMainWindow() {
  mainWindow = createWindow();
  mainWindow.once('close', () => {
    mainWindow = null;
  });

  if (dev) loadVite(port);
  else serveURL(mainWindow);
}

// IPC Handlers
function setupIpcHandlers() {
  // フォルダ選択ダイアログ
  ipcMain.handle('select-folder', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  /**
   * ファイル名から日付と連番を抽出
   * Pattern: aipriverse_album_YYYYMMDD_N.ext or aipriverse_album_YYYYMM-DD_N.ext
   * @param {string} filename
   * @returns {{ date: string | null, serial: number | null }}
   */
  const parseFilename = (filename) => {
    // Pattern 1: aipriverse_album_YYYYMMDD_N (e.g., aipriverse_album_20240404_123.jpg)
    // Pattern 2: aipriverse_album_YYYYMM-DD_N (e.g., aipriverse_album_202409-26_123.jpg)
    const match = filename.match(/aipriverse_album_(\d{4})(\d{2})-?(\d{2})_(\d+)/);

    if (match) {
      const year = match[1];
      const month = match[2];
      const day = match[3];
      const serial = parseInt(match[4], 10);

      return {
        date: `${year}-${month}-${day}`,
        serial: serial
      };
    }

    return { date: null, serial: null };
  };

  // フォルダ内の画像ファイル一覧を再帰的に取得（メタデータ付き）
  ipcMain.handle('get-images', async (event, folderPath) => {
    if (!folderPath || !fs.existsSync(folderPath)) {
      return [];
    }

    /**
     * 再帰的にフォルダを走査して画像を収集
     * @param {string} currentPath - 現在のフォルダパス
     * @param {string} relativePath - ルートからの相対パス
     * @returns {Array<{name: string, path: string, url: string, metadata: object|null, folder: string, extractedDate: string|null, serial: number|null}>} 画像情報の配列
     */
    const scanFolder = (currentPath, relativePath = '') => {
      /** @type {Array<{name: string, path: string, url: string, metadata: object|null, folder: string, extractedDate: string|null, serial: number|null}>} */
      const images = [];

      try {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });

        // Load metadata for current folder
        const metadataPath = path.join(currentPath, '.image_metadata.json');
        /** @type {Record<string, any>} */
        let folderMetadata = {};
        try {
          if (fs.existsSync(metadataPath)) {
            const data = fs.readFileSync(metadataPath, 'utf-8');
            folderMetadata = JSON.parse(data);
          }
        } catch (err) {
          console.error('Error reading metadata:', err);
        }

        for (const entry of entries) {
          const entryPath = path.join(currentPath, entry.name);

          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'friend_card') {
            // 再帰的にサブフォルダを走査（friend_cardは除外）
            const subRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
            images.push(...scanFolder(entryPath, subRelativePath));
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (IMAGE_EXTENSIONS.includes(ext)) {
              // Extract date and serial from filename
              // Pattern: aipriverse_album_YYYYMMDD_N.jpg or aipriverse_album_YYYY-MM-DD_N.jpg
              const parsed = parseFilename(entry.name);

              images.push({
                name: entry.name,
                path: entryPath,
                url: `local-image://${encodeURIComponent(entryPath)}`,
                metadata: folderMetadata[entry.name] || null,
                folder: relativePath,
                extractedDate: parsed.date,
                serial: parsed.serial
              });
            }
          }
        }
      } catch (error) {
        console.error('Error scanning folder:', currentPath, error);
      }

      return images;
    };

    try {
      return scanFolder(folderPath);
    } catch (error) {
      console.error('Error reading folder:', error);
      return [];
    }
  });

  // 設定を取得
  ipcMain.handle('get-settings', async () => {
    return {
      folderPath: store?.get('folderPath') || '',
      customCharacters: store?.get('customCharacters') || [],
      customTags: store?.get('customTags') || []
    };
  });

  // 設定を保存
  ipcMain.handle('set-settings', async (event, settings) => {
    if (settings.folderPath !== undefined) {
      store?.set('folderPath', settings.folderPath);
    }
    if (settings.customCharacters !== undefined) {
      store?.set('customCharacters', settings.customCharacters);
    }
    if (settings.customTags !== undefined) {
      store?.set('customTags', settings.customTags);
    }
    return true;
  });

  // メタデータファイルのパスを取得
  /** @param {string} folderPath */
  const getMetadataFilePath = (folderPath) => {
    return path.join(folderPath, '.image_metadata.json');
  };

  // フォルダ内の全メタデータを読み込む
  /** @param {string} folderPath */
  const loadFolderMetadata = (folderPath) => {
    const metadataPath = getMetadataFilePath(folderPath);
    try {
      if (fs.existsSync(metadataPath)) {
        const data = fs.readFileSync(metadataPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error reading metadata file:', error);
    }
    return {};
  };

  // フォルダ内の全メタデータを保存
  /**
   * @param {string} folderPath
   * @param {Object} metadata
   */
  const saveFolderMetadata = (folderPath, metadata) => {
    const metadataPath = getMetadataFilePath(folderPath);
    try {
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
      return true;
    } catch (error) {
      console.error('Error writing metadata file:', error);
      return false;
    }
  };

  // 画像のメタデータを取得
  ipcMain.handle('get-image-metadata', async (event, folderPath, imageName) => {
    if (!folderPath || !imageName) return null;
    const allMetadata = loadFolderMetadata(folderPath);
    return allMetadata[imageName] || null;
  });

  // 画像のメタデータを保存
  ipcMain.handle('set-image-metadata', async (event, folderPath, imageName, metadata) => {
    if (!folderPath || !imageName) return false;
    const allMetadata = loadFolderMetadata(folderPath);
    allMetadata[imageName] = metadata;
    return saveFolderMetadata(folderPath, allMetadata);
  });

  // ZIPファイルを解凍して画像を抽出
  ipcMain.handle('extract-zip', async (event, zipPath, targetFolder) => {
    if (!zipPath || !targetFolder) {
      return { success: false, error: 'Invalid parameters', extracted: 0 };
    }

    try {
      const zip = new AdmZip(zipPath);
      const entries = zip.getEntries();
      let extractedCount = 0;

      for (const entry of entries) {
        // Skip directories
        if (entry.isDirectory) continue;

        // Get just the filename (ignore folder structure in ZIP)
        const filename = path.basename(entry.entryName);

        // Check if it's an image
        const ext = path.extname(filename).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif'].includes(ext)) {
          continue;
        }

        // Skip hidden files and macOS metadata
        if (filename.startsWith('.') || filename.startsWith('__MACOSX')) {
          continue;
        }

        // Extract to target folder
        const targetPath = path.join(targetFolder, filename);

        // Avoid overwriting existing files
        if (fs.existsSync(targetPath)) {
          console.log('Skipping existing file:', filename);
          continue;
        }

        const content = entry.getData();
        fs.writeFileSync(targetPath, content);
        extractedCount++;
      }

      return { success: true, extracted: extractedCount };
    } catch (error) {
      console.error('Error extracting ZIP:', error);
      return { success: false, error: String(error), extracted: 0 };
    }
  });

  // ファイルをエクスプローラで表示
  ipcMain.handle('show-item-in-folder', async (event, filePath) => {
    if (!filePath) return false;
    shell.showItemInFolder(filePath);
    return true;
  });

  // フレンドカード画像を保存
  ipcMain.handle('save-friend-card', async (event, folderPath, filename, base64Data) => {
    if (!folderPath || !filename || !base64Data) {
      return { success: false, error: 'Invalid parameters' };
    }

    try {
      // Create friend_card directory if it doesn't exist
      const friendCardDir = path.join(folderPath, 'friend_card');
      if (!fs.existsSync(friendCardDir)) {
        fs.mkdirSync(friendCardDir, { recursive: true });
      }

      // Convert base64 to buffer and save
      const buffer = Buffer.from(base64Data, 'base64');
      const targetPath = path.join(friendCardDir, filename);
      fs.writeFileSync(targetPath, buffer);

      return { success: true, filename };
    } catch (error) {
      console.error('Error saving friend card:', error);
      return { success: false, error: String(error) };
    }
  });

  // ===== Aipri.jp API Handlers =====

  const AIPRI_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const AIPRI_BASE_URL = 'https://aipri.jp';

  /**
   * Parse Set-Cookie header and extract cookies
   * @param {string[]} setCookieHeaders
   * @returns {string}
   */
  const parseCookies = (setCookieHeaders) => {
    if (!setCookieHeaders || setCookieHeaders.length === 0) return '';
    return setCookieHeaders
      .map(cookie => cookie.split(';')[0])
      .join('; ');
  };

  /**
   * Extract profile image URL from HTML
   * @param {string} html
   * @returns {string | null}
   */
  const extractProfileImage = (html) => {
    // Find img with class containing "profile_thumbImage"
    const match = html.match(/<img[^>]*class="[^"]*profile_thumbImage[^"]*"[^>]*src="([^"]+)"/);
    if (match && match[1]) {
      // If relative URL, make it absolute
      const src = match[1];
      if (src.startsWith('/')) {
        return AIPRI_BASE_URL + src;
      }
      return src;
    }
    // Try alternate pattern where src comes before class
    const altMatch = html.match(/<img[^>]*src="([^"]+)"[^>]*class="[^"]*profile_thumbImage[^"]*"/);
    if (altMatch && altMatch[1]) {
      const src = altMatch[1];
      if (src.startsWith('/')) {
        return AIPRI_BASE_URL + src;
      }
      return src;
    }
    return null;
  };

  /**
   * Get active account's session cookie
   * @returns {string | null}
   */
  const getActiveSessionCookie = () => {
    const activeAccountName = store?.get('aipriActiveAccountName');
    if (!activeAccountName) return null;

    const accounts = store?.get('aipriAccounts') || [];
    const activeAccount = accounts.find(acc => acc.name === activeAccountName);
    return activeAccount?.sessionCookie || null;
  };

  /**
   * Update active account's session cookie
   * @param {string} sessionCookie
   */
  const updateActiveSessionCookie = (sessionCookie) => {
    const activeAccountName = store?.get('aipriActiveAccountName');
    if (!activeAccountName) return;

    const accounts = store?.get('aipriAccounts') || [];
    const updatedAccounts = accounts.map(acc =>
      acc.name === activeAccountName
        ? { ...acc, sessionCookie }
        : acc
    );
    store?.set('aipriAccounts', updatedAccounts);
  };

  /**
   * Clear all aipri.jp cookies and set new ones from cookie string
   * This ensures net.fetch uses the correct account's session
   * @param {string} cookieString
   */
  const setAipriSessionCookies = async (cookieString) => {
    try {
      // First clear existing cookies
      const existingCookies = await session.defaultSession.cookies.get({ url: AIPRI_BASE_URL });
      for (const cookie of existingCookies) {
        await session.defaultSession.cookies.remove(AIPRI_BASE_URL, cookie.name);
      }
      const mypageCookies = await session.defaultSession.cookies.get({ url: `${AIPRI_BASE_URL}/mypage/` });
      for (const cookie of mypageCookies) {
        await session.defaultSession.cookies.remove(`${AIPRI_BASE_URL}/mypage/`, cookie.name);
      }

      // Parse and set new cookies
      if (cookieString) {
        const cookies = cookieString.split(';').map(c => c.trim()).filter(c => c);
        for (const cookie of cookies) {
          const [name, ...valueParts] = cookie.split('=');
          const value = valueParts.join('=');
          if (name && value) {
            // Set cookie for both paths
            await session.defaultSession.cookies.set({
              url: AIPRI_BASE_URL,
              name: name.trim(),
              value: value.trim(),
              path: '/'
            });
            await session.defaultSession.cookies.set({
              url: `${AIPRI_BASE_URL}/mypage/`,
              name: name.trim(),
              value: value.trim(),
              path: '/mypage/'
            });
          }
        }
      }
    } catch (err) {
      console.error('Error setting aipri session cookies:', err);
    }
  };

  /**
   * Download and save profile image locally
   * @param {string} imageUrl
   * @param {string} accountName
   * @param {string} [sessionCookie] - Optional session cookie for authenticated download
   * @returns {Promise<string | null>}
   */
  const downloadAndSaveProfileImage = async (imageUrl, accountName, sessionCookie) => {
    console.log('[Profile Image] Downloading for account:', accountName, 'URL:', imageUrl);
    try {
      // Set session cookies for this account
      await setAipriSessionCookies(sessionCookie || '');

      const response = await net.fetch(imageUrl, {
        headers: { 'User-Agent': AIPRI_USER_AGENT }
      });

      if (!response.ok) {
        console.error('Failed to download profile image:', response.status);
        return null;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      // Sanitize account name for filename
      const safeAccountName = accountName.replace(/[<>:"/\\|?*]/g, '_');
      const filename = `${safeAccountName}.jpg`;
      const filePath = path.join(profileImagesDir, filename);
      console.log('[Profile Image] Saving to:', filePath, 'Buffer size:', buffer.length);
      fs.writeFileSync(filePath, buffer);
      return filePath;
    } catch (error) {
      console.error('Error downloading profile image:', error);
      return null;
    }
  };

  /**
   * Perform login and return cookies
   * @param {{cardId: string, name: string, birthdayM: string, birthdayD: string}} credentials
   * @returns {Promise<{success: boolean, cookies?: string, profileImageUrl?: string, error?: string}>}
   */
  const performLogin = async (credentials) => {
    const { cardId, name, birthdayM, birthdayD } = credentials;

    try {
      // Clear existing aipri.jp cookies to prevent session contamination
      const existingCookies = await session.defaultSession.cookies.get({ url: AIPRI_BASE_URL });
      for (const cookie of existingCookies) {
        await session.defaultSession.cookies.remove(AIPRI_BASE_URL, cookie.name);
      }
      const mypageCookies = await session.defaultSession.cookies.get({ url: `${AIPRI_BASE_URL}/mypage/` });
      for (const cookie of mypageCookies) {
        await session.defaultSession.cookies.remove(`${AIPRI_BASE_URL}/mypage/`, cookie.name);
      }

      // Build form data
      const formData = new URLSearchParams();
      formData.append('val[card_id]', cardId);
      formData.append('val[name]', name);
      formData.append('val[birthdayM]', birthdayM);
      formData.append('val[birthdayD]', birthdayD);

      const loginUrl = `${AIPRI_BASE_URL}/mypage/login`;

      // Make login request - follow redirects automatically
      const response = await net.fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': AIPRI_USER_AGENT,
          'Referer': loginUrl,
          'Origin': AIPRI_BASE_URL
        },
        body: formData.toString(),
        redirect: 'follow',
        credentials: 'include',
        bypassCustomProtocolHandlers: true
      });

      // Get cookies from response
      const setCookies = response.headers.getSetCookie();
      let cookies = parseCookies(setCookies);

      // If no cookies in headers (due to redirect:follow), get from session
      if (!cookies) {
        try {
          // Get cookies for both root and /mypage/ path (MYPAPSSID has path=/mypage/)
          const rootCookies = await session.defaultSession.cookies.get({ url: AIPRI_BASE_URL });
          const mypageCookies = await session.defaultSession.cookies.get({ url: `${AIPRI_BASE_URL}/mypage/` });

          // Combine and dedupe cookies
          const allCookies = [...rootCookies, ...mypageCookies];
          const uniqueCookies = allCookies.filter((cookie, index, self) =>
            index === self.findIndex(c => c.name === cookie.name)
          );

          cookies = uniqueCookies
            .map(c => `${c.name}=${c.value}`)
            .join('; ');
        } catch (err) {
          console.error('Error getting cookies from session:', err);
        }
      }

      // Check the final URL to determine if login succeeded
      const finalUrl = response.url;

      if (!response.ok) {
        return { success: false, error: `サーバーエラー (${response.status})` };
      }

      const html = await response.text();

      // Check if we're still on the login page (login failed)
      if (finalUrl.includes('/login') || html.includes('id="loginForm"') || html.includes('ログインフォーム')) {
        return { success: false, error: 'ログインに失敗しました。入力情報を確認してください。' };
      }

      // Fetch mypage explicitly with the obtained cookies to get correct profile image
      // This ensures we get profile image for THIS account, not a cached session
      let profileImageUrl = null;
      if (cookies) {
        try {
          console.log('[Profile Image] Fetching mypage with explicit cookies for:', name);
          // Set session cookies for this account
          await setAipriSessionCookies(cookies);

          const mypageResponse = await net.fetch(`${AIPRI_BASE_URL}/mypage`, {
            headers: {
              'User-Agent': AIPRI_USER_AGENT
            },
            redirect: 'follow'
          });

          console.log('[Profile Image] Mypage response:', mypageResponse.status, 'Final URL:', mypageResponse.url);

          if (mypageResponse.ok) {
            const mypageHtml = await mypageResponse.text();
            // Check if we got redirected to login page
            if (mypageResponse.url.includes('/login')) {
              console.log('[Profile Image] Redirected to login, falling back to login HTML');
              profileImageUrl = extractProfileImage(html);
            } else {
              profileImageUrl = extractProfileImage(mypageHtml);
            }
            console.log('[Profile Image] Extracted URL:', profileImageUrl);
          }
        } catch (err) {
          console.error('Error fetching mypage for profile image:', err);
          // Fallback to login response HTML
          profileImageUrl = extractProfileImage(html);
        }
      } else {
        profileImageUrl = extractProfileImage(html);
      }

      return {
        success: true,
        cookies: cookies || '',
        profileImageUrl: profileImageUrl || undefined
      };
    } catch (error) {
      console.error('Aipri login error:', error);
      return { success: false, error: `通信エラー: ${String(error)}` };
    }
  };

  // ===== Multi-Account Handlers =====

  // Get all accounts
  ipcMain.handle('aipri-get-accounts', async () => {
    const accounts = store?.get('aipriAccounts') || [];
    const activeAccountName = store?.get('aipriActiveAccountName') || null;
    return { accounts, activeAccountName };
  });

  // Add new account (login + save)
  ipcMain.handle('aipri-add-account', async (event, credentials) => {
    const { name } = credentials;

    // Check for duplicate name
    const accounts = store?.get('aipriAccounts') || [];
    if (accounts.some(acc => acc.name === name)) {
      return { success: false, error: 'この名前のアカウントは既に登録されています' };
    }

    // Perform login
    const loginResult = await performLogin(credentials);
    if (!loginResult.success) {
      return { success: false, error: loginResult.error };
    }

    // Download and save profile image
    let profileImagePath = null;
    if (loginResult.profileImageUrl) {
      profileImagePath = await downloadAndSaveProfileImage(loginResult.profileImageUrl, name);
    }

    // Create account object
    /** @type {{name: string, cardId: string, birthdayM: string, birthdayD: string, sessionCookie: string | null, profileImagePath: string | null}} */
    const newAccount = {
      name: credentials.name,
      cardId: credentials.cardId,
      birthdayM: credentials.birthdayM,
      birthdayD: credentials.birthdayD,
      sessionCookie: loginResult.cookies || null,
      profileImagePath
    };

    // Add to accounts and set as active
    const updatedAccounts = [...accounts, newAccount];
    store?.set('aipriAccounts', updatedAccounts);
    store?.set('aipriActiveAccountName', name);

    return { success: true, profileImagePath };
  });

  // Remove account
  ipcMain.handle('aipri-remove-account', async (event, name) => {
    const accounts = store?.get('aipriAccounts') || [];
    const activeAccountName = store?.get('aipriActiveAccountName');

    // Find account to remove
    const accountToRemove = accounts.find(acc => acc.name === name);
    if (!accountToRemove) {
      return { success: false };
    }

    // Delete profile image if exists
    if (accountToRemove.profileImagePath && fs.existsSync(accountToRemove.profileImagePath)) {
      try {
        fs.unlinkSync(accountToRemove.profileImagePath);
      } catch (err) {
        console.error('Error deleting profile image:', err);
      }
    }

    // Remove from accounts
    const updatedAccounts = accounts.filter(acc => acc.name !== name);
    store?.set('aipriAccounts', updatedAccounts);

    // If removed account was active, switch to first remaining or null
    if (activeAccountName === name) {
      const newActive = updatedAccounts.length > 0 ? updatedAccounts[0].name : null;
      store?.set('aipriActiveAccountName', newActive);
    }

    return { success: true };
  });

  // Switch active account
  ipcMain.handle('aipri-switch-account', async (event, name) => {
    const accounts = store?.get('aipriAccounts') || [];
    const account = accounts.find(acc => acc.name === name);

    if (!account) {
      return { success: false, error: 'アカウントが見つかりません' };
    }

    // Set as active
    store?.set('aipriActiveAccountName', name);

    // Check if session is valid
    if (!account.sessionCookie || !account.sessionCookie.includes('MYPAPSSID=')) {
      // No session, try to re-login
      const loginResult = await performLogin({
        cardId: account.cardId,
        name: account.name,
        birthdayM: account.birthdayM,
        birthdayD: account.birthdayD
      });

      if (!loginResult.success) {
        return { success: false, error: loginResult.error };
      }

      // Update account with new session
      let profileImagePath = account.profileImagePath;
      if (loginResult.profileImageUrl) {
        profileImagePath = await downloadAndSaveProfileImage(loginResult.profileImageUrl, name);
      }

      const updatedAccounts = accounts.map(acc =>
        acc.name === name
          ? { ...acc, sessionCookie: loginResult.cookies || null, profileImagePath }
          : acc
      );
      store?.set('aipriAccounts', updatedAccounts);

      return { success: true, reloggedIn: true, profileImageUrl: loginResult.profileImageUrl };
    }

    // Verify existing session
    try {
      // Set session cookies for this account
      await setAipriSessionCookies(account.sessionCookie);

      const response = await net.fetch(`${AIPRI_BASE_URL}/mypage`, {
        headers: {
          'User-Agent': AIPRI_USER_AGENT
        },
        redirect: 'follow'
      });

      const finalUrl = response.url;

      if (finalUrl.includes('/mypage/login') || finalUrl.includes('/login')) {
        // Session expired, try to re-login
        const loginResult = await performLogin({
          cardId: account.cardId,
          name: account.name,
          birthdayM: account.birthdayM,
          birthdayD: account.birthdayD
        });

        if (!loginResult.success) {
          return { success: false, error: loginResult.error };
        }

        // Update account with new session
        let profileImagePath = account.profileImagePath;
        if (loginResult.profileImageUrl) {
          profileImagePath = await downloadAndSaveProfileImage(loginResult.profileImageUrl, name);
        }

        const updatedAccounts = accounts.map(acc =>
          acc.name === name
            ? { ...acc, sessionCookie: loginResult.cookies || null, profileImagePath }
            : acc
        );
        store?.set('aipriAccounts', updatedAccounts);

        return { success: true, reloggedIn: true, profileImageUrl: loginResult.profileImageUrl };
      }

      if (response.ok) {
        const html = await response.text();
        const profileImageUrl = extractProfileImage(html);

        // Update profile image if we got a new one
        // Use the account's session cookie for downloading, not the global session
        if (profileImageUrl) {
          const profileImagePath = await downloadAndSaveProfileImage(profileImageUrl, name, account.sessionCookie);
          if (profileImagePath) {
            const updatedAccounts = accounts.map(acc =>
              acc.name === name ? { ...acc, profileImagePath } : acc
            );
            store?.set('aipriAccounts', updatedAccounts);
          }
        }

        return { success: true, profileImageUrl };
      }

      return { success: false, error: `予期しないレスポンス (${response.status})` };
    } catch (error) {
      console.error('Switch account error:', error);
      return { success: false, error: `通信エラー: ${String(error)}` };
    }
  });

  // ===== Legacy Handlers (for backward compatibility) =====

  // Aipri Login Handler (now adds account if new, switches if existing)
  ipcMain.handle('aipri-login', async (event, credentials) => {
    const { name } = credentials;
    const accounts = store?.get('aipriAccounts') || [];

    // Check if account already exists
    const existingAccount = accounts.find(acc => acc.name === name);
    if (existingAccount) {
      // Account exists - switch to it (which will re-login if needed)
      store?.set('aipriActiveAccountName', name);

      // Check if session is still valid or re-login
      if (!existingAccount.sessionCookie || !existingAccount.sessionCookie.includes('MYPAPSSID=')) {
        // Re-login
        const loginResult = await performLogin(credentials);
        if (!loginResult.success) {
          return { success: false, error: loginResult.error };
        }

        // Update account with new session
        let profileImagePath = existingAccount.profileImagePath;
        if (loginResult.profileImageUrl) {
          profileImagePath = await downloadAndSaveProfileImage(loginResult.profileImageUrl, name);
        }

        const updatedAccounts = accounts.map(acc =>
          acc.name === name
            ? { ...acc, sessionCookie: loginResult.cookies || null, profileImagePath }
            : acc
        );
        store?.set('aipriAccounts', updatedAccounts);

        return {
          success: true,
          profileImageUrl: profileImagePath
            ? `local-image://${encodeURIComponent(profileImagePath)}`
            : loginResult.profileImageUrl
        };
      }

      // Session exists, return existing profile image
      return {
        success: true,
        profileImageUrl: existingAccount.profileImagePath
          ? `local-image://${encodeURIComponent(existingAccount.profileImagePath)}`
          : null
      };
    }

    // New account - perform login and add
    const loginResult = await performLogin(credentials);
    if (!loginResult.success) {
      return { success: false, error: loginResult.error };
    }

    // Download and save profile image
    let profileImagePath = null;
    if (loginResult.profileImageUrl) {
      profileImagePath = await downloadAndSaveProfileImage(loginResult.profileImageUrl, name);
    }

    // Create account
    /** @type {{name: string, cardId: string, birthdayM: string, birthdayD: string, sessionCookie: string | null, profileImagePath: string | null}} */
    const newAccount = {
      name: credentials.name,
      cardId: credentials.cardId,
      birthdayM: credentials.birthdayM,
      birthdayD: credentials.birthdayD,
      sessionCookie: loginResult.cookies || null,
      profileImagePath
    };

    store?.set('aipriAccounts', [...accounts, newAccount]);
    store?.set('aipriActiveAccountName', name);

    return {
      success: true,
      profileImageUrl: profileImagePath
        ? `local-image://${encodeURIComponent(profileImagePath)}`
        : loginResult.profileImageUrl
    };
  });

  // Check if session is still valid (uses active account)
  ipcMain.handle('aipri-check-session', async () => {
    const activeAccountName = store?.get('aipriActiveAccountName');
    if (!activeAccountName) {
      return { valid: false, reason: 'アクティブなアカウントがありません' };
    }

    const accounts = store?.get('aipriAccounts') || [];
    const account = accounts.find(acc => acc.name === activeAccountName);
    if (!account) {
      return { valid: false, reason: 'アカウントが見つかりません' };
    }

    const sessionCookies = account.sessionCookie;
    if (!sessionCookies) {
      return { valid: false, reason: 'セッションがありません' };
    }

    // Check if MYPAPSSID cookie exists
    if (!sessionCookies.includes('MYPAPSSID=')) {
      return { valid: false, reason: 'セッションCookieが無効です' };
    }

    try {
      // Set session cookies for this account
      await setAipriSessionCookies(sessionCookies);

      // Try to access mypage to check if session is valid
      const response = await net.fetch(`${AIPRI_BASE_URL}/mypage`, {
        headers: {
          'User-Agent': AIPRI_USER_AGENT
        },
        redirect: 'follow'
      });

      // Check final URL - if we ended up at login page, session is expired
      const finalUrl = response.url;

      if (finalUrl.includes('/mypage/login') || finalUrl.includes('/login')) {
        return { valid: false, reason: 'セッションが期限切れです' };
      }

      if (response.ok) {
        const html = await response.text();
        const profileImageUrl = extractProfileImage(html);

        // Return local image path if available
        const localImageUrl = account.profileImagePath
          ? `local-image://${encodeURIComponent(account.profileImagePath)}`
          : profileImageUrl;

        return { valid: true, profileImageUrl: localImageUrl };
      }

      return { valid: false, reason: `予期しないレスポンス (${response.status})` };
    } catch (error) {
      console.error('Session check error:', error);
      return { valid: false, reason: `通信エラー: ${String(error)}` };
    }
  });

  // Clear session (clears all accounts)
  ipcMain.handle('aipri-clear-session', async () => {
    // Delete all profile images
    const accounts = store?.get('aipriAccounts') || [];
    for (const account of accounts) {
      if (account.profileImagePath && fs.existsSync(account.profileImagePath)) {
        try {
          fs.unlinkSync(account.profileImagePath);
        } catch (err) {
          console.error('Error deleting profile image:', err);
        }
      }
    }

    store?.set('aipriAccounts', []);
    store?.set('aipriActiveAccountName', null);
    return { success: true };
  });

  // Fetch photos from myphoto-list API (uses active account)
  ipcMain.handle('aipri-fetch-photos', async (event, targetYm) => {
    const sessionCookies = getActiveSessionCookie();

    if (!sessionCookies) {
      return { success: false, error: 'セッションがありません。ログインしてください。' };
    }

    try {
      // Set session cookies for this account
      await setAipriSessionCookies(sessionCookies);

      const formData = new URLSearchParams();
      formData.append('target_ym', targetYm);
      formData.append('data_count', '999');

      const response = await net.fetch(`${AIPRI_BASE_URL}/mypage/api/myphoto-list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': AIPRI_USER_AGENT
        },
        body: formData.toString()
      });

      if (!response.ok) {
        return { success: false, error: `APIエラー (${response.status})` };
      }

      const result = await response.json();

      if (result.code !== '00') {
        return { success: false, error: result.message || 'APIエラーが発生しました' };
      }

      return {
        success: true,
        photos: result.data?.photo_list || []
      };
    } catch (error) {
      console.error('Fetch photos error:', error);
      return { success: false, error: `通信エラー: ${String(error)}` };
    }
  });

  // Download a single photo and save to folder
  ipcMain.handle('aipri-download-photo', async (event, url, filename, folderPath) => {
    if (!url || !filename || !folderPath) {
      return { success: false, error: '無効なパラメータです' };
    }

    const targetPath = path.join(folderPath, filename);

    // Check if file already exists
    if (fs.existsSync(targetPath)) {
      return { success: true, skipped: true };
    }

    // Get active account's session cookie
    const sessionCookies = getActiveSessionCookie();

    try {
      // Set session cookies for this account
      await setAipriSessionCookies(sessionCookies || '');

      const response = await net.fetch(url, {
        headers: { 'User-Agent': AIPRI_USER_AGENT }
      });

      if (!response.ok) {
        return { success: false, error: `ダウンロードエラー (${response.status})` };
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(targetPath, buffer);

      return { success: true, skipped: false };
    } catch (error) {
      console.error('Download photo error:', error);
      return { success: false, error: `ダウンロードエラー: ${String(error)}` };
    }
  });

  // Show confirmation dialog
  ipcMain.handle('show-confirm-dialog', async (event, options) => {
    const { title, message, okLabel, cancelLabel } = options;
    const dialogOptions = {
      type: /** @type {const} */ ('warning'),
      title: title || '確認',
      message: message || '',
      buttons: [cancelLabel || 'キャンセル', okLabel || 'OK'],
      defaultId: 0,
      cancelId: 0
    };
    const result = mainWindow
      ? dialog.showMessageBoxSync(mainWindow, dialogOptions)
      : dialog.showMessageBoxSync(dialogOptions);
    // Returns 0 for cancel (first button), 1 for ok (second button)
    return result === 1;
  });
}

// カスタムプロトコルの登録（appのreadyイベント前に呼ぶ必要がある）
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-image',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true
    }
  }
]);

app.once('ready', async () => {
  // カスタムプロトコルハンドラーを登録
  protocol.handle('local-image', (request) => {
    // Strip query parameters and decode file path
    const urlWithoutProtocol = request.url.replace('local-image://', '');
    const urlWithoutQuery = urlWithoutProtocol.split('?')[0];
    const filePath = decodeURIComponent(urlWithoutQuery);
    return net.fetch(pathToFileURL(filePath).toString());
  });

  await initStore();
  setupIpcHandlers();
  createMainWindow();
});

app.on('activate', () => {
  if (!mainWindow) {
    createMainWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('to-main', (event, count) => {
  if (!mainWindow) return;
  return mainWindow.webContents.send('from-main', `next count is ${count + 1}`);
});

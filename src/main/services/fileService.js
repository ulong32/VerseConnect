import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { fileURLToPath } from 'url';

// 画像ファイルの拡張子
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico'];

/**
 * ファイル名から日付と連番を抽出
 * Pattern: aipriverse_album_YYYYMMDD_N.ext or aipriverse_album_YYYYMM-DD_N.ext
 * @param {string} filename
 * @returns {{ date: string | null, serial: number | null }}
 */
export const parseFilename = (filename) => {
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

/**
 * メタデータファイルのパスを取得
 * @param {string} folderPath 
 */
const getMetadataFilePath = (folderPath) => {
  return path.join(folderPath, '.image_metadata.json');
};

/**
 * フォルダ内の全メタデータを読み込む
 * @param {string} folderPath 
 */
export const loadFolderMetadata = (folderPath) => {
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

/**
 * フォルダ内の全メタデータを保存
 * @param {string} folderPath
 * @param {Object} metadata
 */
export const saveFolderMetadata = (folderPath, metadata) => {
  const metadataPath = getMetadataFilePath(folderPath);
  try {
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing metadata file:', error);
    return false;
  }
};

/**
 * 再帰的にフォルダを走査して画像を収集
 * @param {string} folderPath - スキャンするルートパス
 * @returns {Array<{name: string, path: string, url: string, metadata: object|null, folder: string, extractedDate: string|null, serial: number|null}>} 画像情報の配列
 */
export const scanFolder = (folderPath) => {
  if (!folderPath || !fs.existsSync(folderPath)) {
    return [];
  }

  const scan = (currentPath, relativePath = '') => {
    /** @type {Array<any>} */
    const images = [];

    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });

      // Load metadata for current folder
      const folderMetadata = loadFolderMetadata(currentPath);

      for (const entry of entries) {
        const entryPath = path.join(currentPath, entry.name);

        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'friend_card') {
          // 再帰的にサブフォルダを走査（friend_cardは除外）
          const subRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
          images.push(...scan(entryPath, subRelativePath));
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (IMAGE_EXTENSIONS.includes(ext)) {
            // Extract date and serial from filename
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
    return scan(folderPath);
  } catch (error) {
    console.error('Error reading folder:', error);
    return [];
  }
};

export const extractZip = (zipPath, targetFolder) => {
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
};

export const saveFriendCard = (folderPath, filename, base64Data) => {
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
};

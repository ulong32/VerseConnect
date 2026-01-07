import { app } from 'electron';
import path from 'path';
import fs from 'fs';

/** @type {import('electron-store').default<{folderPath: string, customCharacters: string[], customTags: string[], aipriAccounts: Array<{name: string, cardId: string, birthdayM: string, birthdayD: string, sessionCookie: string | null, profileImagePath: string | null}>, aipriActiveAccountName: string | null}> | undefined} */
let store;

export async function initStore() {
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
  const profileImagesDir = path.join(app.getPath('userData'), 'profile_images');
  if (!fs.existsSync(profileImagesDir)) {
    fs.mkdirSync(profileImagesDir, { recursive: true });
  }
}

export function getStore() {
  if (!store) {
    throw new Error('Store not initialized. Call initStore() first.');
  }
  return store;
}

export function getProfileImagesDir() {
  return path.join(app.getPath('userData'), 'profile_images');
}

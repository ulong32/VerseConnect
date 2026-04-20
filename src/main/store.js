import { app } from "electron";
import fs from "fs";
import path from "path";

/** @type {import('electron-store').default<{folderPath: string, itemImageFolderPath: string, customCharacters: string[], customTags: string[], aipriAccounts: Array<{accountId?: string, name: string, cardId: string, birthdayM: string, birthdayD: string, sessionCookie: string | null, profileImagePath: string | null}>, aipriActiveAccountId: string | null, aipriActiveAccountName: string | null}> | undefined} */
let store;

export async function initStore() {
  const Store = (await import("electron-store")).default;
  // @ts-expect-error
  store = new Store({
    defaults: {
      folderPath: "",
      itemImageFolderPath: "",
      customCharacters: [],
      customTags: [],
      aipriAccounts: [], // Array of AipriAccount
      aipriActiveAccountId: null, // Currently active account id
      aipriActiveAccountName: null, // Currently active account name
    },
  });

  // Initialize profile images directory
  const profileImagesDir = path.join(app.getPath("userData"), "profile_images");
  if (!fs.existsSync(profileImagesDir)) {
    fs.mkdirSync(profileImagesDir, { recursive: true });
  }
}

export function getStore() {
  if (!store) {
    throw new Error("Store not initialized. Call initStore() first.");
  }
  return store;
}

export function getProfileImagesDir() {
  return path.join(app.getPath("userData"), "profile_images");
}

import { randomUUID } from "crypto";
import { ipcMain } from "electron";
import fs from "fs";
import * as aipriService from "../services/aipriService.js";
import { getStore } from "../store.js";

/** @param {string | null | undefined} cookieString */
const summarizeCookieString = (cookieString) => {
  if (!cookieString) return "(empty)";
  const names = cookieString
    .split(";")
    .map((/** @type {string} */ part) => part.trim())
    .filter(Boolean)
    .map((/** @type {string} */ pair) => pair.split("=")[0])
    .filter(Boolean);
  const uniqueNames = [...new Set(names)];
  return `${uniqueNames.join(",")} (parts=${names.length})`;
};

/** @param {string | null | undefined} cookieString */
const hasRequiredSessionCookies = (cookieString) =>
  Boolean(
    cookieString && cookieString.includes("PHPSESSID=") && cookieString.includes("MYPAPSSID="),
  );

/** @param {string | null | undefined} profileImagePath */
const toLocalImageUrl = (profileImagePath) =>
  profileImagePath ? `local-image://${encodeURIComponent(profileImagePath)}` : null;

/**
 * @typedef {{
 *   accountId?: string,
 *   name: string,
 *   cardId: string,
 *   birthdayM: string,
 *   birthdayD: string,
 *   sessionCookie: string | null,
 *   profileImagePath: string | null
 * }} AipriAccount
 */

/**
 * @typedef {{
 *   folderPath: string,
 *   itemImageFolderPath: string,
 *   customCharacters: string[],
 *   customTags: string[],
 *   aipriAccounts: AipriAccount[],
 *   aipriActiveAccountId: string | null,
 *   aipriActiveAccountName: string | null
 * }} StoreSchema
 */

/**
 * Ensure account IDs exist and active account fields are consistent.
 * @param {import('electron-store').default<StoreSchema>} store
 */
function normalizeAipriStore(store) {
  const rawAccounts = /** @type {AipriAccount[]} */ (store.get("aipriAccounts") || []);
  let accountsChanged = false;
  const accounts = rawAccounts.map((account) => {
    if (account.accountId) return account;
    accountsChanged = true;
    return { ...account, accountId: randomUUID() };
  });

  let activeAccountId = store.get("aipriActiveAccountId") || null;
  const activeAccountName = store.get("aipriActiveAccountName") || null;
  if (!activeAccountId && activeAccountName) {
    activeAccountId =
      accounts.find((account) => account.name === activeAccountName)?.accountId || null;
  }

  if (activeAccountId && !accounts.some((account) => account.accountId === activeAccountId)) {
    activeAccountId = null;
  }

  const activeAccount = activeAccountId
    ? accounts.find((account) => account.accountId === activeAccountId)
    : null;
  const resolvedActiveName = activeAccount?.name || null;

  if (accountsChanged) {
    store.set("aipriAccounts", accounts);
  }
  if ((store.get("aipriActiveAccountId") || null) !== activeAccountId) {
    store.set("aipriActiveAccountId", activeAccountId);
  }
  if ((store.get("aipriActiveAccountName") || null) !== resolvedActiveName) {
    store.set("aipriActiveAccountName", resolvedActiveName);
  }

  return {
    accounts,
    activeAccountId,
    activeAccountName: resolvedActiveName,
  };
}

/**
 * @param {import('electron-store').default<StoreSchema>} store
 * @param {AipriAccount[]} accounts
 * @param {string | null} activeAccountId
 */
function persistAipriStore(store, accounts, activeAccountId) {
  const resolvedActiveAccountId =
    activeAccountId && accounts.some((account) => account.accountId === activeAccountId)
      ? activeAccountId
      : null;
  const resolvedActiveAccountName = resolvedActiveAccountId
    ? accounts.find((account) => account.accountId === resolvedActiveAccountId)?.name || null
    : null;

  store.set("aipriAccounts", accounts);
  store.set("aipriActiveAccountId", resolvedActiveAccountId);
  store.set("aipriActiveAccountName", resolvedActiveAccountName);

  return {
    activeAccountId: resolvedActiveAccountId,
    activeAccountName: resolvedActiveAccountName,
  };
}

/**
 * @param {AipriAccount[]} accounts
 * @param {string} accountIdOrName
 */
function findAccountByIdOrName(accounts, accountIdOrName) {
  return accounts.find(
    (account) => account.accountId === accountIdOrName || account.name === accountIdOrName,
  );
}

export function setupAipriHandlers() {
  // ===== Multi-Account Handlers =====

  // Get all accounts
  ipcMain.handle("aipri-get-accounts", async () => {
    const store = getStore();
    const { accounts, activeAccountId, activeAccountName } = normalizeAipriStore(store);
    return { accounts, activeAccountId, activeAccountName };
  });

  // Add new account (login + save)
  ipcMain.handle("aipri-add-account", async (event, credentials) => {
    const store = getStore();
    const { name } = credentials;
    const { accounts } = normalizeAipriStore(store);

    // Check for duplicate cardId
    if (accounts.some((account) => account.cardId === credentials.cardId)) {
      return { success: false, error: "このセーブカードIDのアカウントは既に登録されています" };
    }

    // Perform login
    const loginResult = await aipriService.performLogin(credentials);
    if (!loginResult.success) {
      return { success: false, error: loginResult.error };
    }

    // Download and save profile image
    let profileImagePath = null;
    if (loginResult.profileImageUrl) {
      profileImagePath = await aipriService.downloadAndSaveProfileImage(
        loginResult.profileImageUrl,
        name,
        loginResult.cookies || "",
      );
    }

    // Create account object
    const newAccount = {
      accountId: randomUUID(),
      name: credentials.name,
      cardId: credentials.cardId,
      birthdayM: credentials.birthdayM,
      birthdayD: credentials.birthdayD,
      sessionCookie: loginResult.cookies || null,
      profileImagePath,
    };
    console.log(
      "[Aipri Debug] add-account save:",
      name,
      summarizeCookieString(newAccount.sessionCookie),
    );

    // Add to accounts and set as active
    const updatedAccounts = [...accounts, newAccount];
    persistAipriStore(store, updatedAccounts, newAccount.accountId || null);

    return { success: true, accountId: newAccount.accountId, profileImagePath };
  });

  // Remove account
  ipcMain.handle("aipri-remove-account", async (event, accountIdOrName) => {
    const store = getStore();
    const { accounts, activeAccountId } = normalizeAipriStore(store);

    // Find account to remove
    const accountToRemove = findAccountByIdOrName(accounts, accountIdOrName);
    if (!accountToRemove) {
      return { success: false };
    }

    // Delete profile image if exists
    if (accountToRemove.profileImagePath && fs.existsSync(accountToRemove.profileImagePath)) {
      try {
        fs.unlinkSync(accountToRemove.profileImagePath);
      } catch (err) {
        console.error("Error deleting profile image:", err);
      }
    }

    // Remove from accounts
    const updatedAccounts = accounts.filter(
      (account) => account.accountId !== accountToRemove.accountId,
    );

    // If removed account was active, switch to first remaining or null
    const newActiveAccountId =
      activeAccountId === accountToRemove.accountId
        ? updatedAccounts[0]?.accountId || null
        : activeAccountId;
    persistAipriStore(store, updatedAccounts, newActiveAccountId || null);

    return { success: true };
  });

  // Update account credentials (re-login with new credentials)
  ipcMain.handle("aipri-update-account", async (event, accountIdOrName, credentials) => {
    const store = getStore();
    const { accounts, activeAccountId } = normalizeAipriStore(store);

    // Find the account to update
    const accountIndex = accounts.findIndex(
      (account) => account.accountId === accountIdOrName || account.name === accountIdOrName,
    );
    if (accountIndex === -1) {
      return { success: false, error: "アカウントが見つかりません" };
    }

    const oldAccount = accounts[accountIndex];

    // Check if new cardId conflicts with existing account (if cardId changed)
    if (credentials.cardId !== oldAccount.cardId) {
      if (
        accounts.some(
          (account) =>
            account.cardId === credentials.cardId && account.accountId !== oldAccount.accountId,
        )
      ) {
        return { success: false, error: "このセーブカードIDのアカウントは既に登録されています" };
      }
    }

    // Perform login with new credentials to verify they work
    const loginResult = await aipriService.performLogin(credentials);
    if (!loginResult.success) {
      return { success: false, error: loginResult.error };
    }

    // Delete old profile image if exists
    if (oldAccount.profileImagePath && fs.existsSync(oldAccount.profileImagePath)) {
      try {
        fs.unlinkSync(oldAccount.profileImagePath);
      } catch (err) {
        console.error("Error deleting old profile image:", err);
      }
    }

    // Download and save new profile image
    let profileImagePath = null;
    if (loginResult.profileImageUrl) {
      profileImagePath = await aipriService.downloadAndSaveProfileImage(
        loginResult.profileImageUrl,
        credentials.name,
        loginResult.cookies || "",
      );
    }

    // Create updated account object
    const updatedAccount = {
      accountId: oldAccount.accountId || randomUUID(),
      name: credentials.name,
      cardId: credentials.cardId,
      birthdayM: credentials.birthdayM,
      birthdayD: credentials.birthdayD,
      sessionCookie: loginResult.cookies || null,
      profileImagePath,
    };
    console.log(
      "[Aipri Debug] update-account save:",
      credentials.name,
      summarizeCookieString(updatedAccount.sessionCookie),
    );

    // Update accounts array
    const updatedAccounts = [...accounts];
    updatedAccounts[accountIndex] = updatedAccount;

    const nextActiveAccountId = activeAccountId;
    persistAipriStore(store, updatedAccounts, nextActiveAccountId);

    return {
      success: true,
      accountId: updatedAccount.accountId,
      profileImagePath,
    };
  });

  // Switch active account
  ipcMain.handle("aipri-switch-account", async (event, accountIdOrName) => {
    const store = getStore();
    const { accounts } = normalizeAipriStore(store);
    const account = findAccountByIdOrName(accounts, accountIdOrName);

    if (!account || !account.accountId) {
      return { success: false, error: "アカウントが見つかりません" };
    }

    // Always perform fresh login to ensure valid session for API calls
    // (verifySession checking /mypage doesn't guarantee API session validity)
    const reloginResult = await performLoginAndUpdateAccount(
      store,
      account,
      accounts,
      account.accountId,
    );
    if (!reloginResult.success) {
      return reloginResult;
    }

    return {
      ...reloginResult,
      activeAccountId: account.accountId,
    };
  });

  /**
   * Helper to perform login and update account in store
   * @param {import('electron-store').default<StoreSchema>} store
   * @param {AipriAccount} account
   * @param {AipriAccount[]} accounts
   * @param {string | null} nextActiveAccountId
   */
  async function performLoginAndUpdateAccount(store, account, accounts, nextActiveAccountId) {
    const loginResult = await aipriService.performLogin({
      cardId: account.cardId,
      name: account.name,
      birthdayM: account.birthdayM,
      birthdayD: account.birthdayD,
    });

    if (!loginResult.success) {
      return { success: false, error: loginResult.error };
    }

    // Update account with new session
    let profileImagePath = account.profileImagePath;
    if (loginResult.profileImageUrl) {
      profileImagePath = await aipriService.downloadAndSaveProfileImage(
        loginResult.profileImageUrl,
        account.name,
        loginResult.cookies || "",
      );
    }

    const updatedAccounts = accounts.map((acc) =>
      acc.accountId === account.accountId
        ? { ...acc, sessionCookie: loginResult.cookies || null, profileImagePath }
        : acc,
    );
    console.log(
      "[Aipri Debug] switch/relogin save:",
      account.name,
      summarizeCookieString(loginResult.cookies || null),
    );
    persistAipriStore(store, updatedAccounts, nextActiveAccountId);

    const profileImageUrl =
      toLocalImageUrl(profileImagePath) || loginResult.profileImageUrl || null;

    return { success: true, reloggedIn: true, profileImageUrl };
  }

  // Check if session is still valid (uses active account)
  ipcMain.handle("aipri-check-session", async () => {
    const store = getStore();
    const { accounts, activeAccountId } = normalizeAipriStore(store);
    if (!activeAccountId) {
      return { valid: false, reason: "アクティブなアカウントがありません" };
    }

    const account = accounts.find((candidate) => candidate.accountId === activeAccountId);
    if (!account) {
      return { valid: false, reason: "アカウントが見つかりません" };
    }

    const sessionCookies = account.sessionCookie;
    if (!hasRequiredSessionCookies(sessionCookies)) {
      return { valid: false, reason: "セッションがありません/無効です" };
    }

    const verifyResult = await aipriService.verifySession(sessionCookies || "");
    if (verifyResult.valid) {
      // Return local image path if available
      const localImageUrl =
        toLocalImageUrl(account.profileImagePath) || verifyResult.profileImageUrl;
      return { valid: true, profileImageUrl: localImageUrl };
    }

    return verifyResult;
  });

  // Clear session (clears all accounts)
  ipcMain.handle("aipri-clear-session", async () => {
    const store = getStore();
    const { accounts } = normalizeAipriStore(store);
    for (const account of accounts) {
      if (account.profileImagePath && fs.existsSync(account.profileImagePath)) {
        try {
          fs.unlinkSync(account.profileImagePath);
        } catch (err) {
          console.error("Error deleting profile image:", err);
        }
      }
    }

    persistAipriStore(store, [], null);
    return { success: true };
  });

  // Fetch photos from myphoto-list API (uses active account)
  ipcMain.handle("aipri-fetch-photos", async (event, targetYm) => {
    return aipriService.fetchPhotos(targetYm);
  });

  // Download a single photo and save to folder
  ipcMain.handle("aipri-download-photo", async (event, url, filename, folderPath) => {
    return aipriService.downloadPhoto(url, filename, folderPath);
  });
}

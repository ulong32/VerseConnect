import { ipcMain } from 'electron';
import fs from 'fs';
import * as aipriService from '../services/aipriService.js';
import { getStore } from '../store.js';

export function setupAipriHandlers() {
  // ===== Multi-Account Handlers =====

  // Get all accounts
  ipcMain.handle('aipri-get-accounts', async () => {
    const store = getStore();
    const accounts = store.get('aipriAccounts') || [];
    const activeAccountName = store.get('aipriActiveAccountName') || null;
    return { accounts, activeAccountName };
  });

  // Add new account (login + save)
  ipcMain.handle('aipri-add-account', async (event, credentials) => {
    const store = getStore();
    const { name } = credentials;

    // Check for duplicate name
    const accounts = store.get('aipriAccounts') || [];
    if (accounts.some(acc => acc.name === name)) {
      return { success: false, error: 'この名前のアカウントは既に登録されています' };
    }

    // Perform login
    const loginResult = await aipriService.performLogin(credentials);
    if (!loginResult.success) {
      return { success: false, error: loginResult.error };
    }

    // Download and save profile image
    let profileImagePath = null;
    if (loginResult.profileImageUrl) {
      profileImagePath = await aipriService.downloadAndSaveProfileImage(loginResult.profileImageUrl, name);
    }

    // Create account object
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
    store.set('aipriAccounts', updatedAccounts);
    store.set('aipriActiveAccountName', name);

    return { success: true, profileImagePath };
  });

  // Remove account
  ipcMain.handle('aipri-remove-account', async (event, name) => {
    const store = getStore();
    const accounts = store.get('aipriAccounts') || [];
    const activeAccountName = store.get('aipriActiveAccountName');

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
    store.set('aipriAccounts', updatedAccounts);

    // If removed account was active, switch to first remaining or null
    if (activeAccountName === name) {
      const newActive = updatedAccounts.length > 0 ? updatedAccounts[0].name : null;
      store.set('aipriActiveAccountName', newActive);
    }

    return { success: true };
  });

  // Update account credentials (re-login with new credentials)
  ipcMain.handle('aipri-update-account', async (event, oldName, credentials) => {
    const store = getStore();
    const accounts = store.get('aipriAccounts') || [];
    const activeAccountName = store.get('aipriActiveAccountName');

    // Find the account to update
    const accountIndex = accounts.findIndex(acc => acc.name === oldName);
    if (accountIndex === -1) {
      return { success: false, error: 'アカウントが見つかりません' };
    }

    const oldAccount = accounts[accountIndex];

    // Check if new name conflicts with existing account (if name changed)
    if (credentials.name !== oldName) {
      if (accounts.some(acc => acc.name === credentials.name)) {
        return { success: false, error: 'この名前のアカウントは既に登録されています' };
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
        console.error('Error deleting old profile image:', err);
      }
    }

    // Download and save new profile image
    let profileImagePath = null;
    if (loginResult.profileImageUrl) {
      profileImagePath = await aipriService.downloadAndSaveProfileImage(loginResult.profileImageUrl, credentials.name);
    }

    // Create updated account object
    const updatedAccount = {
      name: credentials.name,
      cardId: credentials.cardId,
      birthdayM: credentials.birthdayM,
      birthdayD: credentials.birthdayD,
      sessionCookie: loginResult.cookies || null,
      profileImagePath
    };

    // Update accounts array
    const updatedAccounts = [...accounts];
    updatedAccounts[accountIndex] = updatedAccount;
    store.set('aipriAccounts', updatedAccounts);

    // Update active account name if it was the one being edited
    if (activeAccountName === oldName) {
      store.set('aipriActiveAccountName', credentials.name);
    }

    return { success: true, profileImagePath };
  });

  // Switch active account
  ipcMain.handle('aipri-switch-account', async (event, name) => {
    const store = getStore();
    const accounts = store.get('aipriAccounts') || [];
    const account = accounts.find(acc => acc.name === name);

    if (!account) {
      return { success: false, error: 'アカウントが見つかりません' };
    }

    // Set as active
    store.set('aipriActiveAccountName', name);

    // Check if session is valid locally first (simple check)
    if (!account.sessionCookie || !account.sessionCookie.includes('MYPAPSSID=')) {
      // No session, try to re-login
      return await performLoginAndUpdateAccount(store, account, accounts);
    }

    // Verify existing session with server
    const verifyResult = await aipriService.verifySession(account.sessionCookie);

    if (verifyResult.valid) {
      // Session is valid
      // Update profile image if changed
      if (verifyResult.profileImageUrl) {
        const profileImagePath = await aipriService.downloadAndSaveProfileImage(verifyResult.profileImageUrl, name, account.sessionCookie);
        if (profileImagePath) {
          const updatedAccounts = accounts.map(acc =>
            acc.name === name ? { ...acc, profileImagePath } : acc
          );
          store.set('aipriAccounts', updatedAccounts);
        }
        return { success: true, profileImageUrl: verifyResult.profileImageUrl };
      }
      return { success: true };
    } else {
      // Session invalid/expired, re-login
      if (verifyResult.reason === 'セッションが期限切れです' || verifyResult.reason === 'セッションがありません') {
        // Attempt re-login
        return await performLoginAndUpdateAccount(store, account, accounts);
      }
      return { success: false, error: verifyResult.reason };
    }
  });

  /**
   * @typedef {{
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
   *   aipriActiveAccountName: string | null
   * }} StoreSchema
   */

  /**
   * Helper to perform login and update account in store
   * @param {import('electron-store').default<StoreSchema>} store
   * @param {AipriAccount} account
   * @param {AipriAccount[]} accounts
   */
  async function performLoginAndUpdateAccount(store, account, accounts) {
    const loginResult = await aipriService.performLogin({
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
      profileImagePath = await aipriService.downloadAndSaveProfileImage(loginResult.profileImageUrl, account.name);
    }

    const updatedAccounts = accounts.map(acc =>
      acc.name === account.name
        ? { ...acc, sessionCookie: loginResult.cookies || null, profileImagePath }
        : acc
    );
    store.set('aipriAccounts', updatedAccounts);

    return { success: true, reloggedIn: true, profileImageUrl: loginResult.profileImageUrl };
  }

  // ===== Legacy Handlers (for backward compatibility) =====

  // Aipri Login Handler
  ipcMain.handle('aipri-login', async (event, credentials) => {
    const store = getStore();
    const { name } = credentials;
    const accounts = store.get('aipriAccounts') || [];

    // Check if account already exists
    const existingAccount = accounts.find(acc => acc.name === name);
    if (existingAccount) {
      // Account exists - switch to it (which will re-login if needed)
      store.set('aipriActiveAccountName', name);

      // We just call the switch logic mostly, but we need to return formatted result
      // Let's reuse logic or just do the check here.
      // Reuse logic from aipri-switch-account via internal call? No, ipcMain handlers are not easily callable internally.
      // Be explicit.

      // Check session validity
      if (!existingAccount.sessionCookie || !existingAccount.sessionCookie.includes('MYPAPSSID=')) {
        // Re-login
        const result = await performLoginAndUpdateAccount(store, existingAccount, accounts);
        if (!result.success) return result;
        return {
          success: true,
          profileImageUrl: result.profileImageUrl // Return URL or local path? client expects local path usually if available
          // wait, original code returned local-image://...
        };
      }

      // Check against server
      // NOTE: Original code only checked server if session was valid locally.
      // But for login, we should probably ensure it works.

      return {
        success: true,
        profileImageUrl: existingAccount.profileImagePath
          ? `local-image://${encodeURIComponent(existingAccount.profileImagePath)}`
          : null
      };
    }

    // New account - perform login and add
    const loginResult = await aipriService.performLogin(credentials);
    if (!loginResult.success) {
      return { success: false, error: loginResult.error };
    }

    // Download and save profile image
    let profileImagePath = null;
    if (loginResult.profileImageUrl) {
      profileImagePath = await aipriService.downloadAndSaveProfileImage(loginResult.profileImageUrl, name);
    }

    // Create account
    const newAccount = {
      name: credentials.name,
      cardId: credentials.cardId,
      birthdayM: credentials.birthdayM,
      birthdayD: credentials.birthdayD,
      sessionCookie: loginResult.cookies || null,
      profileImagePath
    };

    store.set('aipriAccounts', [...accounts, newAccount]);
    store.set('aipriActiveAccountName', name);

    return {
      success: true,
      profileImageUrl: profileImagePath
        ? `local-image://${encodeURIComponent(profileImagePath)}`
        : loginResult.profileImageUrl
    };
  });

  // Check if session is still valid (uses active account)
  ipcMain.handle('aipri-check-session', async () => {
    const store = getStore();
    const activeAccountName = store.get('aipriActiveAccountName');
    if (!activeAccountName) {
      return { valid: false, reason: 'アクティブなアカウントがありません' };
    }

    const accounts = store.get('aipriAccounts') || [];
    const account = accounts.find(acc => acc.name === activeAccountName);
    if (!account) {
      return { valid: false, reason: 'アカウントが見つかりません' };
    }

    const sessionCookies = account.sessionCookie;
    if (!sessionCookies || !sessionCookies.includes('MYPAPSSID=')) {
      return { valid: false, reason: 'セッションがありません/無効です' };
    }

    const verifyResult = await aipriService.verifySession(sessionCookies);
    if (verifyResult.valid) {
      // Return local image path if available
      const localImageUrl = account.profileImagePath
        ? `local-image://${encodeURIComponent(account.profileImagePath)}`
        : verifyResult.profileImageUrl;
      return { valid: true, profileImageUrl: localImageUrl };
    }

    return verifyResult;
  });

  // Clear session (clears all accounts)
  ipcMain.handle('aipri-clear-session', async () => {
    const store = getStore();
    const accounts = store.get('aipriAccounts') || [];
    for (const account of accounts) {
      if (account.profileImagePath && fs.existsSync(account.profileImagePath)) {
        try {
          fs.unlinkSync(account.profileImagePath);
        } catch (err) {
          console.error('Error deleting profile image:', err);
        }
      }
    }

    store.set('aipriAccounts', []);
    store.set('aipriActiveAccountName', null);
    return { success: true };
  });

  // Fetch photos from myphoto-list API (uses active account)
  ipcMain.handle('aipri-fetch-photos', async (event, targetYm) => {
    return aipriService.fetchPhotos(targetYm);
  });

  // Download a single photo and save to folder
  ipcMain.handle('aipri-download-photo', async (event, url, filename, folderPath) => {
    return aipriService.downloadPhoto(url, filename, folderPath);
  });
}

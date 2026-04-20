// Session state using Svelte 5 runes
export const sessionState = $state({
  isLoggedIn: false,
  isChecking: false,
  hasChecked: false, // Track if initial session check has been done
  profileImageUrl: null as string | null,
  error: null as string | null,
  // Multi-account state
  accounts: [] as AipriAccount[],
  activeAccountId: null as string | null,
  isEditMode: false, // For account deletion mode
});

// Load all accounts from store
export async function loadAccounts(): Promise<void> {
  if (!window.electronAPI) return;

  try {
    const result = await window.electronAPI.aipriGetAccounts();
    sessionState.accounts = result.accounts;
    sessionState.activeAccountId = result.activeAccountId;
    sessionState.isLoggedIn = result.accounts.length > 0 && !!result.activeAccountId;

    // Set profile image URL for active account
    if (result.activeAccountId) {
      const activeAccount =
        result.accounts.find((acc) => acc.accountId === result.activeAccountId) ||
        result.accounts.find((acc) => acc.name === result.activeAccountName);
      if (activeAccount?.profileImagePath) {
        sessionState.profileImageUrl = `local-image://${encodeURIComponent(activeAccount.profileImagePath)}`;
      } else {
        sessionState.profileImageUrl = null;
      }
    } else {
      sessionState.profileImageUrl = null;
    }
  } catch (error) {
    console.error("Load accounts error:", error);
  }
}

// Check session on load (only if not already checked or logged in)
export async function checkSession(force = false): Promise<boolean> {
  // Skip if already logged in or already checked (unless forced)
  if (!force && (sessionState.isLoggedIn || sessionState.hasChecked)) {
    return sessionState.isLoggedIn;
  }

  if (!window.electronAPI) {
    sessionState.isChecking = false;
    sessionState.hasChecked = true;
    return false;
  }

  sessionState.isChecking = true;
  sessionState.error = null;

  try {
    // Load accounts first
    await loadAccounts();

    // If we have accounts, check the active session
    if (sessionState.accounts.length > 0 && sessionState.activeAccountId) {
      const result = (await window.electronAPI.aipriCheckSession()) as AipriSessionCheckResult;

      if (result.valid) {
        sessionState.isLoggedIn = true;
        sessionState.profileImageUrl = result.profileImageUrl || null;
        return true;
      } else {
        sessionState.isLoggedIn = false;
        sessionState.profileImageUrl = null;
        return false;
      }
    } else {
      sessionState.isLoggedIn = false;
      return false;
    }
  } catch (error) {
    console.error("Session check error:", error);
    sessionState.error = String(error);
    sessionState.isLoggedIn = false;
    return false;
  } finally {
    sessionState.isChecking = false;
    sessionState.hasChecked = true;
  }
}

// Login to Aipri (adds or switches account)
export async function login(credentials: AipriLoginCredentials): Promise<AipriLoginResult> {
  if (!window.electronAPI) {
    return { success: false, error: "Electron APIが利用できません" };
  }

  sessionState.error = null;

  try {
    const accountsResult = await window.electronAPI.aipriGetAccounts();
    const existingAccount =
      accountsResult.accounts.find((account) => account.cardId === credentials.cardId) ||
      accountsResult.accounts.find((account) => account.name === credentials.name);

    let success = false;
    let error: string | undefined;
    let profileImageUrl: string | null = null;

    if (existingAccount?.accountId) {
      if (accountsResult.activeAccountId === existingAccount.accountId) {
        const checkResult =
          (await window.electronAPI.aipriCheckSession()) as AipriSessionCheckResult;
        if (checkResult.valid) {
          success = true;
          profileImageUrl = checkResult.profileImageUrl || null;
        } else {
          const switchResult = await window.electronAPI.aipriSwitchAccount(
            existingAccount.accountId,
          );
          success = switchResult.success;
          error = switchResult.error;
          profileImageUrl = switchResult.profileImageUrl || null;
        }
      } else {
        const switchResult = await window.electronAPI.aipriSwitchAccount(existingAccount.accountId);
        success = switchResult.success;
        error = switchResult.error;
        profileImageUrl = switchResult.profileImageUrl || null;
      }
    } else {
      const addResult = await window.electronAPI.aipriAddAccount(credentials);
      success = addResult.success;
      error = addResult.error;
    }

    if (success) {
      sessionState.isLoggedIn = true;
      // Reload accounts to keep state aligned with backend updates.
      await loadAccounts();
      if (profileImageUrl) {
        sessionState.profileImageUrl = profileImageUrl;
      }
      return { success: true, profileImageUrl: sessionState.profileImageUrl };
    }

    const resolvedError = error || "ログインに失敗しました";
    sessionState.error = resolvedError;
    return { success: false, error: resolvedError };
  } catch (error) {
    console.error("Login error:", error);
    const errorMessage = `通信エラー: ${String(error)}`;
    sessionState.error = errorMessage;
    return { success: false, error: errorMessage };
  }
}

// Add new account
export async function addAccount(
  credentials: AipriLoginCredentials,
): Promise<AipriAddAccountResult> {
  if (!window.electronAPI) {
    return { success: false, error: "Electron APIが利用できません" };
  }

  sessionState.error = null;

  try {
    const result = await window.electronAPI.aipriAddAccount(credentials);

    if (result.success) {
      // Reload accounts
      await loadAccounts();
      sessionState.isLoggedIn = true;
    } else {
      sessionState.error = result.error || "アカウント追加に失敗しました";
    }

    return result;
  } catch (error) {
    console.error("Add account error:", error);
    const errorMessage = `通信エラー: ${String(error)}`;
    sessionState.error = errorMessage;
    return { success: false, error: errorMessage };
  }
}

// Remove account
export async function removeAccount(accountId: string): Promise<void> {
  if (!window.electronAPI) return;

  try {
    await window.electronAPI.aipriRemoveAccount(accountId);
    // Reload accounts
    await loadAccounts();

    // Update login state
    if (sessionState.accounts.length === 0) {
      sessionState.isLoggedIn = false;
      sessionState.profileImageUrl = null;
    }
  } catch (error) {
    console.error("Remove account error:", error);
  }
}

// Update account credentials
export async function updateAccount(
  accountId: string,
  credentials: AipriLoginCredentials,
): Promise<AipriUpdateAccountResult> {
  if (!window.electronAPI) {
    return { success: false, error: "Electron APIが利用できません" };
  }

  sessionState.error = null;

  try {
    const result = await window.electronAPI.aipriUpdateAccount(accountId, credentials);

    if (result.success) {
      // Reload accounts to get updated data
      await loadAccounts();
    } else {
      sessionState.error = result.error || "アカウント更新に失敗しました";
    }

    return result;
  } catch (error) {
    console.error("Update account error:", error);
    const errorMessage = `通信エラー: ${String(error)}`;
    sessionState.error = errorMessage;
    return { success: false, error: errorMessage };
  }
}

// Switch to a different account
export async function switchAccount(accountId: string): Promise<AipriSwitchAccountResult> {
  if (!window.electronAPI) {
    return { success: false, error: "Electron APIが利用できません" };
  }

  sessionState.error = null;
  sessionState.isChecking = true;

  try {
    const result = await window.electronAPI.aipriSwitchAccount(accountId);

    if (result.success) {
      sessionState.activeAccountId = result.activeAccountId || accountId;
      sessionState.isLoggedIn = true;

      // Update profile image URL
      if (result.profileImageUrl) {
        sessionState.profileImageUrl = result.profileImageUrl;
      } else {
        // Get from local account data
        const account = sessionState.accounts.find((acc) => acc.accountId === accountId);
        if (account?.profileImagePath) {
          sessionState.profileImageUrl = `local-image://${encodeURIComponent(account.profileImagePath)}`;
        }
      }

      // Reload accounts to get any updated profile images
      await loadAccounts();
    } else {
      sessionState.error = result.error || "アカウント切り替えに失敗しました";
    }

    return result;
  } catch (error) {
    console.error("Switch account error:", error);
    const errorMessage = `通信エラー: ${String(error)}`;
    sessionState.error = errorMessage;
    return { success: false, error: errorMessage };
  } finally {
    sessionState.isChecking = false;
  }
}

// Toggle edit mode for account management
export function toggleEditMode(): void {
  sessionState.isEditMode = !sessionState.isEditMode;
}

// Logout / Clear all sessions
export async function logout(): Promise<void> {
  if (!window.electronAPI) return;

  try {
    await window.electronAPI.aipriClearSession();
  } catch (error) {
    console.error("Logout error:", error);
  }

  sessionState.isLoggedIn = false;
  sessionState.profileImageUrl = null;
  sessionState.error = null;
  sessionState.accounts = [];
  sessionState.activeAccountId = null;
  sessionState.isEditMode = false;
}

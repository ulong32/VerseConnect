// Session state using Svelte 5 runes
export const sessionState = $state({
  isLoggedIn: false,
  isChecking: false,
  hasChecked: false,  // Track if initial session check has been done
  profileImageUrl: null as string | null,
  error: null as string | null,
  // Multi-account state
  accounts: [] as AipriAccount[],
  activeAccountName: null as string | null,
  isEditMode: false,  // For account deletion mode
});

// Load all accounts from store
export async function loadAccounts(): Promise<void> {
  if (!window.electronAPI) return;

  try {
    const result = await window.electronAPI.aipriGetAccounts();
    sessionState.accounts = result.accounts;
    sessionState.activeAccountName = result.activeAccountName;
    sessionState.isLoggedIn = result.accounts.length > 0 && !!result.activeAccountName;

    // Set profile image URL for active account
    if (result.activeAccountName) {
      const activeAccount = result.accounts.find(acc => acc.name === result.activeAccountName);
      if (activeAccount?.profileImagePath) {
        sessionState.profileImageUrl = `local-image://${encodeURIComponent(activeAccount.profileImagePath)}`;
      }
    }
  } catch (error) {
    console.error('Load accounts error:', error);
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
    if (sessionState.accounts.length > 0 && sessionState.activeAccountName) {
      const result = await window.electronAPI.aipriCheckSession() as AipriSessionCheckResult;

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
    console.error('Session check error:', error);
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
    return { success: false, error: 'Electron APIが利用できません' };
  }

  sessionState.error = null;

  try {
    const result = await window.electronAPI.aipriLogin(credentials) as AipriLoginResult;

    if (result.success) {
      sessionState.isLoggedIn = true;
      sessionState.profileImageUrl = result.profileImageUrl || null;
      // Reload accounts to get updated list
      await loadAccounts();
    } else {
      sessionState.error = result.error || 'ログインに失敗しました';
    }

    return result;
  } catch (error) {
    console.error('Login error:', error);
    const errorMessage = `通信エラー: ${String(error)}`;
    sessionState.error = errorMessage;
    return { success: false, error: errorMessage };
  }
}

// Add new account
export async function addAccount(credentials: AipriLoginCredentials): Promise<AipriAddAccountResult> {
  if (!window.electronAPI) {
    return { success: false, error: 'Electron APIが利用できません' };
  }

  sessionState.error = null;

  try {
    const result = await window.electronAPI.aipriAddAccount(credentials);

    if (result.success) {
      // Reload accounts
      await loadAccounts();
      sessionState.isLoggedIn = true;
    } else {
      sessionState.error = result.error || 'アカウント追加に失敗しました';
    }

    return result;
  } catch (error) {
    console.error('Add account error:', error);
    const errorMessage = `通信エラー: ${String(error)}`;
    sessionState.error = errorMessage;
    return { success: false, error: errorMessage };
  }
}

// Remove account
export async function removeAccount(name: string): Promise<void> {
  if (!window.electronAPI) return;

  try {
    await window.electronAPI.aipriRemoveAccount(name);
    // Reload accounts
    await loadAccounts();

    // Update login state
    if (sessionState.accounts.length === 0) {
      sessionState.isLoggedIn = false;
      sessionState.profileImageUrl = null;
    }
  } catch (error) {
    console.error('Remove account error:', error);
  }
}

// Switch to a different account
export async function switchAccount(name: string): Promise<AipriSwitchAccountResult> {
  if (!window.electronAPI) {
    return { success: false, error: 'Electron APIが利用できません' };
  }

  sessionState.error = null;
  sessionState.isChecking = true;

  try {
    const result = await window.electronAPI.aipriSwitchAccount(name);

    if (result.success) {
      sessionState.activeAccountName = name;
      sessionState.isLoggedIn = true;

      // Update profile image URL
      if (result.profileImageUrl) {
        sessionState.profileImageUrl = result.profileImageUrl;
      } else {
        // Get from local account data
        const account = sessionState.accounts.find(acc => acc.name === name);
        if (account?.profileImagePath) {
          sessionState.profileImageUrl = `local-image://${encodeURIComponent(account.profileImagePath)}`;
        }
      }

      // Reload accounts to get any updated profile images
      await loadAccounts();
    } else {
      sessionState.error = result.error || 'アカウント切り替えに失敗しました';
    }

    return result;
  } catch (error) {
    console.error('Switch account error:', error);
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
    console.error('Logout error:', error);
  }

  sessionState.isLoggedIn = false;
  sessionState.profileImageUrl = null;
  sessionState.error = null;
  sessionState.accounts = [];
  sessionState.activeAccountName = null;
  sessionState.isEditMode = false;
}

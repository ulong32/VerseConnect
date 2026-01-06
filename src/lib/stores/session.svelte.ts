// Session state using Svelte 5 runes
export const sessionState = $state({
  isLoggedIn: false,
  isChecking: false,
  hasChecked: false,  // Track if initial session check has been done
  profileImageUrl: null as string | null,
  error: null as string | null
});

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

// Login to Aipri
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

// Logout / Clear session
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
}

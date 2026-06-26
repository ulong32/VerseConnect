import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  sessionState,
  loadAccounts,
  checkSession,
  login,
  addAccount,
  removeAccount,
  updateAccount,
  switchAccount,
  toggleEditMode,
  logout,
} from "./session.svelte";

const mockElectronAPI = {
  aipriGetAccounts: vi.fn(),
  aipriCheckSession: vi.fn(),
  aipriClearSession: vi.fn(),
  aipriAddAccount: vi.fn(),
  aipriRemoveAccount: vi.fn(),
  aipriUpdateAccount: vi.fn(),
  aipriSwitchAccount: vi.fn(),
};

globalThis.window = {
  electronAPI: mockElectronAPI,
} as any;

describe("session store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionState.isLoggedIn = false;
    sessionState.isChecking = false;
    sessionState.hasChecked = false;
    sessionState.profileImageUrl = null;
    sessionState.error = null;
    sessionState.accounts = [];
    sessionState.activeAccountId = null;
    sessionState.isEditMode = false;
  });

  describe("loadAccounts", () => {
    it("should load accounts and set active account profile image from local path if valid", async () => {
      mockElectronAPI.aipriGetAccounts.mockResolvedValue({
        accounts: [
          {
            accountId: "acc-1",
            name: "Alice",
            cardId: "card-1",
            birthdayM: "01",
            birthdayD: "01",
            sessionCookie: "cookie-1",
            profileImagePath: "C:/path/to/profile.png",
          },
        ],
        activeAccountId: "acc-1",
        activeAccountName: "Alice",
      });

      await loadAccounts();

      expect(mockElectronAPI.aipriGetAccounts).toHaveBeenCalledTimes(1);
      expect(sessionState.accounts.length).toBe(1);
      expect(sessionState.activeAccountId).toBe("acc-1");
      expect(sessionState.isLoggedIn).toBe(true);
      expect(sessionState.profileImageUrl).toBe("local-image://C%3A%2Fpath%2Fto%2Fprofile.png");
    });

    it("should handle empty accounts list", async () => {
      mockElectronAPI.aipriGetAccounts.mockResolvedValue({
        accounts: [],
        activeAccountId: null,
        activeAccountName: null,
      });

      await loadAccounts();

      expect(sessionState.accounts).toEqual([]);
      expect(sessionState.activeAccountId).toBeNull();
      expect(sessionState.isLoggedIn).toBe(false);
      expect(sessionState.profileImageUrl).toBeNull();
    });
  });

  describe("checkSession", () => {
    it("should skip check if already logged in and not forced", async () => {
      sessionState.isLoggedIn = true;
      sessionState.hasChecked = true;

      const result = await checkSession();

      expect(result).toBe(true);
      expect(mockElectronAPI.aipriGetAccounts).not.toHaveBeenCalled();
    });

    it("should check session when active account exists", async () => {
      mockElectronAPI.aipriGetAccounts.mockResolvedValue({
        accounts: [
          {
            accountId: "acc-1",
            name: "Alice",
          },
        ],
        activeAccountId: "acc-1",
      });
      mockElectronAPI.aipriCheckSession.mockResolvedValue({
        valid: true,
        profileImageUrl: "http://example.com/profile.jpg",
      });

      const result = await checkSession();

      expect(result).toBe(true);
      expect(sessionState.isLoggedIn).toBe(true);
      expect(sessionState.profileImageUrl).toBe("http://example.com/profile.jpg");
      expect(sessionState.hasChecked).toBe(true);
    });

    it("should handle invalid session during check", async () => {
      mockElectronAPI.aipriGetAccounts.mockResolvedValue({
        accounts: [
          {
            accountId: "acc-1",
            name: "Alice",
          },
        ],
        activeAccountId: "acc-1",
      });
      mockElectronAPI.aipriCheckSession.mockResolvedValue({
        valid: false,
      });

      const result = await checkSession();

      expect(result).toBe(false);
      expect(sessionState.isLoggedIn).toBe(false);
      expect(sessionState.profileImageUrl).toBeNull();
    });
  });

  describe("login / switchAccount / addAccount / removeAccount", () => {
    it("should login by switching account if account exists", async () => {
      mockElectronAPI.aipriGetAccounts.mockResolvedValue({
        accounts: [{ accountId: "acc-1", name: "Alice", cardId: "card-1" }],
        activeAccountId: "acc-2",
      });
      mockElectronAPI.aipriSwitchAccount.mockResolvedValue({
        success: true,
        profileImageUrl: "http://example.com/profile.jpg",
      });

      const result = await login({
        cardId: "card-1",
        name: "Alice",
        birthdayM: "01",
        birthdayD: "01",
      });

      expect(result.success).toBe(true);
      expect(mockElectronAPI.aipriSwitchAccount).toHaveBeenCalledWith("acc-1");
      expect(sessionState.isLoggedIn).toBe(true);
    });

    it("should login by adding account if account does not exist", async () => {
      mockElectronAPI.aipriGetAccounts.mockResolvedValue({
        accounts: [],
        activeAccountId: null,
      });
      mockElectronAPI.aipriAddAccount.mockResolvedValue({
        success: true,
        accountId: "acc-new",
      });

      const result = await login({
        cardId: "card-new",
        name: "NewUser",
        birthdayM: "02",
        birthdayD: "02",
      });

      expect(result.success).toBe(true);
      expect(mockElectronAPI.aipriAddAccount).toHaveBeenCalledTimes(1);
    });

    it("should add account and reload accounts list", async () => {
      mockElectronAPI.aipriAddAccount.mockResolvedValue({ success: true });
      mockElectronAPI.aipriGetAccounts.mockResolvedValue({ accounts: [], activeAccountId: null });

      const result = await addAccount({
        cardId: "c1",
        name: "Alice",
        birthdayM: "01",
        birthdayD: "01",
      });

      expect(result.success).toBe(true);
      expect(mockElectronAPI.aipriAddAccount).toHaveBeenCalledTimes(1);
      expect(mockElectronAPI.aipriGetAccounts).toHaveBeenCalledTimes(1);
    });

    it("should remove account and handle logout if no accounts remaining", async () => {
      mockElectronAPI.aipriRemoveAccount.mockResolvedValue({ success: true });
      mockElectronAPI.aipriGetAccounts.mockResolvedValue({ accounts: [], activeAccountId: null });
      sessionState.isLoggedIn = true;

      await removeAccount("acc-1");

      expect(mockElectronAPI.aipriRemoveAccount).toHaveBeenCalledWith("acc-1");
      expect(sessionState.isLoggedIn).toBe(false);
    });

    it("should update account credentials", async () => {
      mockElectronAPI.aipriUpdateAccount.mockResolvedValue({ success: true });
      mockElectronAPI.aipriGetAccounts.mockResolvedValue({ accounts: [], activeAccountId: null });

      const result = await updateAccount("acc-1", {
        cardId: "c1",
        name: "Alice",
        birthdayM: "01",
        birthdayD: "02",
      });

      expect(result.success).toBe(true);
      expect(mockElectronAPI.aipriUpdateAccount).toHaveBeenCalledWith("acc-1", {
        cardId: "c1",
        name: "Alice",
        birthdayM: "01",
        birthdayD: "02",
      });
    });

    it("should switch active account", async () => {
      mockElectronAPI.aipriSwitchAccount.mockResolvedValue({
        success: true,
        activeAccountId: "acc-2",
        profileImageUrl: "http://example.com/acc2.jpg",
      });
      mockElectronAPI.aipriGetAccounts.mockResolvedValue({
        accounts: [{ accountId: "acc-2", name: "Bob", profileImagePath: "C:/path/to/acc2.png" }],
        activeAccountId: "acc-2",
      });

      const result = await switchAccount("acc-2");

      expect(result.success).toBe(true);
      expect(sessionState.activeAccountId).toBe("acc-2");
      expect(sessionState.profileImageUrl).toBe("local-image://C%3A%2Fpath%2Fto%2Facc2.png");
    });
  });

  describe("toggleEditMode & logout", () => {
    it("should toggle edit mode", () => {
      expect(sessionState.isEditMode).toBe(false);
      toggleEditMode();
      expect(sessionState.isEditMode).toBe(true);
      toggleEditMode();
      expect(sessionState.isEditMode).toBe(false);
    });

    it("should clear session and state on logout", async () => {
      sessionState.isLoggedIn = true;
      sessionState.profileImageUrl = "http://example.com/profile.jpg";

      await logout();

      expect(mockElectronAPI.aipriClearSession).toHaveBeenCalledTimes(1);
      expect(sessionState.isLoggedIn).toBe(false);
      expect(sessionState.profileImageUrl).toBeNull();
      expect(sessionState.accounts).toEqual([]);
      expect(sessionState.activeAccountId).toBeNull();
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { updateState, initUpdateListeners, checkForUpdates, quitAndInstall } from "./update.svelte";

const unsubscribes = {
  onUpdateChecking: vi.fn(),
  onUpdateAvailable: vi.fn(),
  onUpdateNotAvailable: vi.fn(),
  onDownloadProgress: vi.fn(),
  onUpdateDownloaded: vi.fn(),
  onUpdateError: vi.fn(),
};

const listeners = {
  updateChecking: null as any,
  updateAvailable: null as any,
  updateNotAvailable: null as any,
  downloadProgress: null as any,
  updateDownloaded: null as any,
  updateError: null as any,
};

const mockElectronAPI = {
  getAppVersion: vi.fn().mockResolvedValue("1.2.3"),
  checkForUpdates: vi.fn(),
  quitAndInstall: vi.fn(),
  onUpdateChecking: vi.fn((cb) => {
    listeners.updateChecking = cb;
    return unsubscribes.onUpdateChecking;
  }),
  onUpdateAvailable: vi.fn((cb) => {
    listeners.updateAvailable = cb;
    return unsubscribes.onUpdateAvailable;
  }),
  onUpdateNotAvailable: vi.fn((cb) => {
    listeners.updateNotAvailable = cb;
    return unsubscribes.onUpdateNotAvailable;
  }),
  onDownloadProgress: vi.fn((cb) => {
    listeners.downloadProgress = cb;
    return unsubscribes.onDownloadProgress;
  }),
  onUpdateDownloaded: vi.fn((cb) => {
    listeners.updateDownloaded = cb;
    return unsubscribes.onUpdateDownloaded;
  }),
  onUpdateError: vi.fn((cb) => {
    listeners.updateError = cb;
    return unsubscribes.onUpdateError;
  }),
};

globalThis.window = {
  electronAPI: mockElectronAPI,
} as any;

describe("update store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateState.currentVersion = "";
    updateState.status = "idle";
    updateState.progress = 0;
    updateState.errorMessage = "";
    updateState.newVersion = "";
    updateState.releaseNotes = "";
  });

  describe("initUpdateListeners", () => {
    it("should fetch and set app version, register listeners, and return a cleanup function", async () => {
      const cleanup = initUpdateListeners();

      // Wait for promise microtask to resolve getAppVersion
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockElectronAPI.getAppVersion).toHaveBeenCalledTimes(1);
      expect(updateState.currentVersion).toBe("1.2.3");

      expect(mockElectronAPI.onUpdateChecking).toHaveBeenCalledTimes(1);
      expect(mockElectronAPI.onUpdateAvailable).toHaveBeenCalledTimes(1);

      cleanup();

      expect(unsubscribes.onUpdateChecking).toHaveBeenCalledTimes(1);
      expect(unsubscribes.onUpdateAvailable).toHaveBeenCalledTimes(1);
      expect(unsubscribes.onUpdateNotAvailable).toHaveBeenCalledTimes(1);
      expect(unsubscribes.onDownloadProgress).toHaveBeenCalledTimes(1);
      expect(unsubscribes.onUpdateDownloaded).toHaveBeenCalledTimes(1);
      expect(unsubscribes.onUpdateError).toHaveBeenCalledTimes(1);
    });

    it("should handle update checking event", () => {
      initUpdateListeners();
      updateState.status = "idle";
      updateState.errorMessage = "some error";

      listeners.updateChecking();

      expect(updateState.status).toBe("checking");
      expect(updateState.errorMessage).toBe("");
    });

    it("should handle update available event", () => {
      initUpdateListeners();

      listeners.updateAvailable({
        version: "2.0.0",
        releaseNotes: "New cool features!",
      });

      expect(updateState.status).toBe("available");
      expect(updateState.newVersion).toBe("2.0.0");
      expect(updateState.releaseNotes).toBe("New cool features!");
      expect(updateState.progress).toBe(0);
    });

    it("should handle update not available event by reverting status from checking to idle", () => {
      initUpdateListeners();
      updateState.status = "checking";

      listeners.updateNotAvailable();

      expect(updateState.status).toBe("idle");
    });

    it("should handle download progress event", () => {
      initUpdateListeners();

      listeners.downloadProgress({ percent: 45.6 });

      expect(updateState.status).toBe("downloading");
      expect(updateState.progress).toBe(46); // Math.round(45.6)
    });

    it("should handle update downloaded event", () => {
      initUpdateListeners();

      listeners.updateDownloaded({
        version: "2.0.0",
        releaseNotes: "New cool features!",
      });

      expect(updateState.status).toBe("downloaded");
      expect(updateState.newVersion).toBe("2.0.0");
      expect(updateState.progress).toBe(100);
    });

    it("should handle update error event", () => {
      initUpdateListeners();

      listeners.updateError("Connection failed");

      expect(updateState.status).toBe("error");
      expect(updateState.errorMessage).toBe("Connection failed");
    });
  });

  describe("actions", () => {
    it("should check for updates and update status", async () => {
      await checkForUpdates();

      expect(updateState.status).toBe("checking");
      expect(updateState.errorMessage).toBe("");
      expect(mockElectronAPI.checkForUpdates).toHaveBeenCalledTimes(1);
    });

    it("should quit and install update", () => {
      quitAndInstall();

      expect(mockElectronAPI.quitAndInstall).toHaveBeenCalledTimes(1);
    });
  });
});

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "error";

// Reactive update state using Svelte 5 runes
export const updateState = $state({
  currentVersion: "",
  status: "idle" as UpdateStatus,
  progress: 0, // download percentage
  errorMessage: "",
  newVersion: "",
  releaseNotes: "",
});

/**
 * Initialize IPC listeners for the updater.
 * Returns a cleanup function to unsubscribe from all listeners.
 */
export function initUpdateListeners(): () => void {
  if (!window.electronAPI) return () => {};

  // Get current app version
  void window.electronAPI.getAppVersion().then((version) => {
    updateState.currentVersion = version;
  });

  const unsubscribeList: Array<() => void> = [];

  // 1. Checking for updates
  const unsubChecking = window.electronAPI.onUpdateChecking(() => {
    updateState.status = "checking";
    updateState.errorMessage = "";
  });
  unsubscribeList.push(unsubChecking);

  // 2. Update available
  const unsubAvailable = window.electronAPI.onUpdateAvailable((info) => {
    updateState.status = "available";
    updateState.newVersion = info.version;
    updateState.releaseNotes = info.releaseNotes || "";
    updateState.progress = 0;
  });
  unsubscribeList.push(unsubAvailable);

  // 3. Update not available
  const unsubNotAvailable = window.electronAPI.onUpdateNotAvailable(() => {
    // If we were checking, reset status
    if (updateState.status === "checking") {
      updateState.status = "idle";
    }
  });
  unsubscribeList.push(unsubNotAvailable);

  // 4. Download progress
  const unsubProgress = window.electronAPI.onDownloadProgress((prog) => {
    updateState.status = "downloading";
    updateState.progress = Math.round(prog.percent);
  });
  unsubscribeList.push(unsubProgress);

  // 5. Update downloaded
  const unsubDownloaded = window.electronAPI.onUpdateDownloaded((info) => {
    updateState.status = "downloaded";
    updateState.newVersion = info.version;
    updateState.releaseNotes = info.releaseNotes || "";
    updateState.progress = 100;
  });
  unsubscribeList.push(unsubDownloaded);

  // 6. Error
  const unsubError = window.electronAPI.onUpdateError((message) => {
    updateState.status = "error";
    updateState.errorMessage = message || "アップデート中にエラーが発生しました。";

    // Automatically reset error after 6 seconds
    setTimeout(() => {
      if (updateState.status === "error") {
        updateState.status = "idle";
        updateState.errorMessage = "";
      }
    }, 6000);
  });
  unsubscribeList.push(unsubError);

  // Return the cleanup function
  return () => {
    unsubscribeList.forEach((unsub) => unsub());
  };
}

/** Trigger manual update check */
export async function checkForUpdates(): Promise<void> {
  if (!window.electronAPI) return;
  updateState.status = "checking";
  updateState.errorMessage = "";
  await window.electronAPI.checkForUpdates();
}

/** Restart app and apply update */
export function quitAndInstall(): void {
  if (!window.electronAPI) return;
  window.electronAPI.quitAndInstall();
}

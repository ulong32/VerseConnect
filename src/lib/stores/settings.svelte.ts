// Character presets
export const CHARACTER_PRESETS = ['ひまり', 'みつき', 'つむぎ', 'サクラ', 'タマキ', 'アイリ', 'リンリン', 'チィ', 'じゅりあ', 'える', 'すばる', 'おとめ', 'ビビ', 'リング'];

// Reactive state using Svelte 5 runes
export const settingsState = $state({
  folderPath: '',
  customCharacters: [] as string[]
});

// Derived value: all characters (presets + custom) - exported as getter function
export function getAllCharacters(): string[] {
  return [...CHARACTER_PRESETS, ...settingsState.customCharacters];
}

// Load settings from Electron API
export async function loadSettings(): Promise<void> {
  if (!window.electronAPI) return;

  const settings = await window.electronAPI.getSettings();
  settingsState.customCharacters = settings.customCharacters || [];
  if (settings.folderPath) {
    settingsState.folderPath = settings.folderPath;
  }
}

// Set folder path and save to settings
export async function setFolderPath(path: string): Promise<void> {
  settingsState.folderPath = path;
  if (window.electronAPI) {
    await window.electronAPI.setSettings({ folderPath: path });
  }
}

// Select folder via dialog and update state
export async function selectFolder(): Promise<string | null> {
  if (!window.electronAPI) return null;

  const selected = await window.electronAPI.selectFolder();
  if (selected) {
    await setFolderPath(selected);
    return selected;
  }
  return null;
}

// Add a custom character
export async function addCustomCharacter(name: string): Promise<boolean> {
  const trimmed = name.trim();
  if (!trimmed) return false;

  if (getAllCharacters().includes(trimmed)) return false;

  settingsState.customCharacters = [...settingsState.customCharacters, trimmed];

  if (window.electronAPI) {
    await window.electronAPI.setSettings({ customCharacters: $state.snapshot(settingsState.customCharacters) });
  }
  return true;
}

// Remove a custom character
export async function removeCustomCharacter(name: string): Promise<void> {
  settingsState.customCharacters = settingsState.customCharacters.filter(c => c !== name);

  if (window.electronAPI) {
    await window.electronAPI.setSettings({ customCharacters: $state.snapshot(settingsState.customCharacters) });
  }
}

import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  settingsState,
  getAllCharacters,
  getPresetCharacters,
  getCustomCharacters,
  getAllTags,
  loadSettings,
  setAutoUpdateCheck,
  setDebugMode,
  setFolderPath,
  selectFolder,
  setItemImageFolderPath,
  selectItemImageFolder,
  addCustomCharacter,
  removeCustomCharacter,
  addCustomTag,
  removeCustomTag,
  CHARACTER_PRESETS,
} from "./settings.svelte";

const mockElectronAPI = {
  selectFolder: vi.fn(),
  getSettings: vi.fn(),
  setSettings: vi.fn(),
};

globalThis.window = {
  electronAPI: mockElectronAPI,
} as any;

describe("settings store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsState.folderPath = "";
    settingsState.itemImageFolderPath = "";
    settingsState.customCharacters = [];
    settingsState.customTags = [];
    settingsState.autoUpdateCheck = true;
    settingsState.debugMode = false;
  });

  describe("character getters", () => {
    it("should return preset characters", () => {
      const presets = getPresetCharacters();
      expect(presets).toEqual(CHARACTER_PRESETS);
    });

    it("should return custom characters", () => {
      settingsState.customCharacters = ["Custom1", "Custom2"];
      const custom = getCustomCharacters();
      expect(custom).toEqual(["Custom1", "Custom2"]);
    });

    it("should return all characters combined", () => {
      settingsState.customCharacters = ["Custom1"];
      const all = getAllCharacters();
      expect(all).toEqual([...CHARACTER_PRESETS, "Custom1"]);
    });
  });

  describe("tag getters", () => {
    it("should return all custom tags", () => {
      settingsState.customTags = ["Tag1", "Tag2"];
      const tags = getAllTags();
      expect(tags).toEqual(["Tag1", "Tag2"]);
    });
  });

  describe("loadSettings", () => {
    it("should populate settingsState from Electron store", async () => {
      mockElectronAPI.getSettings.mockResolvedValue({
        folderPath: "/path/to/images",
        itemImageFolderPath: "/path/to/items",
        customCharacters: ["Alice"],
        customTags: ["Lovely"],
        autoUpdateCheck: false,
        debugMode: true,
      });

      await loadSettings();

      expect(mockElectronAPI.getSettings).toHaveBeenCalledTimes(1);
      expect(settingsState.folderPath).toBe("/path/to/images");
      expect(settingsState.itemImageFolderPath).toBe("/path/to/items");
      expect(settingsState.customCharacters).toEqual(["Alice"]);
      expect(settingsState.customTags).toEqual(["Lovely"]);
      expect(settingsState.autoUpdateCheck).toBe(false);
      expect(settingsState.debugMode).toBe(true);
    });

    it("should handle partial settings", async () => {
      mockElectronAPI.getSettings.mockResolvedValue({
        folderPath: "/path/to/images",
      });

      await loadSettings();

      expect(settingsState.folderPath).toBe("/path/to/images");
      expect(settingsState.customCharacters).toEqual([]);
      expect(settingsState.customTags).toEqual([]);
      expect(settingsState.autoUpdateCheck).toBe(true); // default
      expect(settingsState.debugMode).toBe(false); // default
    });
  });

  describe("setters and folder selection", () => {
    it("should set folder path and call setSettings", async () => {
      mockElectronAPI.setSettings.mockResolvedValue(true);

      await setFolderPath("/new/path");

      expect(settingsState.folderPath).toBe("/new/path");
      expect(mockElectronAPI.setSettings).toHaveBeenCalledWith({ folderPath: "/new/path" });
    });

    it("should select folder and update folderPath", async () => {
      mockElectronAPI.selectFolder.mockResolvedValue("/selected/folder");
      mockElectronAPI.setSettings.mockResolvedValue(true);

      const result = await selectFolder();

      expect(result).toBe("/selected/folder");
      expect(settingsState.folderPath).toBe("/selected/folder");
      expect(mockElectronAPI.setSettings).toHaveBeenCalledWith({ folderPath: "/selected/folder" });
    });

    it("should return null and not change folderPath if folder selection cancelled", async () => {
      settingsState.folderPath = "/old/path";
      mockElectronAPI.selectFolder.mockResolvedValue(null);

      const result = await selectFolder();

      expect(result).toBeNull();
      expect(settingsState.folderPath).toBe("/old/path");
      expect(mockElectronAPI.setSettings).not.toHaveBeenCalled();
    });

    it("should set item image folder path", async () => {
      mockElectronAPI.setSettings.mockResolvedValue(true);

      await setItemImageFolderPath("/items/path");

      expect(settingsState.itemImageFolderPath).toBe("/items/path");
      expect(mockElectronAPI.setSettings).toHaveBeenCalledWith({
        itemImageFolderPath: "/items/path",
      });
    });

    it("should select item image folder", async () => {
      mockElectronAPI.selectFolder.mockResolvedValue("/selected/items");
      mockElectronAPI.setSettings.mockResolvedValue(true);

      const result = await selectItemImageFolder();

      expect(result).toBe("/selected/items");
      expect(settingsState.itemImageFolderPath).toBe("/selected/items");
      expect(mockElectronAPI.setSettings).toHaveBeenCalledWith({
        itemImageFolderPath: "/selected/items",
      });
    });

    it("should set autoUpdateCheck and debugMode", async () => {
      mockElectronAPI.setSettings.mockResolvedValue(true);

      await setAutoUpdateCheck(false);
      expect(settingsState.autoUpdateCheck).toBe(false);
      expect(mockElectronAPI.setSettings).toHaveBeenCalledWith({ autoUpdateCheck: false });

      await setDebugMode(true);
      expect(settingsState.debugMode).toBe(true);
      expect(mockElectronAPI.setSettings).toHaveBeenCalledWith({ debugMode: true });
    });
  });

  describe("custom character management", () => {
    it("should add a valid new custom character", async () => {
      mockElectronAPI.setSettings.mockResolvedValue(true);

      const success = await addCustomCharacter("  NewChar  ");

      expect(success).toBe(true);
      expect(settingsState.customCharacters).toEqual(["NewChar"]);
      expect(mockElectronAPI.setSettings).toHaveBeenCalledWith({
        customCharacters: ["NewChar"],
      });
    });

    it("should not add empty or whitespace-only character", async () => {
      const success = await addCustomCharacter("   ");

      expect(success).toBe(false);
      expect(settingsState.customCharacters).toEqual([]);
      expect(mockElectronAPI.setSettings).not.toHaveBeenCalled();
    });

    it("should not add duplicate character (presets case)", async () => {
      // "いのり" is in CHARACTER_PRESETS
      const success = await addCustomCharacter("いのり");

      expect(success).toBe(false);
      expect(settingsState.customCharacters).toEqual([]);
    });

    it("should not add duplicate character (custom case)", async () => {
      settingsState.customCharacters = ["Custom1"];
      const success = await addCustomCharacter("Custom1");

      expect(success).toBe(false);
      expect(settingsState.customCharacters).toEqual(["Custom1"]);
    });

    it("should remove custom character", async () => {
      settingsState.customCharacters = ["Char1", "Char2"];
      mockElectronAPI.setSettings.mockResolvedValue(true);

      await removeCustomCharacter("Char1");

      expect(settingsState.customCharacters).toEqual(["Char2"]);
      expect(mockElectronAPI.setSettings).toHaveBeenCalledWith({
        customCharacters: ["Char2"],
      });
    });
  });

  describe("custom tag management", () => {
    it("should add a valid new custom tag", async () => {
      mockElectronAPI.setSettings.mockResolvedValue(true);

      const success = await addCustomTag("  NewTag  ");

      expect(success).toBe(true);
      expect(settingsState.customTags).toEqual(["NewTag"]);
      expect(mockElectronAPI.setSettings).toHaveBeenCalledWith({
        customTags: ["NewTag"],
      });
    });

    it("should not add duplicate tag", async () => {
      settingsState.customTags = ["Tag1"];
      const success = await addCustomTag("Tag1");

      expect(success).toBe(false);
      expect(settingsState.customTags).toEqual(["Tag1"]);
    });

    it("should remove custom tag", async () => {
      settingsState.customTags = ["Tag1", "Tag2"];
      mockElectronAPI.setSettings.mockResolvedValue(true);

      await removeCustomTag("Tag1");

      expect(settingsState.customTags).toEqual(["Tag2"]);
      expect(mockElectronAPI.setSettings).toHaveBeenCalledWith({
        customTags: ["Tag2"],
      });
    });
  });
});

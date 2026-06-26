/// <reference types="vitest/browser" />
import { page } from "vite-plus/test/browser";
import { describe, it } from "vite-plus/test";
import { expect } from "vitest";
import { render } from "vitest-browser-svelte";
import Page from "./+page.svelte";

if (typeof window !== "undefined" && !window.electronAPI) {
  window.electronAPI = {
    getSettings: async () => ({
      folderPath: "",
      itemImageFolderPath: "",
      customCharacters: [],
      customTags: [],
      autoUpdateCheck: true,
      debugMode: false,
    }),
    setSettings: async () => true,
    aipriGetAccounts: async () => ({
      accounts: [],
      activeAccountId: null,
      activeAccountName: null,
    }),
  } as any;
}

describe("/+page.svelte", () => {
  it("should render folder selection prompt when no folder is selected", async () => {
    render(Page);

    const message = page.getByText("フォルダを選択して画像を表示");
    await expect.element(message).toBeInTheDocument();
  });
});

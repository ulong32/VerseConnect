<script lang="ts">
  import { beforeNavigate, goto } from "$app/navigation";
  import {
    addCustomCharacter,
    addCustomTag,
    CHARACTER_PRESETS,
    loadSettings,
    removeCustomCharacter,
    removeCustomTag,
    selectFolder,
    selectItemImageFolder,
    settingsState,
    setAutoUpdateCheck,
    setDebugMode,
  } from "$lib/stores/settings.svelte";
  import {
    checkForUpdates,
    quitAndInstall,
    updateState,
  } from "$lib/stores/update.svelte";
  import favicon from "$lib/assets/favicon.png";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import FolderIcon from "@lucide/svelte/icons/folder";
  import FolderOpenIcon from "@lucide/svelte/icons/folder-open";
  import ImageIcon from "@lucide/svelte/icons/image";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import TagIcon from "@lucide/svelte/icons/tag";
  import UserPlusIcon from "@lucide/svelte/icons/user-plus";
  import UsersIcon from "@lucide/svelte/icons/users";
  import XIcon from "@lucide/svelte/icons/x";
  import InfoIcon from "@lucide/svelte/icons/info";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import CheckIcon from "@lucide/svelte/icons/check";
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import { onMount } from "svelte";
  import { fade, fly } from "svelte/transition";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";

  // Track if navigating to root for conditional out transition
  let navigatingToRoot = $state(false);

  beforeNavigate(({ to }) => {
    navigatingToRoot = to?.url.pathname === "/";
  });

  let newCharacterInput = $state("");
  let newTagInput = $state("");
  let isHovered = $state(false);
  let isLoading = $state(true);

  let justChecked = $state(false);
  let prevStatus = "idle";

  $effect(() => {
    const currentStatus = updateState.status;
    if (prevStatus === "checking" && currentStatus === "idle") {
      justChecked = true;
      setTimeout(() => {
        justChecked = false;
      }, 4000);
    }
    prevStatus = currentStatus;
  });

  onMount(async () => {
    await loadSettings();
    isLoading = false;
  });

  async function handleSelectFolder() {
    await selectFolder();
  }

  async function handleToggleAutoUpdate(checked: boolean) {
    await setAutoUpdateCheck(checked);
  }

  async function handleToggleDebugMode(checked: boolean) {
    await setDebugMode(checked);
  }

  async function handleCheckForUpdates() {
    justChecked = false;
    await checkForUpdates();
  }

  async function handleSelectItemImageFolder() {
    await selectItemImageFolder();
  }

  async function handleAddCharacter() {
    const success = await addCustomCharacter(newCharacterInput);
    if (success) {
      newCharacterInput = "";
    }
  }

  async function handleRemoveCharacter(name: string) {
    await removeCustomCharacter(name);
  }

  async function handleAddTag() {
    const success = await addCustomTag(newTagInput);
    if (success) {
      newTagInput = "";
    }
  }

  async function handleRemoveTag(name: string) {
    await removeCustomTag(name);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      handleAddCharacter();
    }
  }

  function handleTagKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      handleAddTag();
    }
  }
</script>

<div
  class="bg-linear-to-br from-[#1a1a2e] to-[#16213e] p-6"
  in:fly={{ duration: 250, y: "10vh", opacity: 0 }}
  out:fly={{ duration: navigatingToRoot ? 250 : 0, y: "10vh", opacity: 0 }}
>
  <div class="max-w-2xl mx-auto">
    <!-- Header -->
    <div class="flex items-center align-center gap-4 mb-8">
      <button onclick={() => goto("/")}>
        <ArrowLeftIcon class="size-8 text-white bg-white/10 rounded-lg p-1" />
      </button>
      <h1 class="text-2xl font-bold text-white">設定</h1>
    </div>

    {#if isLoading}
      <div class="flex items-center justify-center h-48 text-gray-500 text-xl">
        読み込み中...
      </div>
    {:else}
      <!-- Folder Settings Section -->
      <section class="mb-8">
        <h2
          class="text-lg font-semibold text-white mb-4 flex items-center gap-2"
        >
          <FolderIcon class="size-5 text-purple-400" />
          フォルダ設定
        </h2>
        <div class="bg-white/5 rounded-xl p-4 backdrop-blur-sm">
          <div class="flex items-center gap-3">
            <button
              class="px-4 py-2 bg-linear-to-r from-indigo-500 to-purple-600 border-none rounded-lg text-white font-semibold cursor-pointer transition-all whitespace-nowrap hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/40"
              onclick={handleSelectFolder}
              onmouseenter={() => (isHovered = true)}
              onmouseleave={() => (isHovered = false)}
            >
              <div class="flex items-center gap-2">
                {#if isHovered}
                  <FolderOpenIcon class="size-5" />
                {:else}
                  <FolderIcon class="size-5" />
                {/if}
                フォルダを選択
              </div>
            </button>
            {#if settingsState.folderPath}
              <span
                class="text-gray-400 text-sm overflow-hidden text-ellipsis whitespace-nowrap flex-1"
                title={settingsState.folderPath}
              >
                {settingsState.folderPath}
              </span>
            {:else}
              <span class="text-gray-500 italic"
                >フォルダが選択されていません</span
              >
            {/if}
          </div>

          <!-- Item Image Folder -->
          <div
            class="flex items-center gap-3 mt-4 pt-4 border-t border-white/10"
          >
            <button
              class="px-4 py-2 bg-linear-to-r from-pink-500 to-rose-600 border-none rounded-lg text-white font-semibold cursor-pointer transition-all whitespace-nowrap hover:-translate-y-0.5 hover:shadow-lg hover:shadow-pink-500/40"
              onclick={handleSelectItemImageFolder}
            >
              <div class="flex items-center gap-2">
                <ImageIcon class="size-5" />
                アイテム画像フォルダ
              </div>
            </button>
            {#if settingsState.itemImageFolderPath}
              <span
                class="text-gray-400 text-sm overflow-hidden text-ellipsis whitespace-nowrap flex-1"
                title={settingsState.itemImageFolderPath}
              >
                {settingsState.itemImageFolderPath}
              </span>
            {:else}
              <span class="text-gray-500 italic"
                >フォルダが選択されていません</span
              >
            {/if}
          </div>

          <!-- Auto Update Check Preference -->
          <div
            class="flex items-center justify-between mt-4 pt-4 border-t border-white/10"
          >
            <div class="flex flex-col">
              <span class="text-sm text-white"
                >起動時にアプリのアップデートを確認</span
              >
            </div>
            <label
              class="relative inline-flex items-center cursor-pointer select-none"
            >
              <input
                type="checkbox"
                class="sr-only peer"
                checked={settingsState.autoUpdateCheck}
                onchange={(e) =>
                  handleToggleAutoUpdate(e.currentTarget.checked)}
              />
              <div
                class="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"
              ></div>
            </label>
          </div>

          {#if import.meta.env.DEV}
            <!-- Debug Mode Preference -->
            <div
              class="flex items-center justify-between mt-4 pt-4 border-t border-white/10"
            >
              <div class="flex flex-col">
                <span class="text-sm text-white"
                  >アップデートシミュレーション (デバッグモード)</span
                >
                <span class="text-xs text-gray-400"
                  >アップデート確認ボタンの動作時に模擬シーケンスを走らせます</span
                >
              </div>
              <label
                class="relative inline-flex items-center cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  class="sr-only peer"
                  checked={settingsState.debugMode}
                  onchange={(e) =>
                    handleToggleDebugMode(e.currentTarget.checked)}
                />
                <div
                  class="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"
                ></div>
              </label>
            </div>
          {/if}
        </div>
      </section>

      <!-- Character Management Section -->
      <section class="mb-8">
        <h2
          class="text-lg font-semibold text-white mb-4 flex items-center gap-2"
        >
          <UsersIcon class="size-5 text-purple-400" />
          キャラクター管理
        </h2>

        <!-- Preset Characters -->
        <div class="bg-white/5 rounded-xl p-4 backdrop-blur-sm mb-4">
          <h3 class="text-sm font-medium text-gray-400 mb-3">
            プリセットキャラクター
          </h3>
          <div class="flex flex-wrap gap-2">
            {#each CHARACTER_PRESETS as char}
              <span
                class="px-3 py-1.5 bg-purple-600/30 text-purple-200 rounded-full text-sm"
              >
                {char}
              </span>
            {/each}
          </div>
        </div>

        <!-- Custom Characters -->
        <div class="bg-white/5 rounded-xl p-4 backdrop-blur-sm">
          <h3 class="text-sm font-medium text-gray-400 mb-3">
            カスタムキャラクター
          </h3>

          <!-- Add new character -->
          <div class="flex gap-2 mb-4">
            <input
              type="text"
              class="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
              placeholder="新しいキャラクター名"
              bind:value={newCharacterInput}
              onkeydown={handleKeydown}
            />
            <button
              class="px-4 py-2 bg-linear-to-r from-green-500 to-emerald-600 border-none rounded-lg text-white font-semibold cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-green-500/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              onclick={handleAddCharacter}
              disabled={!newCharacterInput.trim()}
            >
              <div class="flex items-center gap-2">
                <UserPlusIcon class="size-5" />
                追加
              </div>
            </button>
          </div>

          <!-- Custom character list -->
          {#if settingsState.customCharacters.length === 0}
            <p class="text-gray-500 italic text-sm">
              カスタムキャラクターはまだありません
            </p>
          {:else}
            <div class="flex flex-wrap gap-2">
              {#each settingsState.customCharacters as char}
                <div
                  class="flex items-center gap-1 px-3 py-1.5 bg-indigo-600/30 text-indigo-200 rounded-full text-sm group"
                >
                  <span>{char}</span>
                  <button
                    class="ml-1 p-0.5 rounded-full hover:bg-red-500/50 transition-colors opacity-60 hover:opacity-100"
                    onclick={() => handleRemoveCharacter(char)}
                    title="削除"
                  >
                    <XIcon class="size-3.5" />
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </section>

      <!-- Tag Management Section -->
      <section>
        <h2
          class="text-lg font-semibold text-white mb-4 flex items-center gap-2"
        >
          <TagIcon class="size-5 text-teal-400" />
          タグ管理
        </h2>

        <div class="bg-white/5 rounded-xl p-4 backdrop-blur-sm">
          <h3 class="text-sm font-medium text-gray-400 mb-3">カスタムタグ</h3>

          <!-- Add new tag -->
          <div class="flex gap-2 mb-4">
            <input
              type="text"
              class="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-teal-500 transition-colors"
              placeholder="新しいタグ名"
              bind:value={newTagInput}
              onkeydown={handleTagKeydown}
            />
            <button
              class="px-4 py-2 bg-linear-to-r from-teal-500 to-cyan-600 border-none rounded-lg text-white font-semibold cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-500/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              onclick={handleAddTag}
              disabled={!newTagInput.trim()}
            >
              <div class="flex items-center gap-2">
                <PlusIcon class="size-5" />
                追加
              </div>
            </button>
          </div>

          <!-- Custom tag list -->
          {#if settingsState.customTags.length === 0}
            <p class="text-gray-500 italic text-sm">
              カスタムタグはまだありません
            </p>
          {:else}
            <div class="flex flex-wrap gap-2">
              {#each settingsState.customTags as tag}
                <div
                  class="flex items-center gap-1 px-3 py-1.5 bg-teal-600/30 text-teal-200 rounded-full text-sm group"
                >
                  <span>{tag}</span>
                  <button
                    class="ml-1 p-0.5 rounded-full hover:bg-red-500/50 transition-colors opacity-60 hover:opacity-100"
                    onclick={() => handleRemoveTag(tag)}
                    title="削除"
                  >
                    <XIcon class="size-3.5" />
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </section>

      <!-- Version & Update Section -->
      <section class="mt-8 border-t border-white/10 pt-8">
        <h2
          class="text-lg font-semibold text-white mb-4 flex items-center gap-2"
        >
          <InfoIcon class="size-5 text-indigo-400" />
          バージョン情報
        </h2>
        <div
          class="bg-white/5 rounded-xl p-4 backdrop-blur-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div class="flex items-center gap-4">
            <img src={favicon} alt="Favicon" class="size-12 select-none" />
            <div>
              <h3 class="text-md font-semibold text-white">VerseConnect</h3>
              <p class="text-sm text-gray-400">
                現在のバージョン: <span
                  class="text-purple-300 font-mono font-bold"
                  >v{updateState.currentVersion || "--"}</span
                >
                {#if updateState.newVersion}
                  <ArrowRightIcon size={16} class="inline-block" />
                  <span class="text-pink-300 font-mono font-bold"
                    >v{updateState.newVersion}</span
                  >
                {/if}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            {#if updateState.status === "checking"}
              <div class="flex items-center gap-2 text-sm text-indigo-300">
                <RefreshCwIcon class="size-4 animate-spin" />
                <span>アップデートを確認中...</span>
              </div>
            {:else if updateState.status === "available"}
              <div class="flex items-center gap-2 text-sm text-purple-300">
                <InfoIcon class="size-4 animate-pulse" />
                <span
                  >v{updateState.newVersion} が利用可能です。ダウンロード中…</span
                >
              </div>
            {:else if updateState.status === "downloading"}
              <div class="flex flex-col items-end gap-1">
                <div class="text-xs text-indigo-300">
                  ダウンロード中: {updateState.progress}%
                </div>
                <div
                  class="w-32 bg-white/10 rounded-full h-1.5 overflow-hidden"
                >
                  <div
                    class="bg-linear-to-r from-purple-500 to-indigo-500 h-1.5 rounded-full"
                    style="width: {updateState.progress}%"
                  ></div>
                </div>
              </div>
            {:else if updateState.status === "downloaded"}
              <button
                class="px-4 py-2 bg-linear-to-r from-purple-500 to-pink-500 border-none rounded-lg text-white font-semibold cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-500/30"
                onclick={quitAndInstall}
              >
                <div class="flex items-center gap-2">
                  <RefreshCwIcon class="size-4" />
                  再起動して適用
                </div>
              </button>
            {:else}
              <!-- Idle or error status -->
              {#if justChecked}
                <span
                  class="text-sm text-emerald-400 flex items-center gap-1.5"
                  in:fade
                >
                  <CheckIcon class="size-4" />
                  最新バージョンです
                </span>
              {/if}
              <button
                class="px-4 py-2 bg-linear-to-r from-indigo-500 to-purple-600 border-none rounded-lg text-white font-semibold cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/40"
                onclick={handleCheckForUpdates}
              >
                <div class="flex items-center gap-2">
                  <RefreshCwIcon class="size-4" />
                  アップデートを確認
                </div>
              </button>
            {/if}
          </div>
        </div>
        {#if updateState.status === "error" && updateState.errorMessage}
          <p class="text-xs text-rose-400 mt-2 text-right">
            {updateState.errorMessage}
          </p>
        {/if}
      </section>
    {/if}
  </div>
</div>

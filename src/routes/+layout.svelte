<script lang="ts">
  import { logger } from "$lib/utils/logger";

  import { goto } from "$app/navigation";
  import faviconPng from "$lib/assets/favicon.png";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import CopyrightIcon from "@lucide/svelte/icons/copyright";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import MinusIcon from "@lucide/svelte/icons/minus";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import SquareIcon from "@lucide/svelte/icons/square";
  import XIcon from "@lucide/svelte/icons/x";
  import { Avatar, Portal, Tooltip } from "@skeletonlabs/skeleton-svelte";
  import "./layout.css";
  import LuminaPng from "./lumina.png";
  import { fade, fly } from "svelte/transition";
  import { onMount } from "svelte";
  import {
    initUpdateListeners,
    updateState,
    quitAndInstall,
  } from "$lib/stores/update.svelte";
  import InfoIcon from "@lucide/svelte/icons/info";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import AlertCircleIcon from "@lucide/svelte/icons/alert-circle";

  let { children } = $props();

  onMount(() => {
    const cleanup = initUpdateListeners();
    return cleanup;
  });

  // Konami Code: ↑↑↓↓←→←→BA
  const konamiCode = [
    "ArrowUp",
    "ArrowUp",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowLeft",
    "ArrowRight",
    "KeyB",
    "KeyA",
  ];
  let inputSequence: string[] = $state([]);
  let isSpinning = $state(false);
  let skipTransition = $state(false);

  // Scroll to top state
  let showScrollTop = $state(false);
  let scrollContainer: HTMLElement | null = $state(null);
  function scrollToTop() {
    scrollContainer?.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Scroll listener on container element
  $effect(() => {
    logger.log(scrollContainer);
    if (!scrollContainer) return;
    const handleScroll = () => {
      showScrollTop = scrollContainer!.scrollTop > 300;
    };

    scrollContainer.addEventListener("scroll", handleScroll);
    return () => scrollContainer?.removeEventListener("scroll", handleScroll);
  });

  $effect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      inputSequence = [...inputSequence, e.code].slice(-konamiCode.length);

      if (
        inputSequence.length === konamiCode.length &&
        inputSequence.every((key, i) => key === konamiCode[i])
      ) {
        isSpinning = true;
        inputSequence = [];
        // Reset after animation completes
        setTimeout(() => {
          skipTransition = true;
          isSpinning = false;
          // Re-enable transition after reset
          requestAnimationFrame(() => {
            skipTransition = false;
          });
        }, 500);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });
</script>

<header
  class="bg-surface-100-900 h-8 fixed w-full z-40 top-0"
  style="-webkit-app-region: drag;"
>
  <nav class="flex items-center justify-between h-full">
    <div class="ml-1 flex items-center gap-2">
      <img
        src={faviconPng}
        alt="VerseConnect"
        class="size-5 rounded-full transition-transform duration-500 hover:rotate-20 hover:scale-125 transform-gpu {isSpinning
          ? 'rotate-360'
          : ''} {skipTransition ? 'transition-none' : ''}"
      />
      <span class="font-medium text-md font-mplus-rounded text-pink-100"
        >VerseConnect</span
      >
    </div>
    <div class="flex items-center">
      <button
        class="flex items-center p-2 hover:bg-surface-200-800 rounded-lg transition-colors"
        onclick={() => goto("/import")}
        style="-webkit-app-region: no-drag;"
      >
        <Tooltip positioning={{ placement: "bottom" }}>
          <Tooltip.Trigger>
            <DownloadIcon class="size-4" />
          </Tooltip.Trigger>
          <Portal>
            <Tooltip.Positioner>
              <Tooltip.Content
                class="bg-surface-100-900 text-white p-1 rounded-lg text-xs"
              >
                <Tooltip.Arrow
                  class="[--arrow-size:--spacing(2)] [--arrow-background:var(--color-surface-100-900)]"
                >
                  <Tooltip.ArrowTip />
                </Tooltip.Arrow>
                インポート
              </Tooltip.Content>
            </Tooltip.Positioner>
          </Portal>
        </Tooltip>
      </button>
      <button
        class="flex items-center p-2 hover:bg-surface-200-800 rounded-lg transition-colors"
        onclick={() => goto("/settings")}
        style="-webkit-app-region: no-drag;"
      >
        <Tooltip positioning={{ placement: "bottom" }}>
          <Tooltip.Trigger>
            <SettingsIcon class="size-4" />
          </Tooltip.Trigger>
          <Portal>
            <Tooltip.Positioner>
              <Tooltip.Content
                class="bg-surface-100-900 text-white p-1 rounded-lg text-xs"
              >
                <Tooltip.Arrow
                  class="[--arrow-size:--spacing(2)] [--arrow-background:var(--color-surface-100-900)]"
                >
                  <Tooltip.ArrowTip />
                </Tooltip.Arrow>
                設定
              </Tooltip.Content>
            </Tooltip.Positioner>
          </Portal>
        </Tooltip>
      </button>
      <!-- Window Controls -->
      <div class="flex items-center ml-1 border-l border-surface-500/30 pl-1">
        <button
          class="flex items-center justify-center size-8 hover:bg-surface-200-800 transition-colors"
          onclick={() => window.electronAPI?.windowMinimize()}
          style="-webkit-app-region: no-drag;"
          aria-label="最小化"
        >
          <MinusIcon class="size-4.5" />
        </button>
        <button
          class="flex items-center justify-center size-8 hover:bg-surface-200-800 transition-colors"
          onclick={() => window.electronAPI?.windowMaximize()}
          style="-webkit-app-region: no-drag;"
          aria-label="最大化"
        >
          <SquareIcon class="size-3.5" />
        </button>
        <button
          class="flex items-center justify-center size-8 hover:bg-red-600 transition-colors"
          onclick={() => window.electronAPI?.windowClose()}
          style="-webkit-app-region: no-drag;"
          aria-label="閉じる"
        >
          <XIcon class="size-4.5" />
        </button>
      </div>
    </div>
  </nav>
</header>
<svelte:head><link rel="icon" href={faviconPng} /></svelte:head>
<div class="flex flex-col w-full mt-8 min-h-screen">
  <main class="flex-1" bind:this={scrollContainer}>
    {@render children()}
  </main>
  <footer>
    <div
      class="p-4 bg-surface-100-900 w-full flex flex-col items-center justify-center"
    >
      <div class="flex items-center gap-1 text-xl font-mplus-rounded">
        VerseConnect
      </div>
      <div class="flex items-center gap-1 text-xs text-gray-400">
        <CopyrightIcon class="size-2.5 ml-1 rotate-[0.03deg]" />
        2026 ulong32. Assisted by
        <span
          class="bg-linear-to-br from-violet-300 to-sky-300 bg-clip-text text-transparent"
          >Lumina</span
        >
        <Avatar class="size-6 bg-transparent">
          <Avatar.Image src={LuminaPng} />
          <Avatar.Fallback>L</Avatar.Fallback>
        </Avatar>.
      </div>
    </div>
  </footer>
</div>

<!-- Floating Auto-updater Banner (Bottom Left) -->
{#if updateState.status === "downloading" || updateState.status === "downloaded" || (updateState.status === "error" && updateState.errorMessage)}
  <div
    class="fixed bottom-6 left-6 max-w-sm w-80 bg-[#1e1e2e]/95 border border-purple-500/30 rounded-xl p-4 shadow-2xl backdrop-blur-md z-50 overflow-hidden"
    in:fly={{ y: 50, duration: 400 }}
    out:fade={{ duration: 250 }}
  >
    <!-- Neon glow line -->
    <div
      class="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-purple-500 via-indigo-500 to-pink-500"
    ></div>

    <div class="flex items-start gap-3">
      {#if updateState.status === "downloading"}
        <div
          class="p-2 bg-indigo-500/20 text-indigo-300 rounded-lg animate-pulse"
        >
          <DownloadIcon class="size-5" />
        </div>
        <div class="flex-1">
          <h4 class="text-sm font-semibold text-white">
            アップデートをダウンロード中
          </h4>
          <p class="text-xs text-gray-400 mt-0.5">
            VerseConnect v{updateState.newVersion}
          </p>

          <!-- Progress bar -->
          <div
            class="w-full bg-white/10 rounded-full h-1.5 mt-3 overflow-hidden"
          >
            <div
              class="bg-linear-to-r from-purple-500 to-indigo-500 h-1.5 rounded-full transition-all duration-300"
              style="width: {updateState.progress}%"
            ></div>
          </div>
          <div class="flex justify-between items-center mt-1.5">
            <span class="text-[10px] text-gray-500">進捗状況</span>
            <span class="text-xs font-semibold text-indigo-300"
              >{updateState.progress}%</span
            >
          </div>
        </div>
      {:else if updateState.status === "downloaded"}
        <div class="p-2 bg-emerald-500/20 text-emerald-300 rounded-lg">
          <InfoIcon class="size-5" />
        </div>
        <div class="flex-1">
          <h4 class="text-sm font-semibold text-white">アップデート準備完了</h4>
          <p class="text-xs text-gray-400 mt-0.5">
            新しいバージョン v{updateState.newVersion} がダウンロードされました。
          </p>

          <div class="flex gap-2 mt-4">
            <button
              class="flex-1 px-3 py-1.5 bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 border-none rounded-lg text-white text-xs font-semibold cursor-pointer transition-all hover:scale-102 hover:shadow-lg hover:shadow-purple-500/30"
              onclick={quitAndInstall}
            >
              <div class="flex items-center justify-center gap-1.5">
                <RefreshCwIcon class="size-3.5" />
                再起動して更新
              </div>
            </button>
            <button
              class="px-3 py-1.5 bg-white/10 hover:bg-white/20 border-none rounded-lg text-gray-300 text-xs font-semibold cursor-pointer transition-all"
              onclick={() => {
                updateState.status = "idle";
              }}
            >
              閉じる
            </button>
          </div>
        </div>
      {:else if updateState.status === "error"}
        <div class="p-2 bg-rose-500/20 text-rose-300 rounded-lg">
          <AlertCircleIcon class="size-5" />
        </div>
        <div class="flex-1">
          <h4 class="text-sm font-semibold text-white">アップデートエラー</h4>
          <p class="text-xs text-rose-300 mt-0.5 line-clamp-3">
            {updateState.errorMessage}
          </p>
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- Scroll to Top Button -->
{#if showScrollTop}
  <button
    class="fixed bottom-6 right-6 size-12 bg-purple-600/50 hover:bg-purple-500 text-white rounded-full shadow-lg shadow-purple-600/30 flex items-center justify-center transition-all hover:scale-110 z-40"
    onclick={scrollToTop}
    aria-label="ページトップに戻る"
  >
    <ArrowUpIcon class="size-5" />
  </button>
{/if}

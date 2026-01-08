<script lang="ts">
	import './layout.css';
	import faviconPng from '$lib/assets/favicon.png';
	import { SettingsIcon, DownloadIcon, CopyrightIcon, MinusIcon, SquareIcon, XIcon, ArrowUpIcon } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { Portal, Tooltip, Avatar } from '@skeletonlabs/skeleton-svelte';
	import LuminaPng from './lumina.png';
	let { children } = $props();

	// Konami Code: ↑↑↓↓←→←→BA
	const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
	let inputSequence: string[] = $state([]);
	let isSpinning = $state(false);
	let skipTransition = $state(false);

	// Scroll to top state
	let showScrollTop = $state(false);
	let scrollContainer: HTMLElement | null = $state(null);
	function scrollToTop() {
		scrollContainer?.scrollTo({ top: 0, behavior: 'smooth' });
	}

	// Scroll listener on container element
	$effect(() => {
		console.log(scrollContainer);
		if (!scrollContainer) return;
		const handleScroll = () => {
			showScrollTop = scrollContainer!.scrollTop > 300;
		};

		scrollContainer.addEventListener('scroll', handleScroll);
		return () => scrollContainer?.removeEventListener('scroll', handleScroll);
	});

	$effect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			inputSequence = [...inputSequence, e.code].slice(-konamiCode.length);

			if (inputSequence.length === konamiCode.length &&
				inputSequence.every((key, i) => key === konamiCode[i])) {
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

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	});
</script>
<header class="bg-surface-100-900 h-8 fixed w-full z-40 top-0" style="-webkit-app-region: drag;">
	<nav class="flex items-center justify-between px-1 h-full">
		<div class="ml-0.5 flex items-center gap-2">
			<img src={faviconPng} alt="VerseConnect" class="w-5 h-5 rounded-full transition-transform duration-500 hover:rotate-20 hover:scale-125 transform-gpu {isSpinning ? 'rotate-[360deg]' : ''} {skipTransition ? 'transition-none' : ''}">
			<span class="font-medium text-md font-mplus-rounded text-pink-100">VerseConnect</span>
		</div>
		<div class="flex items-center">
			<button class="flex items-center p-2 hover:bg-surface-200-800 rounded-lg transition-colors" onclick={() => goto('/import')} style="-webkit-app-region: no-drag;">
				<Tooltip positioning={{placement: 'bottom'}}>
					<Tooltip.Trigger>
						<DownloadIcon class="w-4 h-4" />
					</Tooltip.Trigger>
					<Portal>
						<Tooltip.Positioner>
							<Tooltip.Content class="bg-surface-100-900 text-white p-1 rounded-lg text-xs">
								<Tooltip.Arrow class="[--arrow-size:--spacing(2)] [--arrow-background:var(--color-surface-100-900)]">
									<Tooltip.ArrowTip />
								</Tooltip.Arrow>
								インポート
							</Tooltip.Content>
						</Tooltip.Positioner>
					</Portal>
				</Tooltip>
			</button>
			<button class="flex items-center p-2 hover:bg-surface-200-800 rounded-lg transition-colors" onclick={() => goto('/settings')} style="-webkit-app-region: no-drag;">
				<Tooltip positioning={{placement: 'bottom'}}>
					<Tooltip.Trigger>
						<SettingsIcon class="w-4 h-4" />
					</Tooltip.Trigger>
					<Portal>
						<Tooltip.Positioner>
							<Tooltip.Content class="bg-surface-100-900 text-white p-1 rounded-lg text-xs">
								<Tooltip.Arrow class="[--arrow-size:--spacing(2)] [--arrow-background:var(--color-surface-100-900)]">
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
					class="flex items-center justify-center w-8 h-8 hover:bg-surface-200-800 transition-colors" 
					onclick={() => window.electronAPI?.windowMinimize()} 
					style="-webkit-app-region: no-drag;"
					aria-label="最小化"
				>
					<MinusIcon class="w-4.5 h-4.5" />
				</button>
				<button 
					class="flex items-center justify-center w-8 h-8 hover:bg-surface-200-800 transition-colors" 
					onclick={() => window.electronAPI?.windowMaximize()} 
					style="-webkit-app-region: no-drag;"
					aria-label="最大化"
				>
					<SquareIcon class="w-3.5 h-3.5" />
				</button>
				<button 
					class="flex items-center justify-center w-8 h-8 hover:bg-red-600 transition-colors"
					onclick={() => window.electronAPI?.windowClose()} 
					style="-webkit-app-region: no-drag;"
					aria-label="閉じる"
				>
					<XIcon class="w-4.5 h-4.5" />
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
	<div class="p-4 bg-surface-100-900 w-full flex flex-col items-center justify-center">
		<div class="flex items-center gap-1 text-xl font-mplus-rounded">VerseConnect</div>
		<div class="flex items-center gap-1 text-xs text-gray-400">
			<CopyrightIcon class="size-2.5 ml-1 rotate-[0.03deg]" />
			2026 ulong32. Assisted by <span class="bg-gradient-to-br from-violet-300 to-sky-300 bg-clip-text text-transparent">Lumina</span>
			<Avatar class="size-6 bg-transparent">
				<Avatar.Image src={LuminaPng} />
				<Avatar.Fallback>
					L
				</Avatar.Fallback>
			</Avatar>.
		</div>
	</div>
</footer>
</div>

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

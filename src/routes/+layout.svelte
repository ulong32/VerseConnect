<script lang="ts">
	import './layout.css';
	import faviconPng from '$lib/assets/favicon.png';
	import { SettingsIcon, DownloadIcon, CopyrightIcon } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { Portal, Tooltip, Avatar } from '@skeletonlabs/skeleton-svelte';
	import LuminaPng from './lumina.png';
	let { children } = $props();

	// Konami Code: ↑↑↓↓←→←→BA
	const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
	let inputSequence: string[] = $state([]);
	let isSpinning = $state(false);
	let skipTransition = $state(false);

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
<header class="bg-surface-100-900 h-[env(titlebar-area-height)] fixed w-[env(titlebar-area-width)] z-50 top-0" style="-webkit-app-region: drag;">
	<nav class="flex items-center justify-between px-1">
		<div class="ml-0.5 flex items-center gap-2">
			<img src={faviconPng} alt="VerseConnect" class="w-5 h-5 rounded-full transition-transform duration-500 hover:rotate-20 hover:scale-125 transform-gpu {isSpinning ? 'rotate-[360deg]' : ''} {skipTransition ? 'transition-none' : ''}">
			<span class="font-medium text-md font-mplus-rounded text-pink-100">VerseConnect</span>
		</div>
		<div class="flex items-center gap-1">
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
		</div>
	</nav>
</header>
<svelte:head><link rel="icon" href={faviconPng} /></svelte:head>
<div class="flex flex-col w-full pt-[env(titlebar-area-height)] min-h-screen">
	<main class="flex-1">
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

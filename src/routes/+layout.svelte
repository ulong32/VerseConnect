<script lang="ts">
	import './layout.css';
	import faviconPng from '$lib/assets/favicon.png';
	import { SettingsIcon } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	let { children } = $props();
</script>
<header class="bg-surface-100-900 h-[env(titlebar-area-height)] fixed w-[env(titlebar-area-width)] z-50 top-0" style="-webkit-app-region: drag;">
	<nav class="flex items-center justify-between px-1">
		<button onclick={() => goto('/')} class="flex items-center gap-2" style="-webkit-app-region: no-drag;">
			<img src={faviconPng} alt="VerseConnect" class="w-5 h-5 rounded-full transition-transform duration-500 hover:rotate-20 hover:scale-125 transform-gpu">
			<span class="font-medium text-md">VerseConnect</span>
		</button>
		<button class="flex items-center p-2 hover:bg-surface-200-800 rounded-lg transition-colors" onclick={() => goto('/settings')} style="-webkit-app-region: no-drag;">
			<SettingsIcon class="w-4 h-4"/>
		</button>
	</nav>
</header>
<svelte:head><link rel="icon" href={faviconPng} /></svelte:head>
<div class="mt-[env(titlebar-area-height)]">
	{@render children()}
</div>



<script lang="ts">
	import './layout.css';
	import faviconPng from '$lib/assets/favicon.png';
	import { AppBar } from '@skeletonlabs/skeleton-svelte';
	import { SettingsIcon } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	let { children } = $props();
</script>
<AppBar>
	<AppBar.Toolbar class="grid-cols-[auto_1fr_auto] justify-center">
		<AppBar.Lead>
			<button onclick={() => goto('/')} class="flex items-center">
				<img src={faviconPng} alt="VerseConnect" class="w-7 h-7 rounded-full">
			</button>
		</AppBar.Lead>
		<AppBar.Headline><a href="/" class="font-medium text-xl ">VerseConnect</a></AppBar.Headline>
		<AppBar.Trail>
			<button class="flex items-center" onclick={() => goto('/settings')}>
				<SettingsIcon class="w-5 h-5"/>
			</button>
		</AppBar.Trail>
	</AppBar.Toolbar>
</AppBar>
<svelte:head><link rel="icon" href={faviconPng} /></svelte:head>
{@render children()}


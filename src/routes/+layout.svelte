<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { AppBar } from '@skeletonlabs/skeleton-svelte';

	let { children } = $props();
</script>
<AppBar>
	<AppBar.Headline>VerseConnect</AppBar.Headline>
</AppBar>
<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}

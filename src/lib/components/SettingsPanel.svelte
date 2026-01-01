<script lang="ts">
	import { FolderOpenIcon, FolderIcon, RotateCcwIcon } from '@lucide/svelte';
	interface Props {
		folderPath: string;
		onselect: () => void;
		onreload: () => void;
	}

	let { folderPath, onselect, onreload }: Props = $props();
	let isHovered = $state(false);
</script>

<div class="flex items-center gap-2 py-3 px-4 bg-white/5 rounded-xl mb-4 backdrop-blur-sm">
	<button 
		class="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 border-none rounded-lg text-white font-semibold cursor-pointer transition-all whitespace-nowrap hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/40"
		onclick={onselect}
		onmouseenter={() => isHovered = true}
		onmouseleave={() => isHovered = false}
	>
		<div class="flex items-center gap-2">
			{#if isHovered}
				<FolderOpenIcon />
			{:else}
				<FolderIcon />
			{/if}
			フォルダを選択
		</div>
	</button>
	{#if folderPath}
		<button 
			class="px-3 py-2 bg-white/10 hover:bg-white/20 border-none rounded-lg text-white cursor-pointer transition-all"
			onclick={onreload}
			title="再読み込み"
		>
			<RotateCcwIcon />
		</button>
		<span class="text-gray-400 text-sm overflow-hidden text-ellipsis whitespace-nowrap flex-1" title={folderPath}>{folderPath}</span>
	{:else}
		<span class="text-gray-500 italic">フォルダが選択されていません</span>
	{/if}
</div>

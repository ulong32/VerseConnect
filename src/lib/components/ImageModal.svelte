<script lang="ts">
	import MetadataEditor from './MetadataEditor.svelte';
	import { FolderOpenIcon, ArrowLeftRightIcon, PenIcon, XIcon, ArrowLeftIcon, ArrowRightIcon } from '@lucide/svelte';

	interface Props {
		selectedImage: ImageInfo;
		currentMetadata: ImageMetadata;
		allCharacters: string[];
		newCharacterInput: string;
		showMetadataEditor: boolean;
		selectedIndex: number;
		totalImages: number;
		folderPath: string;
		onclose: () => void;
		onprev: () => void;
		onnext: () => void;
		ontogglecharacter: (char: string) => void;
		onaddcharacter: () => void;
		onupdateitem: (value: string) => void;
		onsave: () => void;
		oninputchange: (value: string) => void;
		ontoggleeditor: () => void;
		onselectfriendcard: (file: File) => void;
	}

	let { 
		selectedImage,
		currentMetadata,
		allCharacters,
		newCharacterInput,
		showMetadataEditor,
		selectedIndex,
		totalImages,
		folderPath,
		onclose,
		onprev,
		onnext,
		ontogglecharacter,
		onaddcharacter,
		onupdateitem,
		onsave,
		oninputchange,
		ontoggleeditor,
		onselectfriendcard
	}: Props = $props();

	// Toggle between main image and friend card
	let showFriendCard = $state(false);

	// Compute friend card URL (properly encoded for Windows paths)
	let friendCardUrl = $derived(
		currentMetadata.friend_card && folderPath
			? `local-image://${encodeURIComponent(folderPath + '/friend_card/' + currentMetadata.friend_card)}`
			: null
	);

	// Current display image URL
	let displayUrl = $derived(
		showFriendCard && friendCardUrl ? friendCardUrl : selectedImage.url
	);

	function openInExplorer() {
		if (window.electronAPI && selectedImage.path) {
			window.electronAPI.showItemInFolder(selectedImage.path);
		}
	}

	function toggleFriendCard() {
		if (friendCardUrl) {
			showFriendCard = !showFriendCard;
		}
	}
</script>


<div 
	class="fixed inset-0 bg-black/95 flex items-start justify-center z-50 animate-fade-in overflow-y-auto py-8"
	onclick={onclose} 
	onkeydown={(e) => e.key === 'Escape' && onclose()} 
	role="dialog" 
	aria-modal="true" 
	aria-label="画像ビューア"
	tabindex="-1"
>

	<div
		class="relative max-w-[95vw] flex flex-col items-center my-auto" 
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
		role="presentation"
		aria-label="画像コンテンツ"
	>
		<img class="max-w-full max-h-[calc(95vh-60px)] p-12 object-contain rounded-lg" src={displayUrl} alt={selectedImage.name} />
		
		<div class="mt-4 text-white text-base text-center flex items-center gap-2">
			<span>{selectedImage.name}</span>
			<button 
				class="p-1 hover:bg-white/20 rounded transition-colors"
				onclick={openInExplorer}
				title="エクスプローラで開く"
			>
				<FolderOpenIcon class="w-4 h-4" />
			</button>
			{#if friendCardUrl}
				<button 
					class="p-1 hover:bg-white/20 rounded transition-colors {showFriendCard ? 'bg-purple-600/50' : ''}"
					onclick={toggleFriendCard}
					title="フレンドカードを表示"
				>
					<ArrowLeftRightIcon class="w-4 h-4" />
				</button>
			{/if}
		</div>
		
		{#if showFriendCard}
			<div class="mt-1 text-purple-400 text-xs">フレンドカード表示中</div>
		{/if}
		
		<!-- Metadata Display / Edit Button -->
		<div class="mt-3 flex flex-wrap gap-2 items-center">
			{#if currentMetadata.characters.length > 0}
				{#each currentMetadata.characters as char}
					<span class="px-2 py-1 bg-purple-600/50 text-white text-sm rounded-full">{char}</span>
				{/each}
			{/if}
			{#if currentMetadata.item}
				<span class="px-2 py-1 bg-blue-600/50 text-white text-sm rounded-lg">{currentMetadata.item}</span>
			{/if}
			<button 
				class="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
				onclick={ontoggleeditor}
			>
			{#if showMetadataEditor}
				<div class="flex items-center gap-1">
					<XIcon class="w-4 h-4" />
					<span>閉じる</span>
				</div>
			{:else}
				<div class="flex items-center gap-1">
					<PenIcon class="w-4 h-4" />
					<span>編集</span>
				</div>
			{/if}
			</button>
		</div>

		<!-- Metadata Editor Panel -->
		{#if showMetadataEditor}
			<MetadataEditor
				{allCharacters}
				{currentMetadata}
				{newCharacterInput}
				{ontogglecharacter}
				{onaddcharacter}
				{onupdateitem}
				{onsave}
				{oninputchange}
				{onselectfriendcard}
			/>
		{/if}
		
		<!-- Navigation buttons -->
		{#if selectedIndex > 0}
			<button 
				class="absolute left-0 top-1/2 -translate-y-1/2 p-2 bg-gray-500/30 hover:bg-gray-500/20 text-white rounded-full backdrop-blur transition-all"
				onclick={onprev}
			>
				<ArrowLeftIcon class="size-6" />
			</button>
		{/if}
		{#if selectedIndex < totalImages - 1}
			<button 
				class="absolute right-0 top-1/2 -translate-y-1/2 p-2 bg-gray-500/30 hover:bg-gray-500/20 text-white rounded-full backdrop-blur transition-all"
				onclick={onnext}
			>
				<ArrowRightIcon class="size-6" />
			</button>
		{/if}
		
		<!-- Close button -->
		<button 
			class="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur transition-all"
			onclick={onclose}
		>
			<XIcon class="size-6" />
		</button>
		
		<!-- Image counter -->
		<div class="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 px-3 py-1 bg-black/50 text-white text-sm rounded-full backdrop-blur">
			{selectedIndex + 1} / {totalImages}
		</div>
	</div>
</div>

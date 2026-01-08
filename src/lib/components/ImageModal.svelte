<script lang="ts">
	import { ArrowLeftIcon, ArrowLeftRightIcon, ArrowRightIcon, EyeIcon, EyeOffIcon, FolderOpenIcon, PenIcon, TagIcon, XIcon } from '@lucide/svelte';
	import { slide } from 'svelte/transition';
	import MetadataEditor from './MetadataEditor.svelte';

	interface Props {
		selectedImage: ImageInfo;
		currentMetadata: ImageMetadata;
		allCharacters: string[];
		allTags: string[];
		newCharacterInput: string;
		newTagInput: string;
		showMetadataEditor: boolean;
		selectedIndex: number;
		totalImages: number;
		folderPath: string;
		onclose: () => void;
		onprev: () => void;
		onnext: () => void;
		ontogglecharacter: (char: string) => void;
		ontoggletag: (tag: string) => void;
		onaddcharacter: () => void;
		onaddtag: () => void;
		onupdateitem: (value: string) => void;
		onsave: () => void;
		oninputchange: (value: string) => void;
		ontaginputchange: (value: string) => void;
		ontoggleeditor: () => void;
		onselectfriendcard: (file: File) => void;
	}

	let {
		selectedImage,
		currentMetadata,
		allCharacters,
		allTags,
		newCharacterInput,
		newTagInput,
		showMetadataEditor,
		selectedIndex,
		totalImages,
		folderPath,
		onclose,
		onprev,
		onnext,
		ontogglecharacter,
		ontoggletag,
		onaddcharacter,
		onaddtag,
		onupdateitem,
		onsave,
		oninputchange,
		ontaginputchange,
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

	// Toggle UI visibility
	let showUI = $state(true);

	function toggleUI() {
		showUI = !showUI;
	}

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
	class="fixed inset-0 bg-black/95 flex items-start justify-center z-40 animate-fade-in overflow-y-auto py-8"
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
		<img class="max-w-11/12 max-h-screen object-contain rounded-lg" src={displayUrl} alt={selectedImage.name} />

		{#if showUI}
			<div
				class="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 backdrop-blur rounded-lg transition-colors overflow-hidden w-fit"
			>
				<div class="w-max mx-auto flex flex-col items-center p-2">
					<!-- Metadata Editor Panel -->
					{#if showMetadataEditor}
						<div transition:slide={{ duration: 200, }}>
							<MetadataEditor
								{allCharacters}
								{allTags}
								{currentMetadata}
								{newCharacterInput}
								{newTagInput}
								{ontogglecharacter}
								{ontoggletag}
								{onaddcharacter}
								{onaddtag}
								{onupdateitem}
								{onsave}
								{oninputchange}
								{ontaginputchange}
								{onselectfriendcard}
							/>
						</div>
					{/if}
					<div class="text-white text-base text-center flex items-center justify-center gap-2 w-full">
						<span>{selectedImage.name}</span>
						<button
							class="p-1 hover:bg-white/20 rounded transition-colors"
							onclick={openInExplorer}
							title="エクスプローラで開く"
						>
							<FolderOpenIcon class="size-4" />
						</button>
						{#if friendCardUrl}
							<button
								class="p-1 hover:bg-white/20 rounded transition-colors {showFriendCard ? 'bg-purple-600/50' : ''}"
								onclick={toggleFriendCard}
								title="フレンドカードを表示"
							>
								<ArrowLeftRightIcon class="size-4" />
							</button>
						{/if}
					</div>

					{#if showFriendCard}
						<div class="mt-1 text-purple-400 text-xs">フレンドカード表示中</div>
					{/if}
					<!-- Metadata Display / Edit Button -->
					<div class="mt-2 flex flex-wrap justify-center gap-2 items-center w-full">
						{#if currentMetadata.characters.length > 0}
							{#each currentMetadata.characters as char}
								<span class="px-2 py-1 bg-purple-600/50 text-white text-sm rounded-full">{char}</span>
							{/each}
						{/if}
						{#if currentMetadata.item}
							<span class="px-2 py-1 bg-blue-600/50 text-white text-sm rounded-lg">{currentMetadata.item}</span>
						{/if}
						{#if currentMetadata.tags && currentMetadata.tags.length > 0}
							{#each currentMetadata.tags as tag}
								<span class="px-2 py-1 bg-teal-600/50 text-white text-sm rounded-full flex items-center gap-1">
									<TagIcon class="size-3" />{tag}
								</span>
							{/each}
						{/if}
						<button
							class="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
							onclick={ontoggleeditor}
						>
						{#if showMetadataEditor}
							<div class="flex items-center gap-1">
								<XIcon class="size-4" />
								<span>閉じる</span>
							</div>
						{:else}
							<div class="flex items-center gap-1">
								<PenIcon class="size-4" />
								<span>編集</span>
							</div>
						{/if}
						</button>
					</div>
				</div>
			</div>

			<!-- Navigation buttons -->
			{#if selectedIndex > 0}
				<button
					class="fixed left-6 top-1/2 -translate-y-1/2 p-2 bg-gray-500/30 hover:bg-gray-500/20 text-white rounded-full backdrop-blur transition-all"
					onclick={onprev}
				>
					<ArrowLeftIcon class="size-6" />
				</button>
			{/if}
			{#if selectedIndex < totalImages - 1}
				<button
					class="fixed right-6 top-1/2 -translate-y-1/2 p-2 bg-gray-500/30 hover:bg-gray-500/20 text-white rounded-full backdrop-blur transition-all"
					onclick={onnext}
				>
					<ArrowRightIcon class="size-6" />
				</button>
			{/if}

			<!-- Close button -->
			<button
				class="fixed top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur transition-all"
				onclick={onclose}
			>
				<XIcon class="size-6" />
			</button>

			<!-- Image counter -->
			<div class="fixed top-6 left-6 px-3 py-1 bg-black/50 text-white text-sm rounded-full backdrop-blur">
				{selectedIndex + 1} / {totalImages}
			</div>
		{/if}

		<!-- UI Toggle Button -->
		<button
			class="fixed bottom-6 right-6 p-2 bg-black/30 hover:bg-black/50 text-white rounded-full backdrop-blur transition-all z-50 group"
			onclick={toggleUI}
			title={showUI ? "UIを非表示" : "UIを表示"}
		>
			{#if showUI}
				<EyeOffIcon class="size-6 group-hover:scale-110 transition-transform" />
			{:else}
				<EyeIcon class="size-6 group-hover:scale-110 transition-transform" />
			{/if}
		</button>
	</div>
</div>

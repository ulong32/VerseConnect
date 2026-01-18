<script lang="ts">
	import { ArrowLeftIcon, ArrowLeftRightIcon, ArrowRightIcon, CopyCheckIcon, CopyIcon, EyeIcon, EyeOffIcon, FolderOpenIcon, PenIcon, TagIcon, XIcon } from '@lucide/svelte';
	import { slide, fade } from 'svelte/transition';
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

	// Compute friend card path and URL
	let friendCardPath = $derived(
		currentMetadata.friend_card && folderPath
			? folderPath + '/friend_card/' + currentMetadata.friend_card
			: null
	);

	let friendCardUrl = $derived(
		friendCardPath
			? `local-image://${encodeURIComponent(friendCardPath)}`
			: null
	);

	// Current display image URL and path
	let displayUrl = $derived(
		showFriendCard && friendCardUrl ? friendCardUrl : selectedImage.url
	);

	let displayPath = $derived(
		showFriendCard && friendCardPath ? friendCardPath : selectedImage.path
	);

	// Toggle UI visibility
	let showUI = $state(true);

	function toggleUI() {
		showUI = !showUI;
	}

	// Zoom and Pan state
	let imageScale = $state(1);
	let translateX = $state(0);
	let translateY = $state(0);
	let isDragging = $state(false);
	let dragStartX = $state(0);
	let dragStartY = $state(0);
	let lastTranslateX = $state(0);
	let lastTranslateY = $state(0);

	// Reset zoom/pan when image changes
	$effect(() => {
		displayUrl; // track displayUrl changes
		imageScale = 1;
		translateX = 0;
		translateY = 0;
	});

	// Reset showFriendCard when the current image doesn't have friend_card metadata
	$effect(() => {
		if (!currentMetadata.friend_card && showFriendCard) {
			showFriendCard = false;
		}
	});

	// Computed transform style
	let imageTransform = $derived(
		`scale(${imageScale}) translate(${translateX / imageScale}px, ${translateY / imageScale}px)`
	);

	// Double click to toggle zoom
	function handleDoubleClick(e: MouseEvent) {
		if (imageScale === 1) {
			// Zoom in to 2x
			imageScale = 2;
			// Center zoom on click position
			const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
			const centerX = rect.width / 2;
			const centerY = rect.height / 2;
			const offsetX = centerX - e.clientX + rect.left;
			const offsetY = centerY - e.clientY + rect.top;
			translateX = offsetX * imageScale;
			translateY = offsetY * imageScale;
		} else {
			// Reset to fit
			imageScale = 1;
			translateX = 0;
			translateY = 0;
		}
	}

	// Mouse wheel zoom
	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		const delta = e.deltaY > 0 ? -0.2 : 0.2;
		const newScale = Math.min(Math.max(0.5, imageScale + delta), 5);
		
		if (newScale === 1) {
			translateX = 0;
			translateY = 0;
		}
		imageScale = newScale;
	}

	// Drag start
	function handleMouseDown(e: MouseEvent) {
		if (imageScale > 1) {
			e.preventDefault();
			isDragging = true;
			dragStartX = e.clientX;
			dragStartY = e.clientY;
			lastTranslateX = translateX;
			lastTranslateY = translateY;
		}
	}

	// Drag move
	function handleMouseMove(e: MouseEvent) {
		if (isDragging) {
			e.preventDefault();
			translateX = lastTranslateX + (e.clientX - dragStartX);
			translateY = lastTranslateY + (e.clientY - dragStartY);
		}
	}

	// Drag end
	function handleMouseUp() {
		isDragging = false;
	}

	function openInExplorer() {
		if (window.electronAPI && displayPath) {
			window.electronAPI.showItemInFolder(displayPath);
		}
	}

	let copyStatus = $state<'idle' | 'success' | 'error'>('idle');

	async function copyToClipboard() {
		if (window.electronAPI && displayPath) {
			const result = await window.electronAPI.copyImageToClipboard(displayPath);
			if (result.success) {
				copyStatus = 'success';
				setTimeout(() => copyStatus = 'idle', 1200);
			} else {
				copyStatus = 'error';
				setTimeout(() => copyStatus = 'idle', 2000);
			}
		}
	}

	function toggleFriendCard() {
		if (friendCardUrl) {
			showFriendCard = !showFriendCard;
		}
	}
</script>


<div
	class="fixed inset-0 bg-black/95 flex items-start justify-center z-40 animate-fade-in overflow-y-auto"
	onclick={onclose}
	onkeydown={(e) => {
		if (e.key === 'Escape') onclose();
		if (e.key === 'ArrowLeft' && selectedIndex > 0) {
			e.preventDefault();
			onprev();
		}
		if (e.key === 'ArrowRight' && selectedIndex < totalImages - 1) {
			e.preventDefault();
			onnext();
		}
	}}
	role="dialog"
	aria-modal="true"
	aria-label="画像ビューア"
	tabindex="-1"
>

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="relative max-w-[95vw] flex flex-col items-center my-auto"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => {
			// Allow arrow keys to bubble up for navigation
			if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
				e.stopPropagation();
			}
		}}
		onmousemove={handleMouseMove}
		onmouseup={handleMouseUp}
		onmouseleave={handleMouseUp}
		role="presentation"
		aria-label="画像コンテンツ"
	>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<img
			class="max-w-11/12 max-h-screen object-contain rounded-lg select-none"
			class:cursor-grab={imageScale > 1 && !isDragging}
			class:cursor-grabbing={isDragging}
			src={displayUrl}
			alt={selectedImage.name}
			style="transform: {imageTransform}; transform-origin: center center;"
			ondblclick={handleDoubleClick}
			onwheel={handleWheel}
			onmousedown={handleMouseDown}
			draggable="false"
		/>

		{#if showUI}
			<div
				class="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 backdrop-blur rounded-lg transition-colors overflow-hidden w-fit z-50"
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
								{folderPath}
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
					{#if showFriendCard}
						<div class="mt-1 text-purple-400 text-xs">フレンドカード表示中</div>
					{/if}
					<div class="text-white text-base text-center flex items-center justify-center gap-2 w-full">
						<span>{selectedImage.name}</span>
						<button
						class="p-1 hover:bg-white/20 rounded transition-colors {copyStatus === 'success' ? 'text-green-400' : copyStatus === 'error' ? 'text-red-400' : ''}"
						onclick={copyToClipboard}
						title="画像をコピー"
					>
						{#if copyStatus === 'success'}
							<span in:fade={{ duration: 200 }}>
								<CopyCheckIcon class="size-4" />
							</span>
						{:else}
							<CopyIcon class="size-4" />
						{/if}
					</button>
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
					class="fixed left-6 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur transition-all"
					onclick={onprev}
				>
					<ArrowLeftIcon class="size-6" />
				</button>
			{/if}
			{#if selectedIndex < totalImages - 1}
				<button
					class="fixed right-6 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur transition-all"
					onclick={onnext}
				>
					<ArrowRightIcon class="size-6" />
				</button>
			{/if}

			<!-- Close button -->
			<button
				class="fixed top-6 right-6 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur transition-all"
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
			class="fixed bottom-6 right-6 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur transition-all z-50 group"
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

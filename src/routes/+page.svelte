<script lang="ts">
	import { onMount } from 'svelte';
	import { CheckIcon, RotateCcwIcon, EyeIcon, EyeOffIcon } from '@lucide/svelte';
	import SearchPanel from '$lib/components/SearchPanel.svelte';
	import ImageTile from '$lib/components/ImageTile.svelte';
	import ImageModal from '$lib/components/ImageModal.svelte';
	import BulkEditPanel from '$lib/components/BulkEditPanel.svelte';
	import { 
		settingsState,
		getAllCharacters,
		getAllTags,
		loadSettings,
		addCustomCharacter,
		addCustomTag
	} from '$lib/stores/settings.svelte';

	// State
	let images: ImageInfo[] = $state([]);
	let isLoading = $state(false);
	let selectedImage: ImageInfo | null = $state(null);
	let selectedIndex = $state(-1);

	// Metadata state
	let currentMetadata: ImageMetadata = $state({ characters: [], item: '', tags: [] });
	let newCharacterInput = $state('');
	let newTagInput = $state('');
	let showMetadataEditor = $state(false);

	// Search state
	let searchCharacters: string[] = $state([]);
	let searchTags: string[] = $state([]);
	let searchItem: string = $state('');
	let sortOrder = $state<'asc' | 'desc' | 'none'>('desc');
	let friendCardFilter = $state<'all' | 'with' | 'without'>('all');
	let noCharacterFilter = $state(false);
	let noItemFilter = $state(false);
	let noTagFilter = $state(false);
	let exactCharacterMatch = $state(false);
	let exactTagMatch = $state(false);


	// Infinite scroll state
	const BATCH_SIZE = 24;
	let displayCount = $state(BATCH_SIZE);
	let sentinelRef: HTMLDivElement | null = $state(null);

	// Multi-select / bulk edit state
	let isMultiSelectMode = $state(false);
	let selectedImages: Set<string> = $state(new Set());
	let isApplying = $state(false);
	let bulkProgress = $state(0);

	// Drag & Drop state
	let isDragging = $state(false);
	let isExtracting = $state(false);

	// Tile display state
	let showTileInfo = $state(true);

	// Filtered and sorted images

	let filteredImages = $derived.by(() => {
		let result = images;
		
		// Filter by characters
		if (searchCharacters.length > 0) {
			if (exactCharacterMatch) {
				// Exact match: image must have exactly the selected characters (no more, no less)
				result = result.filter(img => {
					const imgChars = img.metadata?.characters || [];
					if (imgChars.length !== searchCharacters.length) return false;
					return searchCharacters.every(c => imgChars.includes(c));
				});
			} else {
				// Partial match (AND - must have all selected characters, but can have more)
				result = result.filter(img => 
					searchCharacters.every(c => img.metadata?.characters?.includes(c))
				);
			}
		}
		
		// Filter by item (exact match)
		if (searchItem.trim()) {
			result = result.filter(img => img.metadata?.item === searchItem.trim());
		}
		
		// Filter by friend card
		if (friendCardFilter === 'with') {
			result = result.filter(img => !!img.metadata?.friend_card);
		} else if (friendCardFilter === 'without') {
			result = result.filter(img => !img.metadata?.friend_card);
		}
		
		// Filter by missing character info
		if (noCharacterFilter) {
			result = result.filter(img => !img.metadata?.characters || img.metadata.characters.length === 0);
		}
		
		// Filter by missing item info
		if (noItemFilter) {
			result = result.filter(img => !img.metadata?.item || img.metadata.item.trim() === '');
		}
		
		// Filter by tags
		if (searchTags.length > 0) {
			if (exactTagMatch) {
				// Exact match: image must have exactly the selected tags (no more, no less)
				result = result.filter(img => {
					const imgTags = img.metadata?.tags || [];
					if (imgTags.length !== searchTags.length) return false;
					return searchTags.every(t => imgTags.includes(t));
				});
			} else {
				// Partial match (AND - must have all selected tags, but can have more)
				result = result.filter(img => 
					searchTags.every(t => img.metadata?.tags?.includes(t))
				);
			}
		}
		
		// Filter by missing tag info
		if (noTagFilter) {
			result = result.filter(img => !img.metadata?.tags || img.metadata.tags.length === 0);
		}
		
		// Sort by date first, then by serial number
		if (sortOrder !== 'none') {
			result = [...result].sort((a, b) => {
				// Compare dates first (YYYY-MM-DD format sorts correctly as string)
				const aDate = a.extractedDate ?? '';
				const bDate = b.extractedDate ?? '';
				if (aDate !== bDate) {
					return sortOrder === 'asc' 
						? aDate.localeCompare(bDate) 
						: bDate.localeCompare(aDate);
				}
				// Same date, compare by serial
				const aSerial = a.serial ?? Infinity;
				const bSerial = b.serial ?? Infinity;
				return sortOrder === 'asc' ? aSerial - bSerial : bSerial - aSerial;
			});
		}
		
		return result;
	});

	// Displayed images (sliced for infinite scroll)
	let displayedImages = $derived(filteredImages.slice(0, displayCount));

	// Infinite scroll action
	function infiniteScrollTrigger(node: HTMLElement, enabled: boolean) {
		let observer: IntersectionObserver | null = null;

		function updateObserver(isEnabled: boolean) {
			if (observer) {
				observer.disconnect();
				observer = null;
			}
			
			if (isEnabled) {
				observer = new IntersectionObserver((entries) => {
					const entry = entries[0];
					if (entry.isIntersecting && displayCount < filteredImages.length) {
						displayCount = Math.min(displayCount + BATCH_SIZE, filteredImages.length);
					}
				}, { rootMargin: '200px' });
				observer.observe(node);
			}
		}

		updateObserver(enabled);

		return {
			update(newEnabled: boolean) {
				if (newEnabled !== enabled) {
					enabled = newEnabled;
					updateObserver(newEnabled);
				}
			},
			destroy() {
				if (observer) observer.disconnect();
			}
		};
	}

	// Reset displayCount when filteredImages changes
	$effect(() => {
		filteredImages;
		displayCount = BATCH_SIZE;
	});

	// Load settings and images on mount
	onMount(async () => {
		await loadSettings();
		if (settingsState.folderPath) {
			await loadImages();
		}
	});

	// Load images from the selected folder
	async function loadImages() {
		if (!settingsState.folderPath || !window.electronAPI) return;
		
		isLoading = true;
		try {
			images = await window.electronAPI.getImages(settingsState.folderPath);
		} catch (error) {
			console.error('Failed to load images:', error);
			images = [];
		} finally {
			isLoading = false;
		}
	}



	// Open fullscreen modal
	async function openImage(image: ImageInfo, index: number) {
		selectedImage = image;
		selectedIndex = index;
		showMetadataEditor = false;
		
		// Load metadata for this image (use cached if available)
		currentMetadata = image.metadata || { characters: [], item: '', tags: [] };
	}

	// Close fullscreen modal
	function closeModal() {
		selectedImage = null;
		selectedIndex = -1;
		showMetadataEditor = false;
		currentMetadata = { characters: [], item: '', tags: [] };
	}

	// Navigate to previous image (in filtered order)
	function prevImage() {
		if (selectedIndex > 0) {
			selectedIndex--;
			selectedImage = filteredImages[selectedIndex];
			currentMetadata = selectedImage.metadata || { characters: [], item: '', tags: [] };
		}
	}

	// Navigate to next image (in filtered order)
	function nextImage() {
		if (selectedIndex < filteredImages.length - 1) {
			selectedIndex++;
			selectedImage = filteredImages[selectedIndex];
			currentMetadata = selectedImage.metadata || { characters: [], item: '', tags: [] };
		}
	}

	// Handle keyboard navigation
	function handleKeydown(event: KeyboardEvent) {
		if (!selectedImage) return;
		// Don't handle if typing in input
		if (event.target instanceof HTMLInputElement) return;
		
		switch (event.key) {
			case 'Escape':
				closeModal();
				break;
			case 'ArrowLeft':
				prevImage();
				break;
			case 'ArrowRight':
				nextImage();
				break;
		}
	}

	// Toggle character selection
	function toggleCharacter(char: string) {
		if (currentMetadata.characters.includes(char)) {
			currentMetadata.characters = currentMetadata.characters.filter(c => c !== char);
		} else {
			currentMetadata.characters = [...currentMetadata.characters, char];
		}
	}

	// Toggle tag selection
	function toggleTag(tag: string) {
		const tags = currentMetadata.tags || [];
		if (tags.includes(tag)) {
			currentMetadata.tags = tags.filter(t => t !== tag);
		} else {
			currentMetadata.tags = [...tags, tag];
		}
	}

	// Add a custom character
	async function handleAddCharacter() {
		const success = await addCustomCharacter(newCharacterInput);
		if (success) {
			newCharacterInput = '';
		}
	}

	// Add a custom tag
	async function handleAddTag() {
		const success = await addCustomTag(newTagInput);
		if (success) {
			// Also add the tag to the current metadata
			toggleTag(newTagInput);
			newTagInput = '';
		}
	}

	// Update item
	function updateItem(value: string) {
		currentMetadata.item = value;
	}

	// Select friend card file
	async function selectFriendCard(file: File) {
		if (!window.electronAPI || !settingsState.folderPath || !selectedImage) return;
		
		// Read file as base64
		const reader = new FileReader();
		reader.onload = async () => {
			const base64 = (reader.result as string).split(',')[1]; // Remove data:image/... prefix
			const result = await window.electronAPI.saveFriendCard(settingsState.folderPath, file.name, base64);
			
			if (result.success) {
				currentMetadata.friend_card = file.name;
			} else {
				console.error('Error saving friend card:', result.error);
			}
		};
		reader.readAsDataURL(file);
	}

	// Save metadata
	async function saveMetadata() {
		if (!window.electronAPI || !settingsState.folderPath || !selectedImage) return;
		
		// Use $state.snapshot to get plain object for IPC
		const metadataToSave = $state.snapshot(currentMetadata);
		
		// Calculate the correct folder path (handle subfolders)
		const targetFolder = selectedImage.folder 
			? `${settingsState.folderPath}/${selectedImage.folder}`.replace(/\\/g, '/')
			: settingsState.folderPath;
		
		await window.electronAPI.setImageMetadata(targetFolder, selectedImage.name, metadataToSave);
		
		// Update local cache
		if (selectedImage) {
			selectedImage.metadata = metadataToSave;
		}
		
		showMetadataEditor = false;
	}


	// Multi-select / Bulk edit functions
	function toggleMultiSelectMode() {
		isMultiSelectMode = !isMultiSelectMode;
		if (!isMultiSelectMode) {
			selectedImages = new Set();
		}
	}

	function toggleImageSelection(imagePath: string) {
		if (selectedImages.has(imagePath)) {
			selectedImages.delete(imagePath);
			selectedImages = new Set(selectedImages); // trigger reactivity
		} else {
			selectedImages.add(imagePath);
			selectedImages = new Set(selectedImages);
		}
	}

	function cancelBulkEdit() {
		isMultiSelectMode = false;
		selectedImages = new Set();
	}

	async function applyBulkCharacters(characters: string[], overwrite: boolean = false) {
		if (!window.electronAPI || selectedImages.size === 0) return;
		
		isApplying = true;
		bulkProgress = 0;
		
		const total = selectedImages.size;
		let completed = 0;
		
		// Apply characters to all selected images
		for (const imagePath of selectedImages) {
			const img = images.find(i => i.path === imagePath);
			if (!img) {
				completed++;
				bulkProgress = (completed / total) * 100;
				continue;
			}
			
			// Either overwrite or merge characters
			const newChars = overwrite 
				? characters 
				: [...new Set([...(img.metadata?.characters || []), ...characters])];
			
			const newMetadata: ImageMetadata = {
				characters: newChars,
				item: img.metadata?.item || '',
				friend_card: img.metadata?.friend_card,
				tags: $state.snapshot(img.metadata?.tags || [])
			};
			
			// Calculate correct folder
			const targetFolder = img.folder 
				? `${settingsState.folderPath}/${img.folder}`.replace(/\\\\/g, '/')
				: settingsState.folderPath;
			
			await window.electronAPI.setImageMetadata(targetFolder, img.name, newMetadata);
			
			// Update local cache
			img.metadata = newMetadata;
			
			completed++;
			bulkProgress = (completed / total) * 100;
		}
		
		// Trigger reactivity
		images = [...images];
		isApplying = false;
		cancelBulkEdit();
	}

	// Drag & Drop handlers for ZIP files
	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (settingsState.folderPath && e.dataTransfer?.types.includes('Files')) {
			isDragging = true;
		}
	}

	function handleDragLeave() {
		isDragging = false;
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		
		if (!settingsState.folderPath || !window.electronAPI || !e.dataTransfer?.files) return;
		
		const files = Array.from(e.dataTransfer.files);
		const zipFiles = files.filter(f => f.name.toLowerCase().endsWith('.zip'));
		
		if (zipFiles.length === 0) {
			alert('ZIPファイルをドロップしてください');
			return;
		}
		
		isExtracting = true;
		let totalExtracted = 0;
		
		for (const file of zipFiles) {
			// Electron extends File with path property
			const filePath = (file as File & { path: string }).path;
			const result = await window.electronAPI.extractZip(filePath, settingsState.folderPath);
			if (result.success) {
				totalExtracted += result.extracted;
			} else {
				console.error('ZIP extraction error:', result.error);
			}
		}
		
		isExtracting = false;
		
		if (totalExtracted > 0) {
			// Reload images
			await loadImages();
			alert(`${totalExtracted}件の画像を追加しました`);
		} else {
			alert('画像が見つかりませんでした');
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div 
	class="flex flex-col p-4 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] relative"
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	role="application"
>

	<!-- Search Panel -->
	{#if images.length > 0}
		<SearchPanel 
			characters={getAllCharacters()} 
			selectedCharacters={searchCharacters}
			tags={getAllTags()}
			selectedTags={searchTags}
			{searchItem}
			{sortOrder}
			{friendCardFilter}
			{isMultiSelectMode}
			{noCharacterFilter}
			{noItemFilter}
			{noTagFilter}
			{exactCharacterMatch}
			{exactTagMatch}
			oncharacterselect={(chars) => searchCharacters = chars}
			ontagselect={(tags) => searchTags = tags}
			onitemsearch={(item) => searchItem = item}
			onsortchange={(order) => sortOrder = order}
			onfriendcardfilterchange={(f) => friendCardFilter = f}
			ontogglemultiselect={toggleMultiSelectMode}
			onnocharacterfilterchange={(v) => noCharacterFilter = v}
			onnoitemfilterchange={(v) => noItemFilter = v}
			onnotagfilterchange={(v) => noTagFilter = v}
			onexactcharactermatchchange={(v) => exactCharacterMatch = v}
			onexacttagmatchchange={(v) => exactTagMatch = v}
		/>
	{/if}

	<!-- Tile Info Toggle & Reload -->
	{#if images.length > 0}
		<div class="flex items-center justify-between mb-2 px-2">
			<div class="flex items-center gap-3">
				<span class="text-gray-400 text-sm">{filteredImages.length}件のプリフォト</span>
				<button 
					class="flex items-center gap-1 px-2 py-1 size-8 bg-white/10 hover:bg-white/20 border-none rounded-lg text-gray-400 hover:text-white cursor-pointer transition-all text-sm"
					onclick={loadImages}
					title="再読み込み"
				>
					<RotateCcwIcon class="size-4" />
				</button>
			</div>
			<button
				class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors {showTileInfo ? 'bg-purple-600/50 text-white hover:bg-purple-500/50' : 'bg-white/10 text-gray-400 hover:bg-white/20'}"
				onclick={() => showTileInfo = !showTileInfo}
				title={showTileInfo ? '情報を非表示' : '情報を表示'}
			>
				{#if showTileInfo}
					<EyeIcon class="w-4 h-4" />
					<span>情報表示中</span>
				{:else}
					<EyeOffIcon class="w-4 h-4" />
					<span>情報非表示</span>
				{/if}
			</button>
		</div>
	{/if}


	<!-- Image Grid -->
	<div class="flex-1 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] auto-rows-auto gap-3 p-2 content-start">
		{#if isLoading}
			<div class="col-span-full flex items-center justify-center h-48 text-gray-500 text-xl">読み込み中...</div>
		{:else if images.length === 0}
			<div class="col-span-full flex items-center justify-center h-48 text-gray-500 text-xl">
				{#if settingsState.folderPath}
					画像が見つかりません
				{:else}
					フォルダを選択して画像を表示
				{/if}
			</div>
		{:else if filteredImages.length === 0}
			<div class="col-span-full flex items-center justify-center h-48 text-gray-500 text-xl">
				検索結果がありません
			</div>
		{:else}
			{#each displayedImages as image, index}
				<div 
					class="h-fit relative"
					use:infiniteScrollTrigger={index === displayedImages.length - 1}
				>
					{#if isMultiSelectMode}
						<button 
							class="w-full"
							class:brightness-80={selectedImages.has(image.path)}
							onclick={() => toggleImageSelection(image.path)}
						>
							<div class="absolute top-2 left-2 z-10 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors {selectedImages.has(image.path) ? 'bg-purple-600 border-purple-600' : 'bg-black/50 border-white/50'}">
								{#if selectedImages.has(image.path)}
									<CheckIcon class="w-4 h-4 text-white" />
								{/if}
							</div>
							<ImageTile {image} onclick={() => {}} showInfo={showTileInfo} />
						</button>
					{:else}
						<ImageTile {image} onclick={() => openImage(image, index)} showInfo={showTileInfo} />
					{/if}
				</div>
			{/each}
			
			<!-- Loading indicator at bottom -->
			{#if displayCount < filteredImages.length}
				<div class="col-span-full flex items-center justify-center h-24 text-gray-500">
					<div class="flex items-center gap-2">
						<div class="animate-spin w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full"></div>
						<span>読み込み中... ({displayCount}/{filteredImages.length})</span>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>

<!-- Fullscreen Modal -->
{#if selectedImage}
	<ImageModal
		{selectedImage}
		{currentMetadata}
		allCharacters={getAllCharacters()}
		allTags={getAllTags()}
		{newCharacterInput}
		{newTagInput}
		{showMetadataEditor}
		{selectedIndex}
		folderPath={settingsState.folderPath}
		totalImages={filteredImages.length}
		onclose={closeModal}
		onprev={prevImage}
		onnext={nextImage}
		ontogglecharacter={toggleCharacter}
		ontoggletag={toggleTag}
		onaddcharacter={handleAddCharacter}
		onaddtag={handleAddTag}
		onupdateitem={updateItem}
		onsave={saveMetadata}
		oninputchange={(v) => newCharacterInput = v}
		ontaginputchange={(v) => newTagInput = v}
		ontoggleeditor={() => showMetadataEditor = !showMetadataEditor}
		onselectfriendcard={selectFriendCard}
	/>
{/if}


<!-- Bulk Edit Panel -->
{#if isMultiSelectMode}
	<BulkEditPanel 
		selectedCount={selectedImages.size}
		characters={getAllCharacters()}
		{isApplying}
		progress={bulkProgress}
		oncancel={cancelBulkEdit}
		onapply={applyBulkCharacters}
	/>
{/if}

<!-- Drag Overlay -->
{#if isDragging}
	<div class="fixed inset-0 bg-purple-600/30 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-none">
		<div class="bg-gray-900/90 rounded-2xl p-8 text-center border-2 border-dashed border-purple-500">
			<div class="text-5xl mb-4">📦</div>
			<p class="text-white text-xl font-medium">ZIPファイルをドロップして解凍</p>
			<p class="text-gray-400 text-sm mt-2">画像を{settingsState.folderPath}に追加します</p>
		</div>
	</div>
{/if}

<!-- Extracting Overlay -->
{#if isExtracting}
	<div class="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
		<div class="bg-gray-900 rounded-2xl p-8 text-center">
			<div class="animate-spin text-5xl mb-4">⚙️</div>
			<p class="text-white text-xl font-medium">解凍中...</p>
		</div>
	</div>
{/if}

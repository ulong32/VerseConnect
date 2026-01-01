<script lang="ts">
	import { onMount } from 'svelte';
	import { MoveUpIcon, CheckIcon } from '@lucide/svelte';
	import SettingsPanel from '$lib/components/SettingsPanel.svelte';
	import SearchPanel from '$lib/components/SearchPanel.svelte';
	import ImageTile from '$lib/components/ImageTile.svelte';
	import ImageModal from '$lib/components/ImageModal.svelte';
	import BulkEditPanel from '$lib/components/BulkEditPanel.svelte';

	// Character presets
	const CHARACTER_PRESETS = ['ひまり', 'みつき', 'つむぎ', 'サクラ', 'タマキ', 'アイリ', 'リンリン', 'チィ', 'じゅりあ', 'える', 'すばる', 'おとめ', 'ビビ', 'リング'];

	// State
	let folderPath = $state('');
	let images: ImageInfo[] = $state([]);
	let isLoading = $state(false);
	let selectedImage: ImageInfo | null = $state(null);
	let selectedIndex = $state(-1);

	// Metadata state
	let customCharacters: string[] = $state([]);
	let currentMetadata: ImageMetadata = $state({ characters: [], item: '' });
	let newCharacterInput = $state('');
	let showMetadataEditor = $state(false);

	// Search state
	let searchCharacters: string[] = $state([]);
	let searchItem: string = $state('');
	let sortOrder = $state<'asc' | 'desc' | 'none'>('desc');
	let friendCardFilter = $state<'all' | 'with' | 'without'>('all');

	// Scroll state
	let showScrollTop = $state(false);

	// Multi-select / bulk edit state
	let isMultiSelectMode = $state(false);
	let selectedImages: Set<string> = $state(new Set());
	let isApplying = $state(false);
	let bulkProgress = $state(0);

	// Drag & Drop state
	let isDragging = $state(false);
	let isExtracting = $state(false);

	// All available characters (presets + custom)
	let allCharacters = $derived([...CHARACTER_PRESETS, ...customCharacters]);

	// Filtered and sorted images
	let filteredImages = $derived.by(() => {
		let result = images;
		
		// Filter by characters (AND - must have all selected characters)
		if (searchCharacters.length > 0) {
			result = result.filter(img => 
				searchCharacters.every(c => img.metadata?.characters?.includes(c))
			);
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

	// Load settings and images on mount
	onMount(async () => {
		if (window.electronAPI) {
			const settings = await window.electronAPI.getSettings();
			customCharacters = settings.customCharacters || [];
			if (settings.folderPath) {
				folderPath = settings.folderPath;
				await loadImages();
			}
		}
	});

	// Load images from the selected folder
	async function loadImages() {
		if (!folderPath || !window.electronAPI) return;
		
		isLoading = true;
		try {
			images = await window.electronAPI.getImages(folderPath);
		} catch (error) {
			console.error('Failed to load images:', error);
			images = [];
		} finally {
			isLoading = false;
		}
	}

	// Open folder selection dialog
	async function selectFolder() {
		if (!window.electronAPI) return;
		
		const selected = await window.electronAPI.selectFolder();
		if (selected) {
			folderPath = selected;
			await window.electronAPI.setSettings({ folderPath: selected });
			await loadImages();
		}
	}

	// Open fullscreen modal
	async function openImage(image: ImageInfo, index: number) {
		selectedImage = image;
		selectedIndex = index;
		showMetadataEditor = false;
		
		// Load metadata for this image (use cached if available)
		currentMetadata = image.metadata || { characters: [], item: '' };
	}

	// Close fullscreen modal
	function closeModal() {
		selectedImage = null;
		selectedIndex = -1;
		showMetadataEditor = false;
		currentMetadata = { characters: [], item: '' };
	}

	// Navigate to previous image (in filtered order)
	function prevImage() {
		if (selectedIndex > 0) {
			selectedIndex--;
			selectedImage = filteredImages[selectedIndex];
			currentMetadata = selectedImage.metadata || { characters: [], item: '' };
		}
	}

	// Navigate to next image (in filtered order)
	function nextImage() {
		if (selectedIndex < filteredImages.length - 1) {
			selectedIndex++;
			selectedImage = filteredImages[selectedIndex];
			currentMetadata = selectedImage.metadata || { characters: [], item: '' };
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

	// Add a custom character
	async function addCustomCharacter() {
		const trimmed = newCharacterInput.trim();
		if (!trimmed || allCharacters.includes(trimmed)) {
			newCharacterInput = '';
			return;
		}
		customCharacters = [...customCharacters, trimmed];
		newCharacterInput = '';
		
		// Save custom characters to settings
		if (window.electronAPI) {
			await window.electronAPI.setSettings({ customCharacters: $state.snapshot(customCharacters) });
		}
	}

	// Update item
	function updateItem(value: string) {
		currentMetadata.item = value;
	}

	// Select friend card file
	async function selectFriendCard(file: File) {
		if (!window.electronAPI || !folderPath || !selectedImage) return;
		
		// Read file as base64
		const reader = new FileReader();
		reader.onload = async () => {
			const base64 = (reader.result as string).split(',')[1]; // Remove data:image/... prefix
			const result = await window.electronAPI.saveFriendCard(folderPath, file.name, base64);
			
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
		if (!window.electronAPI || !folderPath || !selectedImage) return;
		
		// Use $state.snapshot to get plain object for IPC
		const metadataToSave = $state.snapshot(currentMetadata);
		
		// Calculate the correct folder path (handle subfolders)
		const targetFolder = selectedImage.folder 
			? `${folderPath}/${selectedImage.folder}`.replace(/\\/g, '/')
			: folderPath;
		
		await window.electronAPI.setImageMetadata(targetFolder, selectedImage.name, metadataToSave);
		
		// Update local cache
		if (selectedImage) {
			selectedImage.metadata = metadataToSave;
		}
		
		showMetadataEditor = false;
	}

	// Handle scroll
	function handleScroll() {
		showScrollTop = window.scrollY > 300;
	}

	function scrollToTop() {
		window.scrollTo({ top: 0, behavior: 'smooth' });
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

	async function applyBulkCharacters(characters: string[]) {
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
			
			// Merge new characters with existing
			const existingChars = img.metadata?.characters || [];
			const newChars = [...new Set([...existingChars, ...characters])];
			
			const newMetadata = {
				characters: newChars,
				item: img.metadata?.item || ''
			};
			
			// Calculate correct folder
			const targetFolder = img.folder 
				? `${folderPath}/${img.folder}`.replace(/\\\\/g, '/')
				: folderPath;
			
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
		if (folderPath && e.dataTransfer?.types.includes('Files')) {
			isDragging = true;
		}
	}

	function handleDragLeave() {
		isDragging = false;
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		
		if (!folderPath || !window.electronAPI || !e.dataTransfer?.files) return;
		
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
			const result = await window.electronAPI.extractZip(filePath, folderPath);
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

<svelte:window onkeydown={handleKeydown} onscroll={handleScroll} />

<div 
	class="flex flex-col h-[calc(100vh-50px)] p-4 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] relative"
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	role="application"
>
	<!-- Settings Panel -->
	<SettingsPanel {folderPath} onselect={selectFolder} onreload={loadImages} />

	<!-- Search Panel -->
	{#if images.length > 0}
		<SearchPanel 
			characters={allCharacters} 
			selectedCharacters={searchCharacters}
			{searchItem}
			{sortOrder}
			{friendCardFilter}
			{isMultiSelectMode}
			oncharacterselect={(chars) => searchCharacters = chars}
			onitemsearch={(item) => searchItem = item}
			onsortchange={(order) => sortOrder = order}
			onfriendcardfilterchange={(f) => friendCardFilter = f}
			ontogglemultiselect={toggleMultiSelectMode}
		/>
	{/if}

	<!-- Image Grid -->
	<div class="flex-1 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] auto-rows-auto gap-3 p-2 content-start">
		{#if isLoading}
			<div class="col-span-full flex items-center justify-center h-48 text-gray-500 text-xl">読み込み中...</div>
		{:else if images.length === 0}
			<div class="col-span-full flex items-center justify-center h-48 text-gray-500 text-xl">
				{#if folderPath}
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
			{#each filteredImages as image, index}
				<div class="h-fit relative">
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
							<ImageTile {image} onclick={() => {}} />
						</button>
					{:else}
						<ImageTile {image} onclick={() => openImage(image, index)}  />
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</div>

<!-- Fullscreen Modal -->
{#if selectedImage}
	<ImageModal
		{selectedImage}
		{currentMetadata}
		{allCharacters}
		{newCharacterInput}
		{showMetadataEditor}
		{selectedIndex}
		{folderPath}
		totalImages={filteredImages.length}
		onclose={closeModal}
		onprev={prevImage}
		onnext={nextImage}
		ontogglecharacter={toggleCharacter}
		onaddcharacter={addCustomCharacter}
		onupdateitem={updateItem}
		onsave={saveMetadata}
		oninputchange={(v) => newCharacterInput = v}
		ontoggleeditor={() => showMetadataEditor = !showMetadataEditor}
		onselectfriendcard={selectFriendCard}
	/>
{/if}

<!-- Scroll to Top Button -->
{#if showScrollTop && !isMultiSelectMode}
	<button
		class="fixed bottom-6 right-6 size-12 bg-purple-600/50 hover:bg-purple-500 text-white rounded-full shadow-lg shadow-purple-600/30 flex items-center justify-center transition-all hover:scale-110 z-40"
		onclick={scrollToTop}
		aria-label="ページトップに戻る"
	>
		<MoveUpIcon class="size-5" />
	</button>
{/if}

<!-- Bulk Edit Panel -->
{#if isMultiSelectMode}
	<BulkEditPanel 
		selectedCount={selectedImages.size}
		characters={allCharacters}
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
			<p class="text-gray-400 text-sm mt-2">画像を{folderPath}に追加します</p>
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

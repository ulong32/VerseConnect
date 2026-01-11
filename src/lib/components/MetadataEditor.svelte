<script lang="ts">
	import { ImageIcon, TagIcon } from '@lucide/svelte';
	import { ITEM_IMAGE_SUFFIX, settingsState } from '$lib/stores/settings.svelte';

	interface Props {
		allCharacters: string[];
		allTags: string[];
		currentMetadata: ImageMetadata;
		newCharacterInput: string;
		newTagInput: string;
		ontogglecharacter: (char: string) => void;
		ontoggletag: (tag: string) => void;
		onaddcharacter: () => void;
		onaddtag: () => void;
		onupdateitem: (value: string) => void;
		onsave: () => void;
		oninputchange: (value: string) => void;
		ontaginputchange: (value: string) => void;
		onselectfriendcard: (file: File) => void;
	}

	let {
		allCharacters,
		allTags,
		currentMetadata,
		newCharacterInput,
		newTagInput,
		ontogglecharacter,
		ontoggletag,
		onaddcharacter,
		onaddtag,
		onupdateitem,
		onsave,
		oninputchange,
		ontaginputchange,
		onselectfriendcard
	}: Props = $props();

	let itemImageError = $state(false);

	// Get static folder path for item image
	function getStaticItemImageSrc(item: string): string {
		return `/item/${item}${ITEM_IMAGE_SUFFIX}`;
	}

	// Build item image src based on settings
	function getItemImageSrc(item: string): string {
		if (settingsState.itemImageFolderPath) {
			return `item-image://${item}${ITEM_IMAGE_SUFFIX}`;
		}
		return getStaticItemImageSrc(item);
	}

	// Handle image load error with fallback
	function handleItemImageError(e: Event, item: string) {
		const img = e.currentTarget as HTMLImageElement;
		const staticSrc = getStaticItemImageSrc(item);
		
		if (img.src.startsWith('item-image://') && img.src !== staticSrc) {
			img.src = staticSrc;
		} else {
			itemImageError = true;
		}
	}

	// Reset error state when item changes
	$effect(() => {
		if (currentMetadata.item) {
			itemImageError = false;
		}
	});

	function handleFileSelect(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			onselectfriendcard(file);
		}
	}

	// Handle item image click to open file selection dialog
	async function handleItemImageClick() {
		if (!window.electronAPI || !settingsState.itemImageFolderPath) {
			await window.electronAPI?.showConfirmDialog({
				title: 'エラー',
				message: 'アイテム画像フォルダが設定されていません。設定画面でフォルダを指定してください。',
				okLabel: 'OK'
			});
			return;
		}

		const selectedPath = await window.electronAPI.selectFile({
			defaultPath: settingsState.itemImageFolderPath,
			filters: [{ name: 'Item Images', extensions: ['webp'] }]
		});

		if (!selectedPath) return;

		// Normalize paths for comparison (handle Windows/Unix differences)
		const normalizedSelected = selectedPath.replace(/\\/g, '/');
		const normalizedFolder = settingsState.itemImageFolderPath.replace(/\\/g, '/');

		// Validate: file must be inside itemImageFolderPath
		if (!normalizedSelected.startsWith(normalizedFolder + '/')) {
			await window.electronAPI.showConfirmDialog({
				title: 'エラー',
				message: `選択されたファイルはアイテム画像フォルダ内にありません。\n\n指定フォルダ: ${settingsState.itemImageFolderPath}`,
				okLabel: 'OK'
			});
			return;
		}

		// Validate: file must end with ITEM_IMAGE_SUFFIX
		if (!normalizedSelected.endsWith(ITEM_IMAGE_SUFFIX)) {
			await window.electronAPI.showConfirmDialog({
				title: 'エラー',
				message: `ファイル名は「${ITEM_IMAGE_SUFFIX}」で終わる必要があります。`,
				okLabel: 'OK'
			});
			return;
		}

		// Extract relative path from folder and remove suffix
		const relativePath = normalizedSelected.slice(normalizedFolder.length + 1);
		const itemValue = relativePath.slice(0, -ITEM_IMAGE_SUFFIX.length);

		onupdateitem(itemValue);
	}
</script>

<div class="p-4 bg-gray-800/80 backdrop-blur rounded-xl max-w-lg mx-auto">
	<!-- Character Selection -->
	<div class="mb-4">
		<span class="block text-white text-sm font-medium mb-2">キャラクター</span>
		<div class="flex flex-wrap gap-2">
			{#each allCharacters as char}
				<button
					class="px-3 py-1.5 rounded-full text-sm transition-all {currentMetadata.characters.includes(char)
						? 'bg-purple-600 text-white'
						: 'bg-white/10 text-gray-300 hover:bg-white/20'}"
					onclick={() => ontogglecharacter(char)}
				>
					{char}
				</button>
			{/each}
		</div>
		<!-- Add Custom Character -->
		<div class="mt-3 flex gap-2">
			<input
				type="text"
				value={newCharacterInput}
				oninput={(e) => oninputchange(e.currentTarget.value)}
				placeholder="新しいキャラクター"
				class="flex-1 px-3 py-1.5 bg-white/10 text-white rounded-lg border border-white/20 focus:border-purple-500 focus:outline-none text-sm"
				onkeydown={(e) => e.key === 'Enter' && onaddcharacter()}
			/>
			<button
				class="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm transition-colors"
				onclick={onaddcharacter}
			>
				追加
			</button>
		</div>
	</div>

	<!-- Tag Selection -->
	<div class="mb-4">
		<span class="text-white text-sm font-medium mb-2 flex items-center gap-1">
			<TagIcon class="size-4" />
			タグ
		</span>
		{#if allTags.length > 0}
			<div class="flex flex-wrap gap-2 mb-3">
				{#each allTags as tag}
					<button
						class="px-3 py-1.5 rounded-full text-sm transition-all {(currentMetadata.tags || []).includes(tag)
							? 'bg-teal-600 text-white'
							: 'bg-white/10 text-gray-300 hover:bg-white/20'}"
						onclick={() => ontoggletag(tag)}
					>
						{tag}
					</button>
				{/each}
			</div>
		{/if}
		<!-- Add Custom Tag -->
		<div class="flex gap-2">
			<input
				type="text"
				value={newTagInput}
				oninput={(e) => ontaginputchange(e.currentTarget.value)}
				placeholder="新しいタグ"
				class="flex-1 px-3 py-1.5 bg-white/10 text-white rounded-lg border border-white/20 focus:border-teal-500 focus:outline-none text-sm"
				onkeydown={(e) => e.key === 'Enter' && onaddtag()}
			/>
			<button
				class="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm transition-colors"
				onclick={onaddtag}
			>
				追加
			</button>
		</div>
	</div>

	<!-- Item Input with Preview -->
	<div class="mb-4">
		<span class="block text-white text-sm font-medium mb-2">アイテム</span>
		<div class="flex gap-3 items-start">
			<button
				type="button"
				class="size-16 shrink-0 rounded cursor-pointer transition-all hover:ring-2 hover:ring-purple-500 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500"
				onclick={handleItemImageClick}
				title="クリックしてアイテム画像を選択"
			>
				{#if currentMetadata.item && !itemImageError}
					<img
						class="size-16 object-contain rounded bg-black/30"
						src={getItemImageSrc(currentMetadata.item)}
						alt={currentMetadata.item}
						onerror={(e) => handleItemImageError(e, currentMetadata.item)}
					/>
				{:else}
					<div class="size-16 bg-gray-700/50 rounded flex items-center justify-center">
						<ImageIcon class="size-6 text-gray-600" />
					</div>
				{/if}
			</button>
			<input
				type="text"
				value={currentMetadata.item}
				oninput={(e) => onupdateitem(e.currentTarget.value)}
				placeholder="アイテム名を入力"
				class="flex-1 px-3 py-2 bg-white/10 text-white rounded-lg border border-white/20 focus:border-blue-500 focus:outline-none"
			/>
		</div>
	</div>

	<!-- Friend Card File Input -->
	<div class="mb-4">
		<span class="block text-white text-sm font-medium mb-2">フレンドカード</span>
		<div class="flex items-center gap-2">
			<label class="flex-1 flex items-center gap-2 px-3 py-2 bg-white/10 text-gray-300 rounded-lg border border-white/20 cursor-pointer hover:bg-white/20 transition-colors">
				<ImageIcon class="size-4" />
				<span class="text-sm truncate">
					{currentMetadata.friend_card || 'ファイルを選択...'}
				</span>
				<input
					type="file"
					accept="image/*"
					class="hidden"
					onchange={handleFileSelect}
				/>
			</label>
			{#if currentMetadata.friend_card}
				<span class="text-green-400 text-sm">✓</span>
			{/if}
		</div>
	</div>

	<!-- Save Button -->
	<button
		class="w-full py-2 bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-medium rounded-lg transition-all"
		onclick={onsave}
	>
		保存
	</button>
</div>

<script lang="ts">
	import { ImageIcon } from '@lucide/svelte';
	
	interface Props {
		allCharacters: string[];
		currentMetadata: ImageMetadata;
		newCharacterInput: string;
		ontogglecharacter: (char: string) => void;
		onaddcharacter: () => void;
		onupdateitem: (value: string) => void;
		onsave: () => void;
		oninputchange: (value: string) => void;
		onselectfriendcard: (file: File) => void;
	}

	let { 
		allCharacters, 
		currentMetadata, 
		newCharacterInput,
		ontogglecharacter, 
		onaddcharacter, 
		onupdateitem, 
		onsave,
		oninputchange,
		onselectfriendcard
	}: Props = $props();

	function handleFileSelect(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			onselectfriendcard(file);
		}
	}
</script>

<div class="mt-4 p-4 bg-gray-800/80 backdrop-blur rounded-xl w-full max-w-md">
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

	<!-- Item Input -->
	<div class="mb-4">
		<span class="block text-white text-sm font-medium mb-2">アイテム</span>
		<input
			type="text"
			value={currentMetadata.item}
			oninput={(e) => onupdateitem(e.currentTarget.value)}
			placeholder="アイテム名を入力"
			class="w-full px-3 py-2 bg-white/10 text-white rounded-lg border border-white/20 focus:border-blue-500 focus:outline-none"
		/>
	</div>

	<!-- Friend Card File Input -->
	<div class="mb-4">
		<span class="block text-white text-sm font-medium mb-2">フレンドカード</span>
		<div class="flex items-center gap-2">
			<label class="flex-1 flex items-center gap-2 px-3 py-2 bg-white/10 text-gray-300 rounded-lg border border-white/20 cursor-pointer hover:bg-white/20 transition-colors">
				<ImageIcon class="w-4 h-4" />
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
		class="w-full py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-medium rounded-lg transition-all"
		onclick={onsave}
	>
		保存
	</button>
</div>

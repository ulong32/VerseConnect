<script lang="ts">
	import { Progress } from '@skeletonlabs/skeleton-svelte';
	import { SquareCheckIcon, XIcon, PlusIcon } from '@lucide/svelte';
	import { addCustomCharacter } from '$lib/stores/settings.svelte';
	
	interface Props {
		selectedCount: number;
		characters: string[];
		isApplying: boolean;
		progress: number; // 0-100
		oncancel: () => void;
		onapply: (characters: string[], overwrite: boolean) => void;
	}

	let { selectedCount, characters, isApplying, progress, oncancel, onapply }: Props = $props();
	
	let selectedCharacters: string[] = $state([]);
	let newCharacterInput = $state('');
	let overwriteMode = $state(false);

	function toggleCharacter(char: string) {
		if (isApplying) return;
		if (selectedCharacters.includes(char)) {
			selectedCharacters = selectedCharacters.filter(c => c !== char);
		} else {
			selectedCharacters = [...selectedCharacters, char];
		}
	}

	async function handleAddCharacter() {
		if (isApplying) return;
		const trimmed = newCharacterInput.trim();
		if (!trimmed) return;
		
		const success = await addCustomCharacter(trimmed);
		if (success) {
			// Also select the newly added character
			selectedCharacters = [...selectedCharacters, trimmed];
		} else if (!selectedCharacters.includes(trimmed) && characters.includes(trimmed)) {
			// Character already exists, just select it
			selectedCharacters = [...selectedCharacters, trimmed];
		}
		newCharacterInput = '';
	}

	function handleApply() {
		onapply([...selectedCharacters], overwriteMode);
	}
</script>

<div class="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur p-4 shadow-lg z-50 border-t border-white/10">
	<div class="max-w-4xl mx-auto">
		<div class="flex items-center justify-between mb-3">
			<div class="flex items-center gap-2 text-white">
				<SquareCheckIcon class="w-5 h-5" />
				<span class="font-medium">{selectedCount}件選択中</span>
			</div>
			{#if !isApplying}
				<button 
					class="p-1 hover:bg-white/10 rounded transition-colors"
					onclick={oncancel}
					aria-label="選択モード終了"
				>
					<XIcon class="w-5 h-5 text-gray-400" />
				</button>
			{/if}
		</div>
		
		{#if isApplying}
			<!-- Progress indicator -->
			<div class="mb-3">
				<Progress value={progress} class="grid grid-cols-[auto_1fr] items-center gap-4">
					<Progress.Label class="text-sm text-white">{Math.round(progress)}%</Progress.Label>
					<Progress.Track class="bg-white/20">
						<Progress.Range class="bg-purple-600" />
					</Progress.Track>
				</Progress>
				<p class="text-gray-400 text-sm mt-2">適用中... しばらくお待ちください</p>
			</div>
		{:else}
			<div class="mb-3">
				<span class="text-gray-400 text-sm mb-2 block">適用するキャラクター:</span>
				<div class="flex flex-wrap gap-1.5 mb-2">
					{#each characters as char}
						<button
							class="px-2.5 py-1 rounded-full text-xs transition-all {selectedCharacters.includes(char) 
								? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' 
								: 'bg-white/10 text-gray-300 hover:bg-white/20'}"
							onclick={() => toggleCharacter(char)}
						>
							{char}
						</button>
					{/each}
				</div>
				<!-- Custom character input -->
				<div class="flex gap-2 items-center">
					<input 
						type="text" 
						bind:value={newCharacterInput}
						placeholder="新しいタグを追加..."
						class="flex-1 max-w-xs px-3 py-1.5 text-sm bg-white/10 text-white rounded-lg border border-white/10 focus:border-purple-500 focus:outline-none"
						onkeydown={(e) => e.key === 'Enter' && handleAddCharacter()}
					/>
					<button 
						class="px-3 py-1.5 bg-purple-600/50 hover:bg-purple-600 text-white rounded-lg transition-colors flex items-center gap-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
						onclick={handleAddCharacter}
						disabled={!newCharacterInput.trim()}
					>
						<PlusIcon class="w-4 h-4" />
						追加
					</button>
				</div>
			</div>
			
			<div class="flex gap-2 items-center">
				<button 
					class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
					onclick={oncancel}
				>
					キャンセル
				</button>
				
				<!-- Overwrite mode toggle -->
				<label class="flex items-center gap-2 cursor-pointer">
					<input 
						type="checkbox" 
						bind:checked={overwriteMode}
						class="w-4 h-4 accent-orange-500"
					/>
					<span class="text-sm {overwriteMode ? 'text-orange-400' : 'text-gray-400'}">
						上書き
					</span>
				</label>
				
				<button 
					class="px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed {overwriteMode ? 'bg-orange-600 hover:bg-orange-500' : 'bg-purple-600 hover:bg-purple-500'}"
					onclick={handleApply}
					disabled={selectedCharacters.length === 0}
				>
					{overwriteMode ? '上書きで適用' : '追加で適用'}
				</button>
			</div>
		{/if}
	</div>
</div>

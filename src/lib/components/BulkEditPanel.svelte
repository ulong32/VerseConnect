<script lang="ts">
	import { Progress } from '@skeletonlabs/skeleton-svelte';
	import { SquareCheckIcon, XIcon } from '@lucide/svelte';
	
	interface Props {
		selectedCount: number;
		characters: string[];
		isApplying: boolean;
		progress: number; // 0-100
		oncancel: () => void;
		onapply: (characters: string[]) => void;
	}

	let { selectedCount, characters, isApplying, progress, oncancel, onapply }: Props = $props();
	
	let selectedCharacters: string[] = $state([]);

	function toggleCharacter(char: string) {
		if (isApplying) return;
		if (selectedCharacters.includes(char)) {
			selectedCharacters = selectedCharacters.filter(c => c !== char);
		} else {
			selectedCharacters = [...selectedCharacters, char];
		}
	}

	function handleApply() {
		onapply([...selectedCharacters]);
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
				<div class="flex flex-wrap gap-1.5">
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
			</div>
			
			<div class="flex gap-2">
				<button 
					class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
					onclick={oncancel}
				>
					キャンセル
				</button>
				<button 
					class="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					onclick={handleApply}
					disabled={selectedCharacters.length === 0}
				>
					選択した画像に適用
				</button>
			</div>
		{/if}
	</div>
</div>

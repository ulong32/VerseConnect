<script lang="ts">
	import { SearchIcon, TagIcon, UserRoundIcon, ArrowDown01Icon, ArrowUp01Icon, ChevronsUpDownIcon, SquareCheckIcon, UsersIcon } from '@lucide/svelte';
	interface Props {
		characters: string[];
		selectedCharacters: string[];
		searchItem: string;
		sortOrder: 'asc' | 'desc' | 'none';
		friendCardFilter: 'all' | 'with' | 'without';
		isMultiSelectMode: boolean;
		oncharacterselect: (characters: string[]) => void;
		onitemsearch: (item: string) => void;
		onsortchange: (order: 'asc' | 'desc' | 'none') => void;
		onfriendcardfilterchange: (filter: 'all' | 'with' | 'without') => void;
		ontogglemultiselect: () => void;
	}

	let { characters, selectedCharacters, searchItem, sortOrder, friendCardFilter, isMultiSelectMode, oncharacterselect, onitemsearch, onsortchange, onfriendcardfilterchange, ontogglemultiselect }: Props = $props();

	function toggleCharacter(char: string) {
		if (selectedCharacters.includes(char)) {
			oncharacterselect(selectedCharacters.filter(c => c !== char));
		} else {
			oncharacterselect([...selectedCharacters, char]);
		}
	}

	function clearAll() {
		oncharacterselect([]);
		onitemsearch('');
		onfriendcardfilterchange('all');
	}

	function cycleSortOrder() {
		if (sortOrder === 'asc') onsortchange('desc');
		else if (sortOrder === 'desc') onsortchange('none');
		else onsortchange('asc');
	}

	function cycleFriendCardFilter() {
		if (friendCardFilter === 'all') onfriendcardfilterchange('with');
		else if (friendCardFilter === 'with') onfriendcardfilterchange('without');
		else onfriendcardfilterchange('all');
	}

	let hasFilter = $derived(selectedCharacters.length > 0 || searchItem.length > 0 || friendCardFilter !== 'all');
</script>

<div class="bg-white/5 rounded-xl p-3 mb-4 backdrop-blur-sm">
	<div class="flex items-center gap-2 mb-3">
		<SearchIcon class="w-5 h-5" />
		
		<!-- Multi-select Toggle -->
		<button 
			class="px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 {isMultiSelectMode ? 'bg-green-600/50 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}"
			onclick={ontogglemultiselect}
			title="まとめて編集"
		>
			<SquareCheckIcon class="size-6 scale-[5/6]" />
			{isMultiSelectMode ? '選択中' : '選択'}
		</button>
		
		<!-- Sort Toggle -->
		<button 
			class="px-2 py-1 text-xs rounded transition-colors {sortOrder !== 'none' ? 'bg-blue-600/50 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}"
			onclick={cycleSortOrder}
			title="連番でソート"
		>
			{#if sortOrder === 'asc'}
				<div class="flex items-center gap-1">
					<ArrowDown01Icon /> 昇順
				</div>
			{:else if sortOrder === 'desc'}
				<div class="flex items-center gap-1">
					<ArrowUp01Icon /> 降順
				</div>
			{:else}
				<div class="flex items-center gap-1">
					<ChevronsUpDownIcon /> ソートなし
				</div>
			{/if}
		</button>

		<!-- Friend Card Filter -->
		<button 
			class="px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 {friendCardFilter !== 'all' ? 'bg-pink-600/50 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}"
			onclick={cycleFriendCardFilter}
			title="フレンドカードで絞り込み"
		>
			<UsersIcon class="w-6 h-6 scale-[5/6]" />
			{#if friendCardFilter === 'all'}
				全て
			{:else if friendCardFilter === 'with'}
				フレカ有
			{:else}
				フレカ無
			{/if}
		</button>
		
		{#if hasFilter}
			<button 
				class="text-xs px-2 py-0.5 bg-red-600/50 hover:bg-red-600/70 text-white rounded transition-colors"
				onclick={clearAll}
			>
				すべてクリア
			</button>
		{/if}
	</div>
	
	<!-- Character Filter -->
	<div class="flex items-center gap-2 mb-2 flex-wrap">
		<UserRoundIcon class="w-4 h-4 text-gray-500 shrink-0" />
		{#each characters as char}
			<button
				class="px-2 py-0.5 text-xs rounded-full transition-all {selectedCharacters.includes(char) 
					? 'bg-purple-600 text-white' 
					: 'bg-white/10 text-gray-400 hover:bg-white/20'}"
				onclick={() => toggleCharacter(char)}
			>
				{char}
			</button>
		{/each}
	</div>
	
	<!-- Item Search -->
	<div class="flex items-center gap-2">
		<TagIcon class="w-4 h-4 text-gray-500 shrink-0" />
		<input
			type="text"
			value={searchItem}
			oninput={(e) => onitemsearch(e.currentTarget.value)}
			placeholder="アイテム名で検索（完全一致）"
			class="flex-1 px-3 py-1.5 text-sm bg-white/10 text-white rounded-lg border border-white/10 focus:border-blue-500 focus:outline-none"
		/>
	</div>
</div>

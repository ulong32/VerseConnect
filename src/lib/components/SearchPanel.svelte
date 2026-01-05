<script lang="ts">
	import { SearchIcon, TagIcon, UserRoundIcon, ArrowDown01Icon, ArrowUp01Icon, ChevronsUpDownIcon, SquareCheckIcon, UsersIcon, UserXIcon, CircleSlash2Icon, EqualIcon } from '@lucide/svelte';
	interface Props {
		characters: string[];
		selectedCharacters: string[];
		searchItem: string;
		sortOrder: 'asc' | 'desc' | 'none';
		friendCardFilter: 'all' | 'with' | 'without';
		isMultiSelectMode: boolean;
		noCharacterFilter: boolean;
		noItemFilter: boolean;
		exactCharacterMatch: boolean;
		oncharacterselect: (characters: string[]) => void;
		onitemsearch: (item: string) => void;
		onsortchange: (order: 'asc' | 'desc' | 'none') => void;
		onfriendcardfilterchange: (filter: 'all' | 'with' | 'without') => void;
		ontogglemultiselect: () => void;
		onnocharacterfilterchange: (value: boolean) => void;
		onnoitemfilterchange: (value: boolean) => void;
		onexactcharactermatchchange: (value: boolean) => void;
	}

	let { characters, selectedCharacters, searchItem, sortOrder, friendCardFilter, isMultiSelectMode, noCharacterFilter, noItemFilter, exactCharacterMatch, oncharacterselect, onitemsearch, onsortchange, onfriendcardfilterchange, ontogglemultiselect, onnocharacterfilterchange, onnoitemfilterchange, onexactcharactermatchchange }: Props = $props();

	function toggleCharacter(char: string) {
		if (selectedCharacters.includes(char)) {
			oncharacterselect(selectedCharacters.filter(c => c !== char));
		} else {
			oncharacterselect([...selectedCharacters, char]);
		}
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

	let hasFilter = $derived(selectedCharacters.length > 0 || searchItem.length > 0 || friendCardFilter !== 'all' || noCharacterFilter || noItemFilter);

	function clearAll() {
		oncharacterselect([]);
		onitemsearch('');
		onfriendcardfilterchange('all');
		onnocharacterfilterchange(false);
		onnoitemfilterchange(false);
	}
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

		<!-- No Character Filter -->
		<button 
			class="px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 {noCharacterFilter ? 'bg-orange-600/50 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}"
			onclick={() => onnocharacterfilterchange(!noCharacterFilter)}
			title="キャラクター未登録で絞り込み"
		>
			<UserXIcon class="w-6 h-6 scale-[5/6]" />
			キャラ無
		</button>

		<!-- No Item Filter -->
		<button 
			class="px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 {noItemFilter ? 'bg-orange-600/50 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}"
			onclick={() => onnoitemfilterchange(!noItemFilter)}
			title="アイテム名未登録で絞り込み"
		>
			<CircleSlash2Icon class="w-6 h-6 scale-[5/6]" />
			アイテム無
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
		<!-- Exact Match Toggle -->
		{#if selectedCharacters.length > 0}
			<button 
				class="px-2 py-0.5 text-xs rounded-full transition-colors flex items-center gap-1 ml-2 {exactCharacterMatch ? 'bg-yellow-600/70 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}"
				onclick={() => onexactcharactermatchchange(!exactCharacterMatch)}
				title="完全一致：選択したキャラクターのみが写っている画像を表示"
			>
				<EqualIcon class="w-3 h-3" />
				完全一致
			</button>
		{/if}
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

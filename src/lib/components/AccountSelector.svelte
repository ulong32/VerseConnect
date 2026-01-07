<script lang="ts">
	import { CheckIcon, PlusIcon, PencilIcon, XIcon, CheckCircleIcon, UserIcon, CircleCheckBigIcon } from '@lucide/svelte';
	import { 
		sessionState, 
		switchAccount, 
		removeAccount, 
		toggleEditMode 
	} from '$lib/stores/session.svelte';

	interface Props {
		onAddClick: () => void;
	}

	let { onAddClick }: Props = $props();
	
	let isSwitching = $state<string | null>(null);

	async function handleAccountClick(name: string) {
		if (sessionState.isEditMode) return;
		if (name === sessionState.activeAccountName) return;
		
		isSwitching = name;
		await switchAccount(name);
		isSwitching = null;
	}

	async function handleRemoveClick(name: string, e: Event) {
		e.stopPropagation();
		if (name === sessionState.activeAccountName) {
			// Can't remove active account if it's the only one
			if (sessionState.accounts.length === 1) {
				return;
			}
		}
		await removeAccount(name);
		
		// Exit edit mode if no accounts left
		if (sessionState.accounts.length === 0) {
			sessionState.isEditMode = false;
		}
	}

	function getProfileImageUrl(account: AipriAccount): string | null {
		if (account.profileImagePath) {
			// Add cache-busting parameter using account name hash
			const cacheBust = account.name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
			return `local-image://${encodeURIComponent(account.profileImagePath)}?t=${cacheBust}`;
		}
		return null;
	}
</script>

<div class="flex items-center gap-2 flex-wrap">
	<!-- Account icons -->
	{#each sessionState.accounts as account (account.name)}
		<div>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="relative group cursor-pointer transition-all duration-200 rounded-full"
        class:opacity-50={isSwitching && isSwitching !== account.name}
        class:ring-2={account.name === sessionState.activeAccountName}
        class:ring-purple-500={account.name === sessionState.activeAccountName}
        class:grayscale={isSwitching && isSwitching !== account.name}
        onclick={() => handleAccountClick(account.name)}
        onkeydown={(e) => e.key === 'Enter' && handleAccountClick(account.name)}
        role="button"
        tabindex={isSwitching !== null ? -1 : 0}
        title={account.name}
      >
        <!-- Profile image or default avatar -->
        <div class="w-12 h-12 rounded-full overflow-hidden bg-white/10 border-2 border-white/20 hover:border-purple-400 transition-colors">
          {#if getProfileImageUrl(account)}
            <img
              src={getProfileImageUrl(account)}
              alt={account.name}
              class="w-full h-full object-cover"
            />
          {:else}
            <div class="w-full h-full flex items-center justify-center">
              <UserIcon class="w-6 h-6 text-gray-400" />
            </div>
          {/if}
        </div>
        <!-- Active checkmark -->
        {#if account.name === sessionState.activeAccountName && !sessionState.isEditMode}
          <div class="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
            <CheckIcon class="w-3 h-3 text-white" />
          </div>
        {/if}
        <!-- Remove button (edit mode) -->
        {#if sessionState.isEditMode && !(account.name === sessionState.activeAccountName && sessionState.accounts.length === 1)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <span
            class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors cursor-pointer"
            onclick={(e) => handleRemoveClick(account.name, e)}
            onkeydown={(e) => e.key === 'Enter' && handleRemoveClick(account.name, e)}
            role="button"
            tabindex="0"
            title="削除"
          >
            <XIcon class="w-3 h-3 text-white" />
          </span>
        {/if}
        <!-- Loading indicator -->
        {#if isSwitching === account.name}
          <div class="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
            <div class="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          </div>
        {/if}
      </div>
      <div class="text-xs text-gray-400 w-full my-2 text-center">{account.name}</div>
    </div>

	{/each}

	<!-- Spacer -->
	<div class="flex-grow"></div>

	<!-- Edit mode toggle button -->
	{#if sessionState.accounts.length > 0}
		<div>
      <button
        class="w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer
          {sessionState.isEditMode
            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white'}"
        onclick={() => toggleEditMode()}
        title={sessionState.isEditMode ? '完了' : '編集'}
      >
        {#if sessionState.isEditMode}
          <CircleCheckBigIcon class="w-5 h-5" />
        {:else}
          <PencilIcon class="w-5 h-5" />
        {/if}
      </button>
      <div class="text-xs text-gray-400 w-full my-2 text-center">編集</div>
    </div>
    
	{/if}

	<!-- Add account button -->
	<div>
    <button
      class="w-10 h-10 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center hover:bg-purple-500/30 hover:text-purple-300 transition-all cursor-pointer"
      onclick={onAddClick}
      title="アカウントを追加"
    >
      <PlusIcon class="w-5 h-5" />
    </button>
    <div class="text-xs text-gray-400 w-full my-2 text-center">追加</div>
  </div>
</div>

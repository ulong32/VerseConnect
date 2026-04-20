<script lang="ts">
  import {
    removeAccount,
    sessionState,
    switchAccount,
    toggleEditMode
  } from '$lib/stores/session.svelte';
  import CheckIcon from '@lucide/svelte/icons/check';
  import CircleCheckBigIcon from '@lucide/svelte/icons/circle-check-big';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import PencilLineIcon from '@lucide/svelte/icons/pencil-line';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import UserIcon from '@lucide/svelte/icons/user';
  import XIcon from '@lucide/svelte/icons/x';
  import { Avatar } from '@skeletonlabs/skeleton-svelte';

	interface Props {
		onAddClick: () => void;
		onEditClick?: (account: AipriAccount) => void;
	}

	let { onAddClick, onEditClick }: Props = $props();

	let isSwitching = $state<string | null>(null);

  async function handleAccountClick(accountId: string) {
		if (sessionState.isEditMode) return;
    if (accountId === sessionState.activeAccountId) return;

    isSwitching = accountId;
    await switchAccount(accountId);
		isSwitching = null;
	}

  async function handleRemoveClick(account: AipriAccount, e: Event) {
		e.stopPropagation();
    if (account.accountId === sessionState.activeAccountId) {
			// Can't remove active account if it's the only one
			if (sessionState.accounts.length === 1) {
				return;
			}
		}

		// Show confirmation dialog
		const confirmed = await window.electronAPI.showConfirmDialog({
			title: 'VerseConnect',
      message: `アカウント「${account.name}」を削除しますか？\nこの操作は取り消せません。`,
			okLabel: '削除',
			cancelLabel: 'キャンセル'
		});

		if (!confirmed) return;

    await removeAccount(account.accountId);

		// Exit edit mode if no accounts left
		if (sessionState.accounts.length === 0) {
			sessionState.isEditMode = false;
		}
	}

	function handleEditClick(account: AipriAccount, e: Event) {
		e.stopPropagation();
		if (onEditClick) {
			onEditClick(account);
		}
	}

	function getProfileImageUrl(account: AipriAccount): string | null {
		if (account.profileImagePath) {
			// Add cache-busting parameter using account id hash.
			const cacheBust = account.accountId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
			return `local-image://${encodeURIComponent(account.profileImagePath)}?t=${cacheBust}`;
		}
		return null;
	}
</script>

<div class="flex items-center gap-2 flex-wrap">
	<!-- Account icons -->
	{#each sessionState.accounts as account (account.accountId)}
		<div>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="relative group cursor-pointer transition-all duration-200 rounded-full"
        class:opacity-50={isSwitching && isSwitching !== account.accountId}
        class:ring-2={account.accountId === sessionState.activeAccountId}
        class:ring-purple-500={account.accountId === sessionState.activeAccountId}
        class:grayscale={isSwitching && isSwitching !== account.accountId}
        onclick={() => handleAccountClick(account.accountId)}
        onkeydown={(e) => e.key === 'Enter' && handleAccountClick(account.accountId)}
        role="button"
        tabindex={isSwitching !== null ? -1 : 0}
        title={account.name}
      >
        <!-- Profile image or default avatar -->
        <Avatar class="size-12 overflow-hidden bg-white/10 border-2 border-white/20 hover:border-purple-400 transition-colors">
          <Avatar.Image
            src={getProfileImageUrl(account) || ''}
            alt={account.name}
            class="size-full object-cover"
          />
          <Avatar.Fallback class="size-full flex items-center justify-center">
            <UserIcon class="size-6 text-gray-400" />
          </Avatar.Fallback>
        </Avatar>
        <!-- Active checkmark -->
        {#if account.accountId === sessionState.activeAccountId && !sessionState.isEditMode}
          <div class="absolute -top-1 -right-1 size-5 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
            <CheckIcon class="size-3 text-white" />
          </div>
        {/if}
        <!-- Edit button (edit mode) - top left -->
        {#if sessionState.isEditMode}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <span
            class="absolute -top-1 -left-1 size-5 bg-blue-500 rounded-full flex items-center justify-center shadow-lg hover:bg-blue-600 transition-colors cursor-pointer"
            onclick={(e) => handleEditClick(account, e)}
            onkeydown={(e) => e.key === 'Enter' && handleEditClick(account, e)}
            role="button"
            tabindex="0"
            title="編集"
          >
            <PencilLineIcon class="size-3 text-white" />
          </span>
        {/if}
        <!-- Remove button (edit mode) - top right -->
        {#if sessionState.isEditMode && !(account.accountId === sessionState.activeAccountId && sessionState.accounts.length === 1)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <span
            class="absolute -top-1 -right-1 size-5 bg-red-500 rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors cursor-pointer"
            onclick={(e) => handleRemoveClick(account, e)}
            onkeydown={(e) => e.key === 'Enter' && handleRemoveClick(account, e)}
            role="button"
            tabindex="0"
            title="削除"
          >
            <XIcon class="size-3 text-white" />
          </span>
        {/if}
        <!-- Loading indicator -->
        {#if isSwitching === account.accountId}
          <div class="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
            <div class="size-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          </div>
        {/if}
      </div>
      <div class="text-xs text-gray-400 w-full my-2 text-center">{account.name}</div>
    </div>

	{/each}

	<!-- Spacer -->
	<div class="grow"></div>

	<!-- Edit mode toggle button -->
	{#if sessionState.accounts.length > 0}
		<div>
      <button
        class="size-10 rounded-full flex items-center justify-center transition-all cursor-pointer
          {sessionState.isEditMode
            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white'}"
        onclick={() => toggleEditMode()}
        title={sessionState.isEditMode ? '完了' : '編集'}
      >
        {#if sessionState.isEditMode}
          <CircleCheckBigIcon class="size-5" />
        {:else}
          <PencilIcon class="size-5" />
        {/if}
      </button>
      <div class="text-xs text-gray-400 w-full my-2 text-center">編集</div>
    </div>

	{/if}

	<!-- Add account button -->
	<div>
    <button
      class="size-10 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center hover:bg-purple-500/30 hover:text-purple-300 transition-all cursor-pointer"
      onclick={onAddClick}
      title="アカウントを追加"
    >
      <PlusIcon class="size-5" />
    </button>
    <div class="text-xs text-gray-400 w-full my-2 text-center">追加</div>
  </div>
</div>

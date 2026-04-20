<script lang="ts">
	import { beforeNavigate, goto } from '$app/navigation';
	import AccountSelector from '$lib/components/AccountSelector.svelte';
	import {
	  checkSession,
	  loadAccounts,
	  login,
	  logout,
	  sessionState,
	  updateAccount
	} from '$lib/stores/session.svelte';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import CircleCheckBigIcon from '@lucide/svelte/icons/circle-check-big';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import LogInIcon from '@lucide/svelte/icons/log-in';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import XIcon from '@lucide/svelte/icons/x';
	import { Progress } from '@skeletonlabs/skeleton-svelte';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';

	// Track if navigating to root for conditional out transition
	let navigatingToRoot = $state(false);

	beforeNavigate(({ to }) => {
		navigatingToRoot = to?.url.pathname === '/';
	});

	// UI state for add/edit account form
	let showAddForm = $state(false);
	let editingAccount = $state<AipriAccount | null>(null);

	// Form state
	let cardId = $state('');
	let name = $state('');
	let birthdayM = $state('');
	let birthdayD = $state('');

	// Validation errors (shown on blur)
	let cardIdError = $state('');
	let nameError = $state('');
	let birthdayMError = $state('');
	let birthdayDError = $state('');

	// Touched state for blur validation
	let cardIdTouched = $state(false);
	let nameTouched = $state(false);
	let birthdayMTouched = $state(false);
	let birthdayDTouched = $state(false);

	// Loading state
	let isLoggingIn = $state(false);

	// Import state
	let selectedYm = $state('');
	let isImporting = $state(false);
	let importProgress = $state({ current: 0, total: 0, skipped: 0 });
	let importResult = $state<{ success: boolean; message: string } | null>(null);
	let folderPath = $state('');
	let subFolder = $state('');

	// Generate year-month options
	function getYmOptions(): { value: string; label: string }[] {
		const now = new Date();
		const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

		const formatYm = (d: Date) => {
			return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
		};

		const formatLabel = (d: Date) => {
			return `${d.getFullYear()}年${d.getMonth() + 1}月`;
		};

		return [
			{ value: formatYm(thisMonth), label: `今月 (${formatLabel(thisMonth)})` },
			{ value: formatYm(lastMonth), label: `先月 (${formatLabel(lastMonth)})` }
		];
	}

	const ymOptions = getYmOptions();

	// Helper: delay function
	const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

	// Import photos
	async function handleImport() {
		if (!selectedYm || isImporting) return;

		// Get folder path from settings
		const settings = await window.electronAPI.getSettings();
		const baseFolderPath = settings.folderPath;

		if (!baseFolderPath) {
			importResult = { success: false, message: 'フォルダが設定されていません。設定画面で保存先フォルダを選択してください。' };
			return;
		}

		// Combine base folder path with subfolder if specified
		if (subFolder.trim()) {
			folderPath = `${baseFolderPath}/${subFolder.trim()}`;
		} else {
			folderPath = baseFolderPath;
		}

		isImporting = true;
		importResult = null;
		importProgress = { current: 0, total: 0, skipped: 0 };

		try {
			// Fetch photo list (backend handles session retry automatically)
			const fetchResult = await window.electronAPI.aipriFetchPhotos(selectedYm) as AipriFetchPhotosResult & { reloggedIn?: boolean };

			if (fetchResult.reloggedIn) {
				// Keep renderer state in sync with store when backend auto re-login occurred.
				await loadAccounts();
			}

			if (!fetchResult.success || !fetchResult.photos) {
				importResult = { success: false, message: fetchResult.error || 'フォトリストの取得に失敗しました' };
				isImporting = false;
				return;
			}

			const photos = fetchResult.photos;

			if (photos.length === 0) {
				importResult = { success: true, message: 'この月の写真は見つかりませんでした' };
				isImporting = false;
				return;
			}

			importProgress.total = photos.length;

			let downloadedCount = 0;
			let skippedCount = 0;
			let errorCount = 0;

			// Download each photo with delay
			for (const photo of photos) {
				const filename = `aipriverse_album_${photo.play_date.replace(/-/g, '')}_${photo.photo_seq}.jpg`;

				const result = await window.electronAPI.aipriDownloadPhoto(
					photo.photo_file_url,
					filename,
					folderPath
				);

				if (result.success) {
					if (result.skipped) {
						skippedCount++;
					} else {
						downloadedCount++;
					}
				} else {
					errorCount++;
					console.error('Download failed:', photo.photo_file_url, result.error);
				}

				importProgress.current++;
				importProgress.skipped = skippedCount;

				// Wait 200ms before next download
				if (importProgress.current < photos.length) {
					await delay(200);
				}
			}

			// Build result message
			if (downloadedCount === 0 && skippedCount === photos.length) {
				importResult = { success: true, message: 'すべて既存のためスキップしました' };
			} else if (errorCount > 0) {
				importResult = { success: false, message: `${downloadedCount}枚をインポート、${skippedCount}枚をスキップ、${errorCount}枚がエラー` };
			} else {
				importResult = { success: true, message: `${downloadedCount}枚をインポートしました${skippedCount > 0 ? `（${skippedCount}枚既存）` : ''}` };
			}
		} catch (error) {
			importResult = { success: false, message: `エラーが発生しました: ${String(error)}` };
		} finally {
			isImporting = false;
		}
	}

	// Validation functions
	function validateCardId(value: string): string {
		if (!value) return 'カードIDを入力してください';
		const pattern = /^[0-9A-Z]{8}-[0-9A-Z]{7}$/;
		if (!pattern.test(value)) {
			return 'カードIDは「00000000-0000000」の形式で入力してください（英数字大文字）';
		}
		return '';
	}

	function validateName(value: string): string {
		if (!value) return '名前を入力してください';
		if (value.length > 10) return '名前は10文字以内で入力してください';
		return '';
	}

	function validateBirthdayM(value: string): string {
		if (!value) return '月を入力してください';
		const month = parseInt(value, 10);
		if (isNaN(month) || month < 1 || month > 12) {
			return '1〜12の月を入力してください';
		}
		return '';
	}

	function validateBirthdayD(value: string, month: string): string {
		if (!value) return '日を入力してください';
		const day = parseInt(value, 10);
		const m = parseInt(month, 10);

		if (isNaN(day) || day < 1) {
			return '有効な日を入力してください';
		}

		// Days per month (ignoring leap years for simplicity)
		const daysInMonth: Record<number, number> = {
			1: 31, 2: 29, 3: 31, 4: 30, 5: 31, 6: 30,
			7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31
		};

		const maxDays = daysInMonth[m] || 31;
		if (day > maxDays) {
			return `${m}月は${maxDays}日までです`;
		}

		return '';
	}

	// Blur handlers for validation
	function handleCardIdBlur() {
		cardIdTouched = true;
		cardIdError = validateCardId(cardId);
	}

	function handleNameBlur() {
		nameTouched = true;
		nameError = validateName(name);
	}

	function handleBirthdayMBlur() {
		birthdayMTouched = true;
		birthdayMError = validateBirthdayM(birthdayM);
		// Also revalidate day if month changes
		if (birthdayDTouched) {
			birthdayDError = validateBirthdayD(birthdayD, birthdayM);
		}
	}

	function handleBirthdayDBlur() {
		birthdayDTouched = true;
		birthdayDError = validateBirthdayD(birthdayD, birthdayM);
	}

	// Format helpers
	function formatCardId(value: string): string {
		// Remove any non-alphanumeric characters and convert to uppercase
		const clean = value.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
		// Insert hyphen after 8 characters
		if (clean.length > 8) {
			return clean.slice(0, 8) + '-' + clean.slice(8, 15);
		}
		return clean;
	}

	function formatMonth(value: string): string {
		const num = value.replace(/\D/g, '');
		if (num.length === 1 && parseInt(num) > 1) {
			return num.padStart(2, '0');
		}
		return num.slice(0, 2);
	}

	function formatDay(value: string): string {
		const num = value.replace(/\D/g, '');
		if (num.length === 1 && parseInt(num) > 3) {
			return num.padStart(2, '0');
		}
		return num.slice(0, 2);
	}

	// Input handlers
	function handleCardIdInput(e: Event) {
		const target = e.target as HTMLInputElement;
		cardId = formatCardId(target.value);
	}

	function handleBirthdayMInput(e: Event) {
		const target = e.target as HTMLInputElement;
		birthdayM = formatMonth(target.value);
	}

	function handleBirthdayDInput(e: Event) {
		const target = e.target as HTMLInputElement;
		birthdayD = formatDay(target.value);
	}

	// Check if form is valid
	function isFormValid(): boolean {
		return !validateCardId(cardId) &&
			   !validateName(name) &&
			   !validateBirthdayM(birthdayM) &&
			   !validateBirthdayD(birthdayD, birthdayM);
	}

	// Login/Update handler
	async function handleLogin() {
		// Validate all fields
		cardIdTouched = nameTouched = birthdayMTouched = birthdayDTouched = true;
		cardIdError = validateCardId(cardId);
		nameError = validateName(name);
		birthdayMError = validateBirthdayM(birthdayM);
		birthdayDError = validateBirthdayD(birthdayD, birthdayM);

		if (!isFormValid()) return;

		isLoggingIn = true;

		const credentials: AipriLoginCredentials = {
			cardId,
			name,
			birthdayM: birthdayM.padStart(2, '0'),
			birthdayD: birthdayD.padStart(2, '0')
		};

		if (editingAccount) {
			// Update existing account
			const result = await updateAccount(editingAccount.accountId, credentials);
			isLoggingIn = false;

			if (result.success) {
				showAddForm = false;
				editingAccount = null;
				resetForm();
			}
		} else {
			// Add new account
			await login(credentials);
			isLoggingIn = false;

			// Close add form on successful login
			if (sessionState.isLoggedIn) {
				showAddForm = false;
				resetForm();
			}
		}
	}

	// Reset form fields
	function resetForm() {
		cardId = '';
		name = '';
		birthdayM = '';
		birthdayD = '';
		cardIdError = '';
		nameError = '';
		birthdayMError = '';
		birthdayDError = '';
		cardIdTouched = false;
		nameTouched = false;
		birthdayMTouched = false;
		birthdayDTouched = false;
	}

	// Logout handler
	async function handleLogout() {
		const confirmed = await window.electronAPI.showConfirmDialog({
			title: 'VerseConnect',
			message: '全てのアカウントからログアウトします。\nこの操作を実行すると、保存されているすべてのセッション情報が削除されます。\n\n続行しますか？',
			okLabel: 'ログアウト',
			cancelLabel: 'キャンセル'
		});
		if (confirmed) {
			await logout();
		}
	}

	// Check session on mount
	onMount(() => {
		checkSession();
		// Set default selected month
		if (ymOptions.length > 0) {
			selectedYm = ymOptions[0].value;
		}
	});
</script>

<div class="bg-linear-to-br from-[#1a1a2e] to-[#16213e] p-6" in:fly={{ duration: 250, y: "10vh", opacity: 0}} out:fly={{ duration: navigatingToRoot ? 250 : 0, y: "10vh", opacity: 0}}>
	<div class="max-w-2xl mx-auto">
		<!-- Header -->
		<div class="flex items-center align-center gap-4 mb-8">
			<button onclick={() => goto('/')}>
				<ArrowLeftIcon class="size-8 text-white bg-white/10 rounded-lg p-1" />
			</button>
			<h1 class="text-2xl font-bold text-white">インポート</h1>
		</div>

		{#if sessionState.isChecking}
			<!-- Loading state -->
			<div class="flex items-center justify-center h-48">
				<LoaderIcon class="size-8 text-purple-400 animate-spin" />
				<span class="ml-3 text-gray-400">セッションを確認中...</span>
			</div>
		{:else if sessionState.isLoggedIn}
			<!-- Logged in state -->
			<section class="mb-8">
				<div class="bg-white/5 rounded-xl p-6 backdrop-blur-sm">
					<div class="flex items-center gap-4 mb-4">
						<CircleCheckBigIcon class="size-6 text-green-400" />
						<h2 class="text-lg font-semibold text-white">ログイン済み</h2>
					</div>

					<!-- Account Selector -->
					<div class="mb-6">
						<p class="text-gray-400 text-sm mb-3">アカウント</p>
						<AccountSelector
							onAddClick={() => showAddForm = true}
							onEditClick={(account) => {
								editingAccount = account;
								cardId = account.cardId;
								name = account.name;
								birthdayM = account.birthdayM;
								birthdayD = account.birthdayD;
								showAddForm = true;
							}}
						/>
					</div>

					<!-- Import Section -->
					<div class="border-t border-white/10 pt-6 mt-6">
						<h3 class="text-md font-semibold text-white mb-4 flex items-center gap-2">
							<DownloadIcon class="size-5 text-purple-400" />
							フォトをインポート
						</h3>

						<!-- Month Selection -->
						<div class="mb-4">
							<label for="targetYm" class="block text-sm font-medium text-gray-300 mb-2">
								対象月
							</label>
							<select
								id="targetYm"
								class="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
								bind:value={selectedYm}
								disabled={isImporting}
							>
								{#each ymOptions as option}
									<option value={option.value} class="bg-gray-800">{option.label}</option>
								{/each}
							</select>
						</div>

						<!-- Subfolder Input -->
						<div class="mb-4">
							<label for="subFolder" class="block text-sm font-medium text-gray-300 mb-2">
								保存先サブフォルダ（任意）
							</label>
							<input
								type="text"
								id="subFolder"
								class="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
								placeholder="例: aipriverse_album_20xxxx"
								bind:value={subFolder}
								disabled={isImporting}
							/>
							<p class="mt-1 text-xs text-gray-400">
								設定のフォルダパスに追加されます
							</p>
						</div>

						<!-- Import Button -->
						<button
							class="w-full px-4 py-3 bg-linear-to-r from-emerald-500 to-teal-600 border-none rounded-lg text-white font-semibold cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-2 mb-4"
							onclick={handleImport}
							disabled={isImporting || !selectedYm}
						>
							{#if isImporting}
								<LoaderIcon class="size-5 animate-spin" />
								インポート中...
							{:else}
								<DownloadIcon class="size-5" />
								インポート開始
							{/if}
						</button>

						<!-- Progress Bar -->
						{#if isImporting && importProgress.total > 0}
							<div class="bg-white/10 rounded-lg p-4 mb-4">
								<Progress value={(importProgress.current / importProgress.total) * 100} class="w-full space-y-2">
									<div class="flex justify-between text-sm text-gray-300">
										<Progress.Label>ダウンロード中... {importProgress.current} / {importProgress.total}</Progress.Label>
										{#if importProgress.skipped > 0}
											<span class="text-gray-400">({importProgress.skipped}件スキップ)</span>
										{/if}
									</div>
									<Progress.Track class="bg-white/20 h-2 rounded-full overflow-hidden">
										<Progress.Range class="bg-linear-to-r from-emerald-400 to-teal-500 h-full transition-all duration-300" />
									</Progress.Track>
								</Progress>
							</div>
						{/if}

						<!-- Result Message -->
						{#if importResult}
							<div class="p-3 rounded-lg {importResult.success ? 'bg-green-500/20 border border-green-500/50' : 'bg-red-500/20 border border-red-500/50'}">
								<p class="{importResult.success ? 'text-green-300' : 'text-red-300'} flex items-center gap-2">
									{#if importResult.success}
										<CircleCheckBigIcon class="size-5" />
									{:else}
										<CircleAlertIcon class="size-5" />
									{/if}
									{importResult.message}
								</p>
							</div>
						{/if}
					</div>

					<!-- Logout Button -->
					<div class="border-t border-white/10 pt-6 mt-6">
						<button
							class="w-full px-4 py-3 bg-linear-to-r from-red-500 to-rose-600 border-none rounded-lg text-white font-semibold cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-red-500/40 flex items-center justify-center gap-2"
							onclick={handleLogout}
						>
							<LogOutIcon class="size-5" />
							全アカウントからログアウト
						</button>
					</div>
				</div>
			</section>

			<!-- Add/Edit Account Modal Overlay -->
			{#if showAddForm}
				<div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
					<div class="bg-[#1e1e2e] rounded-xl p-6 w-full max-w-md shadow-2xl border border-white/10">
						<div class="flex items-center justify-between mb-4">
							<h2 class="text-lg font-semibold text-white flex items-center gap-2">
								<LogInIcon class="size-5 text-purple-400" />
								{editingAccount ? 'アカウント情報を編集' : 'アカウントを追加'}
							</h2>
							<button
								class="text-gray-400 hover:text-white transition-colors cursor-pointer"
								onclick={() => { showAddForm = false; editingAccount = null; resetForm(); }}
							>
								<XIcon class="size-5" />
							</button>
						</div>

						<div class="space-y-4">
							<!-- Card ID -->
							<div>
								<label for="addCardId" class="block text-sm font-medium text-gray-300 mb-2">
									カードID
								</label>
								<input
									type="text"
									id="addCardId"
									class="w-full px-3 py-2 bg-white/10 border rounded-lg text-white placeholder:text-gray-500 focus:outline-none transition-colors {cardIdTouched && cardIdError ? 'border-red-500 focus:border-red-500' : 'border-white/20 focus:border-purple-500'}"
									placeholder="00000000-0000000"
									maxlength="16"
									bind:value={cardId}
									oninput={handleCardIdInput}
									onblur={handleCardIdBlur}
								/>
								{#if cardIdTouched && cardIdError}
									<p class="mt-1 text-sm text-red-400 flex items-center gap-1">
										<CircleAlertIcon class="size-4" />
										{cardIdError}
									</p>
								{/if}
							</div>

							<!-- Name -->
							<div>
								<label for="addName" class="block text-sm font-medium text-gray-300 mb-2">
									名前
								</label>
								<input
									type="text"
									id="addName"
									class="w-full px-3 py-2 bg-white/10 border rounded-lg text-white placeholder:text-gray-500 focus:outline-none transition-colors {nameTouched && nameError ? 'border-red-500 focus:border-red-500' : 'border-white/20 focus:border-purple-500'}"
									placeholder="10文字まで"
									maxlength="10"
									bind:value={name}
									onblur={handleNameBlur}
								/>
								{#if nameTouched && nameError}
									<p class="mt-1 text-sm text-red-400 flex items-center gap-1">
										<CircleAlertIcon class="size-4" />
										{nameError}
									</p>
								{/if}
							</div>

							<!-- Birthday -->
							<div>
								<label for="addBirthdayM" class="block text-sm font-medium text-gray-300 mb-2">
									誕生日
								</label>
								<div class="flex items-center gap-2">
									<input
										type="text"
										id="addBirthdayM"
										inputmode="numeric"
										class="w-20 px-3 py-2 bg-white/10 border rounded-lg text-white placeholder:text-gray-500 focus:outline-none transition-colors text-center {birthdayMTouched && birthdayMError ? 'border-red-500 focus:border-red-500' : 'border-white/20 focus:border-purple-500'}"
										placeholder="01"
										maxlength="2"
										bind:value={birthdayM}
										oninput={handleBirthdayMInput}
										onblur={handleBirthdayMBlur}
									/>
									<span class="text-gray-400">月</span>
									<input
										type="text"
										id="addBirthdayD"
										inputmode="numeric"
										class="w-20 px-3 py-2 bg-white/10 border rounded-lg text-white placeholder:text-gray-500 focus:outline-none transition-colors text-center {birthdayDTouched && birthdayDError ? 'border-red-500 focus:border-red-500' : 'border-white/20 focus:border-purple-500'}"
										placeholder="01"
										maxlength="2"
										bind:value={birthdayD}
										oninput={handleBirthdayDInput}
										onblur={handleBirthdayDBlur}
									/>
									<span class="text-gray-400">日</span>
								</div>
								{#if birthdayMTouched && birthdayMError}
									<p class="mt-1 text-sm text-red-400 flex items-center gap-1">
										<CircleAlertIcon class="size-4" />
										{birthdayMError}
									</p>
								{/if}
								{#if birthdayDTouched && birthdayDError}
									<p class="mt-1 text-sm text-red-400 flex items-center gap-1">
										<CircleAlertIcon class="size-4" />
										{birthdayDError}
									</p>
								{/if}
							</div>

							<!-- Error message from server -->
							{#if sessionState.error}
								<div class="p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
									<p class="text-red-300 flex items-center gap-2">
										<CircleAlertIcon class="size-5" />
										{sessionState.error}
									</p>
								</div>
							{/if}

							<!-- Add/Update button -->
							<button
								class="w-full px-4 py-3 bg-linear-to-r from-indigo-500 to-purple-600 border-none rounded-lg text-white font-semibold cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-2"
								onclick={handleLogin}
								disabled={isLoggingIn}
							>
								{#if isLoggingIn}
									<LoaderIcon class="size-5 animate-spin" />
									{editingAccount ? '更新中...' : 'ログイン中...'}
								{:else}
									<LogInIcon class="size-5" />
									{editingAccount ? 'アカウントを更新' : 'アカウントを追加'}
								{/if}
							</button>
						</div>
					</div>
				</div>
			{/if}
		{:else}
			<!-- Login form -->
			<section class="mb-8">
				<h2 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
					<LogInIcon class="size-5 text-purple-400" />
					アイプリマイページログイン
				</h2>

				<div class="bg-white/5 rounded-xl p-6 backdrop-blur-sm space-y-4">
					<!-- Card ID -->
					<div>
						<label for="cardId" class="block text-sm font-medium text-gray-300 mb-2">
							カードID
						</label>
						<input
							type="text"
							id="cardId"
							class="w-full px-3 py-2 bg-white/10 border rounded-lg text-white placeholder:text-gray-500 focus:outline-none transition-colors {cardIdTouched && cardIdError ? 'border-red-500 focus:border-red-500' : 'border-white/20 focus:border-purple-500'}"
							placeholder="00000000-0000000"
							maxlength="16"
							bind:value={cardId}
							oninput={handleCardIdInput}
							onblur={handleCardIdBlur}
						/>
						{#if cardIdTouched && cardIdError}
							<p class="mt-1 text-sm text-red-400 flex items-center gap-1">
								<CircleAlertIcon class="size-4" />
								{cardIdError}
							</p>
						{/if}
					</div>

					<!-- Name -->
					<div>
						<label for="name" class="block text-sm font-medium text-gray-300 mb-2">
							名前
						</label>
						<input
							type="text"
							id="name"
							class="w-full px-3 py-2 bg-white/10 border rounded-lg text-white placeholder:text-gray-500 focus:outline-none transition-colors {nameTouched && nameError ? 'border-red-500 focus:border-red-500' : 'border-white/20 focus:border-purple-500'}"
							placeholder="10文字まで"
							maxlength="10"
							bind:value={name}
							onblur={handleNameBlur}
						/>
						{#if nameTouched && nameError}
							<p class="mt-1 text-sm text-red-400 flex items-center gap-1">
								<CircleAlertIcon class="size-4" />
								{nameError}
							</p>
						{/if}
					</div>

					<div>
						<label for="birthdayM" class="block text-sm font-medium text-gray-300 mb-2">
							誕生日
						</label>
						<div class="flex items-center gap-2">
							<input
								type="text"
								id="birthdayM"
								inputmode="numeric"
								class="w-20 px-3 py-2 bg-white/10 border rounded-lg text-white placeholder:text-gray-500 focus:outline-none transition-colors text-center {birthdayMTouched && birthdayMError ? 'border-red-500 focus:border-red-500' : 'border-white/20 focus:border-purple-500'}"
								placeholder="01"
								maxlength="2"
								bind:value={birthdayM}
								oninput={handleBirthdayMInput}
								onblur={handleBirthdayMBlur}
							/>
							<span class="text-gray-400">月</span>
							<input
								type="text"
								id="birthdayD"
								inputmode="numeric"
								class="w-20 px-3 py-2 bg-white/10 border rounded-lg text-white placeholder:text-gray-500 focus:outline-none transition-colors text-center {birthdayDTouched && birthdayDError ? 'border-red-500 focus:border-red-500' : 'border-white/20 focus:border-purple-500'}"
								placeholder="01"
								maxlength="2"
								bind:value={birthdayD}
								oninput={handleBirthdayDInput}
								onblur={handleBirthdayDBlur}
							/>
							<span class="text-gray-400">日</span>
						</div>
						{#if birthdayMTouched && birthdayMError}
							<p class="mt-1 text-sm text-red-400 flex items-center gap-1">
								<CircleAlertIcon class="size-4" />
								{birthdayMError}
							</p>
						{/if}
						{#if birthdayDTouched && birthdayDError}
							<p class="mt-1 text-sm text-red-400 flex items-center gap-1">
								<CircleAlertIcon class="size-4" />
								{birthdayDError}
							</p>
						{/if}
					</div>

					<!-- Error message from server -->
					{#if sessionState.error}
						<div class="p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
							<p class="text-red-300 flex items-center gap-2">
								<CircleAlertIcon class="size-5" />
								{sessionState.error}
							</p>
						</div>
					{/if}

					<!-- Login button -->
					<button
						class="w-full px-4 py-3 bg-linear-to-r from-indigo-500 to-purple-600 border-none rounded-lg text-white font-semibold cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-2"
						onclick={handleLogin}
						disabled={isLoggingIn}
					>
						{#if isLoggingIn}
							<LoaderIcon class="size-5 animate-spin" />
							ログイン中...
						{:else}
							<LogInIcon class="size-5" />
							ログイン
						{/if}
					</button>
				</div>
			</section>
		{/if}
	</div>
</div>

<script lang="ts">
	import { ArrowLeftIcon, LogInIcon, LogOutIcon, AlertCircleIcon, CheckCircleIcon, LoaderIcon } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { 
		sessionState, 
		checkSession, 
		login, 
		logout
	} from '$lib/stores/session.svelte';

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

	// Login handler
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

		await login(credentials);
		isLoggingIn = false;
	}

	// Logout handler
	async function handleLogout() {
		await logout();
	}

	// Check session on mount
	onMount(() => {
		checkSession();
	});
</script>

<div class="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-6">
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
				<LoaderIcon class="w-8 h-8 text-purple-400 animate-spin" />
				<span class="ml-3 text-gray-400">セッションを確認中...</span>
			</div>
		{:else if sessionState.isLoggedIn}
			<!-- Logged in state -->
			<section class="mb-8">
				<div class="bg-white/5 rounded-xl p-6 backdrop-blur-sm">
					<div class="flex items-center gap-4 mb-4">
						<CheckCircleIcon class="w-6 h-6 text-green-400" />
						<h2 class="text-lg font-semibold text-white">ログイン済み</h2>
					</div>

					{#if sessionState.profileImageUrl}
						<div class="flex flex-col items-center gap-4 mb-6">
							<p class="text-gray-400 text-sm">プロフィール画像</p>
							<img 
								src={sessionState.profileImageUrl} 
								alt="プロフィール" 
								class="w-32 h-32 rounded-full object-cover border-4 border-purple-500/50 shadow-lg shadow-purple-500/20"
							/>
						</div>
					{/if}

					<button
						class="w-full px-4 py-3 bg-gradient-to-r from-red-500 to-rose-600 border-none rounded-lg text-white font-semibold cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-red-500/40 flex items-center justify-center gap-2"
						onclick={handleLogout}
					>
						<LogOutIcon class="w-5 h-5" />
						ログアウト
					</button>
				</div>
			</section>
		{:else}
			<!-- Login form -->
			<section class="mb-8">
				<h2 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
					<LogInIcon class="w-5 h-5 text-purple-400" />
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
								<AlertCircleIcon class="w-4 h-4" />
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
								<AlertCircleIcon class="w-4 h-4" />
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
								<AlertCircleIcon class="w-4 h-4" />
								{birthdayMError}
							</p>
						{/if}
						{#if birthdayDTouched && birthdayDError}
							<p class="mt-1 text-sm text-red-400 flex items-center gap-1">
								<AlertCircleIcon class="w-4 h-4" />
								{birthdayDError}
							</p>
						{/if}
					</div>

					<!-- Error message from server -->
					{#if sessionState.error}
						<div class="p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
							<p class="text-red-300 flex items-center gap-2">
								<AlertCircleIcon class="w-5 h-5" />
								{sessionState.error}
							</p>
						</div>
					{/if}

					<!-- Login button -->
					<button
						class="w-full px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 border-none rounded-lg text-white font-semibold cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-2"
						onclick={handleLogin}
						disabled={isLoggingIn}
					>
						{#if isLoggingIn}
							<LoaderIcon class="w-5 h-5 animate-spin" />
							ログイン中...
						{:else}
							<LogInIcon class="w-5 h-5" />
							ログイン
						{/if}
					</button>
				</div>
			</section>
		{/if}
	</div>
</div>

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

declare global {
	interface ImageMetadata {
		characters: string[];
		item: string;
		friend_card?: string;  // Filename of linked friend card image
		tags?: string[];  // User-defined custom tags
	}

	interface ImageInfo {
		name: string;
		path: string;
		url: string;
		metadata?: ImageMetadata;
		folder?: string;  // Relative folder path from root
		extractedDate?: string;  // Date from filename (YYYY-MM-DD format)
		serial?: number;  // Serial number from filename
	}

	interface FolderMetadata {
		[imageName: string]: ImageMetadata;
	}

	interface Settings {
		folderPath: string;
		customCharacters: string[];
		customTags: string[];  // App-wide tag presets
	}

	interface ZipExtractionResult {
		success: boolean;
		extracted: number;
		error?: string;
	}

	interface FriendCardResult {
		success: boolean;
		filename?: string;
		error?: string;
	}

	interface AipriLoginCredentials {
		cardId: string;
		name: string;
		birthdayM: string;
		birthdayD: string;
	}

	interface AipriLoginResult {
		success: boolean;
		error?: string;
		profileImageUrl?: string | null;
		redirectUrl?: string;
	}

	interface AipriSessionCheckResult {
		valid: boolean;
		reason?: string;
		profileImageUrl?: string | null;
	}

	interface AipriClearSessionResult {
		success: boolean;
	}

	interface AipriPhoto {
		photo_seq: number;
		play_date: string;
		photo_file_url: string;
		thumb_file_url: string;
		page_path: string;
		friend_card_flg: 0 | 1;
	}

	interface AipriFetchPhotosResult {
		success: boolean;
		photos?: AipriPhoto[];
		error?: string;
	}

	interface AipriDownloadResult {
		success: boolean;
		skipped?: boolean;
		error?: string;
	}

	// Multi-account types
	interface AipriAccount {
		name: string;  // Unique key
		cardId: string;
		birthdayM: string;
		birthdayD: string;
		sessionCookie: string | null;
		profileImagePath: string | null;  // Local path to cached profile image
	}

	interface AipriAccountsResult {
		accounts: AipriAccount[];
		activeAccountName: string | null;
	}

	interface AipriSwitchAccountResult {
		success: boolean;
		error?: string;
		profileImageUrl?: string;
		reloggedIn?: boolean;  // True if session was expired and re-login was performed
	}

	interface AipriAddAccountResult {
		success: boolean;
		error?: string;
		profileImagePath?: string;
	}

	interface AipriRemoveAccountResult {
		success: boolean;
	}

	interface ElectronAPI {
		selectFolder: () => Promise<string | null>;
		getImages: (folderPath: string) => Promise<ImageInfo[]>;
		getSettings: () => Promise<Settings>;
		setSettings: (settings: Partial<Settings>) => Promise<boolean>;
		getImageMetadata: (folderPath: string, imageName: string) => Promise<ImageMetadata | null>;
		setImageMetadata: (folderPath: string, imageName: string, metadata: ImageMetadata) => Promise<boolean>;
		extractZip: (zipPath: string, targetFolder: string) => Promise<ZipExtractionResult>;
		showItemInFolder: (filePath: string) => Promise<boolean>;
		showConfirmDialog: (options: DialogOptions) => Promise<boolean>;
		saveFriendCard: (folderPath: string, filename: string, base64Data: string) => Promise<FriendCardResult>;
		// Aipri API
		aipriLogin: (credentials: AipriLoginCredentials) => Promise<AipriLoginResult>;
		aipriCheckSession: () => Promise<AipriSessionCheckResult>;
		aipriClearSession: () => Promise<AipriClearSessionResult>;
		aipriFetchPhotos: (targetYm: string) => Promise<AipriFetchPhotosResult>;
		aipriDownloadPhoto: (url: string, filename: string, folderPath: string) => Promise<AipriDownloadResult>;
		// Multi-account API
		aipriGetAccounts: () => Promise<AipriAccountsResult>;
		aipriAddAccount: (credentials: AipriLoginCredentials) => Promise<AipriAddAccountResult>;
		aipriRemoveAccount: (name: string) => Promise<AipriRemoveAccountResult>;
		aipriSwitchAccount: (name: string) => Promise<AipriSwitchAccountResult>;
	}

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface Window {
		electronAPI: ElectronAPI;
	}
}

export { };

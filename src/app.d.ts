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

	interface ElectronAPI {
		selectFolder: () => Promise<string | null>;
		getImages: (folderPath: string) => Promise<ImageInfo[]>;
		getSettings: () => Promise<Settings>;
		setSettings: (settings: Partial<Settings>) => Promise<boolean>;
		getImageMetadata: (folderPath: string, imageName: string) => Promise<ImageMetadata | null>;
		setImageMetadata: (folderPath: string, imageName: string, metadata: ImageMetadata) => Promise<boolean>;
		extractZip: (zipPath: string, targetFolder: string) => Promise<ZipExtractionResult>;
		showItemInFolder: (filePath: string) => Promise<boolean>;
		saveFriendCard: (folderPath: string, filename: string, base64Data: string) => Promise<FriendCardResult>;
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

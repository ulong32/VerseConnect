<script lang="ts">
	import { CalendarIcon, FolderClosedIcon, HashIcon, ImageIcon, ShirtIcon, TagIcon, UserRoundIcon } from '@lucide/svelte';
	import { ITEM_IMAGE_SUFFIX, settingsState } from '$lib/stores/settings.svelte';
	interface Props {
		image: ImageInfo;
		onclick: () => void;
		showInfo?: boolean;
	}

	let { image, onclick, showInfo = true }: Props = $props();

	// Parallax effect state
	let transformX = $state(0);
	let transformY = $state(0);
	let isHovering = $state(false);

	// Max offset in pixels for parallax effect
	const PARALLAX_INTENSITY = 8;

	function handleMouseMove(e: MouseEvent) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		// Calculate mouse position relative to center (-0.5 to 0.5)
		const relativeX = (e.clientX - rect.left) / rect.width - 0.5;
		const relativeY = (e.clientY - rect.top) / rect.height - 0.5;
		// Move in opposite direction (inverse parallax)
		transformX = -relativeX * PARALLAX_INTENSITY * 2;
		transformY = -relativeY * PARALLAX_INTENSITY * 2;
		isHovering = true;
	}

	function handleMouseLeave() {
		transformX = 0;
		transformY = 0;
		isHovering = false;
	}

	// Get static folder path for item image
	function getStaticItemImageSrc(item: string): string {
		return `/item/${item}${ITEM_IMAGE_SUFFIX}`;
	}

	// Build item image src based on settings
	function getItemImageSrc(item: string): string {
		if (settingsState.itemImageFolderPath) {
			// Use custom protocol with user-configured folder
			return `item-image://${item}${ITEM_IMAGE_SUFFIX}`;
		}
		// Fallback to static folder
		return getStaticItemImageSrc(item);
	}

	// Handle image load error with fallback
	function handleItemImageError(e: Event, item: string) {
		const img = e.currentTarget as HTMLImageElement;
		const staticSrc = getStaticItemImageSrc(item);
		
		// If currently using custom protocol and static fallback exists, try it
		if (img.src.startsWith('item-image://') && img.src !== staticSrc) {
			img.src = staticSrc;
		} else {
			// Both sources failed, hide the image
			img.style.display = 'none';
		}
	}
</script>

<button
	class="size-full rounded-lg overflow-hidden cursor-pointer bg-white/5 border-none p-0 transition-shadow duration-200 hover:shadow-lg hover:shadow-indigo-500/30 text-left relative group"
	{onclick}
	title={image.folder ? `${image.folder}/${image.name}` : image.name}
	onmousemove={handleMouseMove}
	onmouseleave={handleMouseLeave}
>
	<!-- Image -->
	<div class="w-full overflow-hidden bg-gray-900 aspect-square">
		<img
			class="size-full object-cover transform-gpu"
			src={image.url}
			alt={image.name}
			loading="lazy"
			style="transform: scale({isHovering ? 1.08 : 1}) translate({transformX}px, {transformY}px); transition: transform 150ms ease-out;"
		/>
	</div>

	{#if showInfo}
		<!-- Info section (toggleable) -->
		<div class="w-full bg-black/80 p-2">
			<div class="flex items-center gap-2 text-xs mb-1 text-gray-400">
				{#if image.extractedDate}
					<span class="flex grow items-center gap-0.5">
						<span class="text-gray-500"><CalendarIcon class="size-4" /></span>
						<span>{image.extractedDate}</span>
					</span>
				{/if}
				{#if image.serial !== undefined && image.serial !== null}
					<span class="flex items-center gap-0.5">
						<span class="text-gray-500"><HashIcon class="size-4" /></span>
						<span>{image.serial}</span>
					</span>
				{/if}
			</div>
			<!-- Folder / Date / Serial row -->
			<div class="flex items-center gap-2 text-xs mb-1 text-gray-400">
				<span class="flex items-center gap-1">
					<FolderClosedIcon class="size-4 text-gray-500" />
					<span class="truncate max-w-">{image.folder || '.'}</span>
				</span>
			</div>
			<!-- Item -->
			<div class="flex items-center gap-2 text-xs mb-1">
				<ShirtIcon class="size-4 text-gray-500" />
				{#if image.metadata?.item}
					<img
						class="size-16 object-contain rounded shrink-0"
						src={getItemImageSrc(image.metadata.item)}
						alt={image.metadata.item}
						onerror={(e) => handleItemImageError(e, image.metadata!.item)}
					/>
					<span class="text-white text-sm truncate" style="direction: rtl; text-align: left;">{image.metadata.item}</span>
				{:else}
					<div class="size-16 bg-gray-700/50 rounded flex items-center justify-center shrink-0">
						<ImageIcon class="size-6 text-gray-700" />
					</div>
					<span class="text-gray-500 text-sm">-</span>
				{/if}
			</div>

			<!-- Characters -->
			<div class="flex items-start gap-1 text-xs mb-1">
				<UserRoundIcon class="size-4 text-gray-500" />
				<div class="flex flex-wrap gap-1 min-h-5">
					{#if image.metadata?.characters && image.metadata.characters.length > 0}
						{#each image.metadata.characters as char (char)}
							<span class="px-1.5 py-0.5 bg-purple-600/60 text-white text-[10px] rounded-full">{char}</span>
						{/each}
					{:else}
						<span class="text-gray-600">-</span>
					{/if}
				</div>
			</div>

			<!-- Tags -->
			<div class="flex items-start gap-1 text-xs">
				<TagIcon class="size-4 text-gray-500" />
				<div class="flex flex-wrap gap-1 min-h-5">
					{#if image.metadata?.tags && image.metadata.tags.length > 0}
						{#each image.metadata.tags as tag (tag)}
							<span class="px-1.5 py-0.5 bg-teal-600/60 text-white text-[10px] rounded-full">{tag}</span>
						{/each}
					{:else}
						<span class="text-gray-600">-</span>
					{/if}
				</div>
			</div>
		</div>
	{/if}

</button>

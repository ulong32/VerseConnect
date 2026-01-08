<script lang="ts">
	import { CalendarIcon, HashIcon, FolderClosedIcon, ShirtIcon, UserRoundIcon, ImageIcon, TagIcon } from '@lucide/svelte';
	interface Props {
		image: ImageInfo;
		onclick: () => void;
		showInfo?: boolean;
	}

	let { image, onclick, showInfo = true }: Props = $props();
</script>

<button
	class="size-full rounded-lg overflow-hidden cursor-pointer bg-white/5 border-none p-0 transition-shadow duration-200 hover:shadow-lg hover:shadow-indigo-500/30 text-left relative group"
	{onclick}
	title={image.folder ? `${image.folder}/${image.name}` : image.name}
>
	<!-- Image -->
	<div class="w-full overflow-hidden bg-gray-900 aspect-square">
		<img class="size-full object-cover transform-gpu" src={image.url} alt={image.name} loading="lazy" />
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
					<span class="truncate max-w-15">{image.folder || '.'}</span>
				</span>
			</div>
			<!-- Item -->
			<div class="flex items-center gap-2 text-xs mb-1">
				<ShirtIcon class="size-4 text-gray-500" />
				{#if image.metadata?.item}
					<img
						class="size-16 object-contain rounded shrink-0"
						src="/item/{image.metadata.item}_150.webp"
						alt={image.metadata.item}
						onerror={(e) => (e.currentTarget as HTMLImageElement).style.display = 'none'}
					/>
					<span class="text-white text-sm truncate">{image.metadata.item}</span>
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

	<!-- Hover filename overlay -->
	<div class="absolute top-0 left-0 right-0 p-2 bg-linear-to-b from-black/80 to-transparent text-white text-xs truncate opacity-0 group-hover:opacity-100 transition-opacity">
		{image.name}
	</div>
</button>

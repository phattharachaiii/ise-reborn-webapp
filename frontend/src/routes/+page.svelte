<script lang="ts">
	import { apiJson } from '$lib/api/client';
	import ProductGrid from '$lib/components/ProductGrid.svelte';
	import { onMount } from 'svelte';
	import { auth, openAuth } from '$lib/stores/auth'; // For checking login status
	import { goto } from '$app/navigation'; // To trigger login popup
	// === DTO from backend ===
	type ListingDTO = {
		id: string;
		title: string;
		description: string;
		price: number;
		condition: string; // NEW | LIKE_NEW | USED
		status: string; // ACTIVE | SOLD | HIDDEN
		createdAt: string;
		imageUrls?: string[]; // << Important: Must have this field
		seller?: { id: string; name: string };
	};

	// === Shape for card/grid ===
	type ProductCardData = {
		id: string;
		title: string;
		price: number;
		image?: string | null;
		boosted?: boolean;
	};

	// (Optional) If using Cloudinary, generate thumbnail for faster loading
	function toThumb(url?: string | null, size = 400) {
		if (!url) return null;
		return url.includes('/upload/')
			? url.replace('/upload/', `/upload/c_fill,w_${size},h_${size},q_auto,f_auto/`)
			: url;
	}

	function toProductCardData(x: ListingDTO): ProductCardData {
		const cover = x.imageUrls?.[0] ?? null;
		return {
			id: x.id,
			title: x.title,
			price: x.price,
			image: toThumb(cover), // << Use the first image as cover (resize if possible)
			boosted: false
		};
	}

	let loading = true;
	let items: ProductCardData[] = [];
	let total = 0;
	let query = '';

	async function load() {
		loading = true;
		try {
			const data = await apiJson<{ items: ListingDTO[]; total?: number }>(
				`/api/listings?query=${encodeURIComponent(query)}`
			);
			items = (data.items ?? []).map(toProductCardData);
			total = data.total ?? items.length;
		} catch (e: any) {
			console.error('load listings error:', e);
			items = [];
			total = 0;
		} finally {
			loading = false;
		}
	}
	function handlePostClick(e: MouseEvent) {
		// If not logged in → open login modal instead of navigating to /post
		if (!$auth.user) {
			e.preventDefault(); // Prevent <a> navigation
			openAuth('login'); // Open login popup
			return;
		}
		// If logged in, allow normal link behavior or use goto:
		// goto('/post');
	}

	onMount(load);
</script>

<div class="flex flex-col items-center text-center bg-white p-16 gap-4 rounded-lg shadow">
	<h1 class="text-brand text-3xl font-bold">Secondhand Marketplace for Students</h1>
	<p class="text-lg text-neutral-600">Buy and sell safely, verified with institutional email</p>
	<a
		href="/post"
		on:click={handlePostClick}
		class="
			inline-flex items-center justify-center
			py-2 px-6 rounded-full text-base font-bold text-white
			border border-[color:var(--color-brand-orange)]
			bg-brand hover:bg-brand-hover
			sm:bg-transparent sm:text-brand sm:hover:bg-black
			transition
		  "
	>
		Sell Now!
	</a>
</div>
<section class="mx-auto max-w-6xl px-4 py-6 space-y-4 overflow-y-auto">
	{#if loading}
		<p>Loading…</p>
	{:else if items.length === 0}
		<div class="rounded-xl border border-dashed border-surface bg-white p-8 text-center">
			<h3 class="text-lg font-semibold mb-2">No product listings yet</h3>
			<p class="text-sm text-neutral-600 mb-4">Be the first to sell to your fellow students!</p>
			<!-- <a href="/post" class="inline-block rounded bg-brand text-white px-4 py-2">Sell Now</a> -->
		</div>
	{:else}
		<div class="space-y-12">
			<div>
				<p class="mt-8 text-3xl text-gray-750 font-bold">✨ Latest Products: {total} items</p>
			</div>
			<ProductGrid {items} />
		</div>
	{/if}
</section>

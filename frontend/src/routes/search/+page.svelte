<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { api } from '$lib/api/client';
	import { goto } from '$app/navigation';

	type Item = {
		id: string;
		title: string;
		price: number;
		imageUrls?: string[];
		category?: string | null;
		seller: { id: string; name?: string | null; avatarUrl?: string | null };
		createdAt: string;
	};

	let q = '';
	let status = 'ACTIVE'; 
	let loading = false;
	let err = '';
	let items: Item[] = [];

	$: q = $page.url.searchParams.get('q') || '';
	$: status = ($page.url.searchParams.get('status') || 'ACTIVE').toUpperCase();

	async function run() {
		loading = true;
		err = '';
		items = [];
		try {
			const params = new URLSearchParams();
			if (q) params.set('q', q);
			if (status) params.set('status', status);
			params.set('limit', '36');

			const res = await api(`/api/listings/search?` + params.toString());
			const j = await res.json();
			if (!res.ok) throw new Error(j?.message || 'Search failed');
			items = j.items || [];
		} catch (e: any) {
			err = e?.message || 'Error';
		} finally {
			loading = false;
		}
	}
	function openCard(id: string, e?: MouseEvent) {
		if (e?.target && (e.target as HTMLElement).closest('a')) return;
		goto(`/listing/${id}`);
	}
	onMount(run);
	$: if ($page.url.search !== undefined) run();
</script>

<section class="mx-auto max-w-6xl px-4 py-6">
	<h1 class="text-xl font-bold">Search results</h1>
	<div class="text-sm text-neutral-600 mt-1">
		Query: <span class="font-medium">{q || '—'}</span>
	</div>

	{#if loading}
		<!-- SKELETON -->
		<div class="mt-4 grid sm:grid-cols-2 md:grid-cols-3 gap-4">
			{#each Array(6) as _}
				<div class="rounded-xl border p-3 animate-pulse">
					<div class="aspect-square rounded bg-neutral-100"></div>
					<div class="h-4 mt-2 rounded bg-neutral-100"></div>
					<div class="h-3 w-1/2 mt-2 rounded bg-neutral-100"></div>
				</div>
			{/each}
		</div>
	{:else if err}
		<div class="mt-4 rounded border border-red-200 bg-red-50 p-3 text-red-700 text-sm">{err}</div>
	{:else if items.length === 0}
		<div class="mt-4 rounded border p-3 text-sm">No items found.</div>
	{:else}
		<!-- RESULTS -->
		<div class="mt-4 grid sm:grid-cols-2 md:grid-cols-3 gap-4">
			{#each items as it (it.id)}
				<article
					class="rounded-xl border border-surface bg-white p-3 hover:shadow-card transition cursor-pointer"
					role="link"
					tabindex="0"
					on:click={(e) => openCard(it.id, e)}
					on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && openCard(it.id)}
				>
					<a href={'/listing/' + it.id} class="block" data-sveltekit-preload-data="hover">
						<div class="aspect-square overflow-hidden rounded-md border">
							<img
								src={(it.imageUrls && it.imageUrls[0]) ||
									'https://placehold.co/600x600?text=No+Image'}
								alt={it.title}
								class="w-full h-full object-cover"
								loading="lazy"
								decoding="async"
							/>
						</div>
						<div class="mt-2 text-[15px] font-semibold line-clamp-2">{it.title}</div>
					</a>

					<div class="mt-1 text-brand font-extrabold">฿ {Number(it.price).toLocaleString()}</div>

					<div class="mt-1 text-[12px] text-neutral-600">
						Seller:
						<a
							class="text-brand hover:underline"
							href={'/profile/' + it.seller.id}
							on:click|stopPropagation
						>
							{it.seller?.name ?? it.seller.id}
						</a>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</section>

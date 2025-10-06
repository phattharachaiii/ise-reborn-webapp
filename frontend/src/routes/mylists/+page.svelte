<!-- src/routes/mylists/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { apiJson } from '$lib/api/client';
	import ProductGrid from '$lib/components/ProductGrid.svelte';

	type Listing = {
		id: string;
		title: string;
		price: number;
		status: 'ACTIVE' | 'SOLD' | string;
		imageUrls: string[];
	};

	type Stats = { all: number; active: number; sold: number };

	// state
	let items: Listing[] = [];
	let loading = true;
	let loadingStats = true;
	let error = '';
	let stats: Stats = { all: 0, active: 0, sold: 0 };

	// tabs
	type TabKey = 'all' | 'active' | 'sold';
	let tab: TabKey = 'all';
	const tabs: { key: TabKey; label: string }[] = [
		{ key: 'all', label: 'All' },
		{ key: 'active', label: 'Active' },
		{ key: 'sold', label: 'Sold' }
	];

	// ---------- loaders ----------
	async function loadStats(): Promise<void> {
		loadingStats = true;
		try {
			const s = await apiJson<Stats>('/api/listings/stats?mine=1');
			stats = s;
		} catch {
			try {
				const [allRes, actRes, soldRes] = await Promise.all([
					apiJson<{ items: Listing[] }>('/api/listings?mine=1'),
					apiJson<{ items: Listing[] }>('/api/listings?mine=1&status=ACTIVE'),
					apiJson<{ items: Listing[] }>('/api/listings?mine=1&status=SOLD')
				]);
				stats = {
					all: allRes.items?.length ?? 0,
					active: actRes.items?.length ?? 0,
					sold: soldRes.items?.length ?? 0
				};
			} catch {
				// ignore
			}
		} finally {
			loadingStats = false;
		}
	}

	async function loadItems(which: TabKey) {
		loading = true;
		error = '';
		items = [];
		try {
			let url = '/api/listings?mine=1';
			if (which === 'active') url += '&status=ACTIVE';
			else if (which === 'sold') url += '&status=SOLD';
			const data = await apiJson<{ items: Listing[] }>(url);
			items = data.items ?? [];
		} catch (e: any) {
			error = e?.message || 'Failed to load items';
		} finally {
			loading = false;
		}
	}

	async function initialLoad() {
		await Promise.all([loadStats(), loadItems(tab)]);
	}
	onMount(initialLoad);

	function switchTab(next: TabKey) {
		if (tab === next) return;
		tab = next;
		loadItems(tab);
	}

	function badgeCount(k: TabKey) {
		if (k === 'active') return stats.active;
		if (k === 'sold') return stats.sold;
		return stats.all;
	}

	function refresh() {
		Promise.all([loadStats(), loadItems(tab)]);
	}

	// ---------- UI safety net: filter on FE + force re-mount ----------
	// Filter by tab in case BE does not filter
	$: displayed =
		tab === 'active'
			? items.filter((i) => String(i.status).toUpperCase() === 'ACTIVE')
			: tab === 'sold'
				? items.filter((i) => String(i.status).toUpperCase() === 'SOLD')
				: items;
</script>

<section class="mx-auto max-w-6xl px-4 py-6 space-y-4">
	<!-- Header -->
	<div class="flex items-center justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold">My Products</h1>
			<p class="text-sm text-neutral-500">Manage your posted products and your sales history.</p>
		</div>

		<div class="flex items-center gap-2">
			<button
				type="button"
				class="cursor-pointer rounded-full border border-surface px-4 py-2 text-sm hover:bg-neutral-50"
				on:click={refresh}
			>
				Refresh
			</button>
			<a
				href="/post"
				class="inline-flex items-center gap-2 rounded-full bg-brand text-white px-4 py-2 text-sm hover:bg-brand-2 transition"
			>
				+ Post Product
			</a>
		</div>
	</div>

	<!-- Tabs -->
	<div class="rounded-xl border border-surface bg-white p-2">
		<div class="flex items-center gap-2">
			{#each tabs as t}
				<button
					type="button"
					class="cursor-pointer rounded-lg px-3 py-1.5 text-sm transition {tab === t.key
						? 'bg-surface-light font-semibold'
						: 'hover:bg-neutral-50'}"
					on:click={() => switchTab(t.key)}
				>
					<span>{t.label}</span>
					<span
						class="ml-2 inline-flex items-center justify-center rounded-full border border-surface px-1.5 text-[11px] text-neutral-600"
					>
						{#if loadingStats}
							…
						{:else}
							{badgeCount(t.key)}
						{/if}
					</span>
				</button>
			{/each}
		</div>
	</div>

	<!-- Body -->
	{#if loading}
		<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
			{#each Array(8) as _}
				<div class="rounded-lg border border-surface bg-white shadow-card overflow-hidden">
					<div class="h-36 bg-neutral-200 animate-pulse"></div>
					<div class="p-3 space-y-2">
						<div class="h-4 w-3/4 bg-neutral-200 rounded animate-pulse"></div>
						<div class="h-4 w-1/2 bg-neutral-200 rounded animate-pulse"></div>
					</div>
				</div>
			{/each}
		</div>
	{:else if error}
		<div class="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
			{error}
		</div>
	{:else if displayed.length === 0}
		<div class="rounded-xl border border-dashed border-surface bg-white p-8 text-center space-y-3">
			<div class="text-lg font-semibold">No items in this tab yet</div>
			<p class="text-sm text-neutral-500">
				Start by posting your first product or check other tabs.
			</p>
			<a
				href="/post"
				class="inline-flex items-center gap-2 rounded-full bg-brand text-white px-4 py-2 text-sm hover:bg-brand-2 transition"
			>
				+ Post Product
			</a>
		</div>
	{:else}
		<div class="bg-white rounded-xl border border-surface p-4">
			{#key tab}
				<!-- Force re-mount every time the tab changes -->
				<ProductGrid items={displayed} />
			{/key}
		</div>
	{/if}
</section>

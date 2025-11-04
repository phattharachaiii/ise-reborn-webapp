<script lang="ts">
	import { goto } from '$app/navigation';

	// data ถูกโหลดมาจาก +page.server.ts
	export let data: {
		items: Array<{
			id: string;
			status: 'REQUESTED' | 'ACCEPTED' | 'REJECTED' | 'REOFFER' | 'COMPLETED' | 'CANCELLED';
			meetPlace: string;
			meetTime: string;
			note?: string | null;
			rejectReason?: string | null;
			lastActor: 'BUYER' | 'SELLER';
			updatedAt: string | Date;
			myRole: 'BUYER' | 'SELLER';
			qrToken?: string | null;
			listing: { id: string; title: string; price: number; imageUrls?: string[]; status: string };
			counterpart: { id: string; name: string; avatarUrl?: string | null };
		}>;
		error?: string;
		filters: { role: 'all' | 'buyer' | 'seller'; status: string; q: string };
	};

	type RoleTab = 'all' | 'buyer' | 'seller';

	// สถานะเริ่มต้นมาจาก server
	let role: RoleTab = data.filters.role ?? 'all';
	let status = data.filters.status ?? '';
	let q = data.filters.q ?? '';

	// label / badge
	const STATUS_LABEL: Record<string, string> = {
		REQUESTED: 'WAITING',
		REOFFER: 'RE-OFFER',
		ACCEPTED: 'ACCEPTED',
		COMPLETED: 'COMPLETED',
		REJECTED: 'REJECTED',
		CANCELLED: 'CANCELLED'
	};
	const statusBadge = (s: (typeof data.items)[number]['status']) => {
		switch (s) {
			case 'REQUESTED':
			case 'REOFFER':
				return 'bg-surface-light text-text-base border-surface';
			case 'ACCEPTED':
				return 'bg-green-50 text-green-700 border-green-200';
			case 'COMPLETED':
				return 'bg-brand/10 text-brand border-surface';
			case 'REJECTED':
				return 'bg-red-50 text-red-700 border-red-200';
			case 'CANCELLED':
				return 'bg-neutral-100 text-neutral-600 border-surface';
			default:
				return 'bg-surface-light text-text-base border-surface';
		}
	};
	const tabClass = (active: boolean) =>
		`px-3 py-1.5 rounded-md text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${
			active
				? 'bg-surface-light cursor-default pointer-events-none'
				: 'cursor-pointer hover:bg-surface-light'
		}`;
	const THB = (n: number) => '฿ ' + Number(n || 0).toLocaleString('th-TH');
	const formatDT = (s?: string | Date) => (s ? new Date(s).toLocaleString('th-TH') : '');

	// เปลี่ยนตัวกรอง -> เขียน query string -> ให้ SvelteKit reload (SSR) ด้วย goto()
	let debounce: ReturnType<typeof setTimeout> | null = null;
	function updateURLAndReload() {
		if (debounce) clearTimeout(debounce);
		debounce = setTimeout(() => {
			const sp = new URLSearchParams();
			if (role !== 'all') sp.set('role', role);
			if (status) sp.set('status', status);
			if (q.trim()) sp.set('q', q.trim());
			const url = sp.toString() ? `/offers?${sp.toString()}` : '/offers';
			goto(url, { replaceState: true, noScroll: true }); // จะไปเรียก +page.server.ts ใหม่
		}, 250);
	}
</script>

<section class="mx-auto max-w-6xl px-4 py-6 space-y-4">
	<!-- Header -->
	<div class="flex items-center justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold">My Offers</h1>
			<p class="text-sm text-neutral-600">All offers as both buyer and seller</p>
		</div>
	</div>

	<!-- Filters -->
	<div class="rounded-xl border border-surface bg-surface-white p-3 md:p-4 space-y-3 shadow-head">
		<div class="flex flex-wrap items-center gap-2">
			<!-- role tabs -->
			<div class="inline-flex rounded-lg border border-surface p-1 bg-surface-white shadow-card/0">
				<button
					class={tabClass(role === 'all')}
					aria-pressed={role === 'all'}
					on:click={() => {
						role = 'all';
						updateURLAndReload();
					}}>All</button
				>
				<button
					class={tabClass(role === 'buyer')}
					aria-pressed={role === 'buyer'}
					on:click={() => {
						role = 'buyer';
						updateURLAndReload();
					}}>Buyer</button
				>
				<button
					class={tabClass(role === 'seller')}
					aria-pressed={role === 'seller'}
					on:click={() => {
						role = 'seller';
						updateURLAndReload();
					}}>Seller</button
				>
			</div>

			<!-- status select -->
			<select
				class="rounded border border-surface px-3 py-1.5 text-sm bg-surface-white focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
				bind:value={status}
				on:change={updateURLAndReload}
				aria-label="Filter by status"
			>
				<option value="">ALL</option>
				<option value="REQUESTED">WAITING</option>
				<option value="REOFFER">RE-OFFER</option>
				<option value="ACCEPTED">ACCEPTED</option>
				<option value="COMPLETED">COMPLETED</option>
				<option value="REJECTED">REJECTED</option>
				<option value="CANCELLED">CANCELLED</option>
			</select>

			<!-- search -->
			<div class="flex-1 min-w-[160px] flex items-center gap-2">
				<input
					class="flex-1 rounded border border-surface px-3 py-1.5 text-sm bg-surface-white focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
					placeholder="Search by product/counterpart/location"
					bind:value={q}
					on:input={updateURLAndReload}
				/>
				<button
					class="rounded border border-surface px-3 py-1.5 text-sm hover:bg-surface-light"
					on:click={updateURLAndReload}
				>
					Search
				</button>
			</div>
		</div>
	</div>

	<!-- List -->
	{#if data.error}
		<div class="rounded border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
			โหลดรายการไม่สำเร็จ: {data.error}
		</div>
	{:else if !data.items?.length}
		<div
			class="rounded-xl border border-dashed border-surface bg-surface-white p-8 text-center shadow-card"
		>
			<div class="text-lg font-semibold">No offers yet</div>
			<div class="text-sm text-neutral-600">
				Offers will appear here when you start buying or selling
			</div>
		</div>
	{:else}
		<div class="space-y-3">
			{#each data.items as o (o.id)}
				<article
					class="rounded-lg border border-surface p-3 bg-surface-white flex flex-col gap-3 shadow-card"
				>
					<!-- Top row -->
					<div class="flex items-start gap-2">
						<div class="font-semibold leading-snug line-clamp-2">{o.listing.title}</div>
						<span
							class={`ml-auto inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${statusBadge(o.status)}`}
						>
							{STATUS_LABEL[o.status] ?? o.status}
						</span>
					</div>

					<!-- Details -->
					<div class="grid sm:grid-cols-2 gap-2 text-sm">
						<div>
							<div class="text-neutral-500">
								Counterpart ({o.myRole === 'BUYER' ? 'Seller' : 'Buyer'})
							</div>
							<div class="font-medium">{o.counterpart?.name}</div>
						</div>
						<div>
							<div class="text-neutral-500">Price</div>
							<div class="font-medium text-brand">{THB(o.listing.price)}</div>
						</div>
						<div>
							<div class="text-neutral-500">Meeting place</div>
							<div class="font-medium">{o.meetPlace}</div>
						</div>
						<div>
							<div class="text-neutral-500">Date & Time</div>
							<div class="font-medium">{formatDT(o.meetTime)}</div>
						</div>
					</div>

					{#if o.note}
						<div class="text-[12px] text-neutral-600">Note: {o.note}</div>
					{/if}
					{#if o.rejectReason}
						<div class="text-[12px] text-red-600">Rejection reason: {o.rejectReason}</div>
					{/if}

					<!-- CTA -->
					<div class="flex flex-wrap gap-2 pt-1">
						<a
							class="cursor-pointer rounded px-3 py-1.5 bg-brand border border-surface text-sm text-white font-semibold hover:bg-brand-h"
							href={`/offers/${o.id}`}
						>
							Enter
						</a>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</section>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
	}
</style>

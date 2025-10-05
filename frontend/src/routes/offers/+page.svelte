<!-- src/routes/offers/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { apiJson } from '$lib/api/client';
	import { goto } from '$app/navigation';

	type OfferLite = {
		id: string;
		status: 'REQUESTED' | 'ACCEPTED' | 'REJECTED' | 'REOFFER' | 'COMPLETED' | 'CANCELLED';
		meetPlace: string;
		meetTime: string;
		note?: string | null;
		rejectReason?: string | null;
		lastActor: 'BUYER' | 'SELLER';
		updatedAt: string;
		myRole: 'BUYER' | 'SELLER';
		qrToken?: string | null;
		listing: { id: string; title: string; price: number; imageUrls: string[]; status: string };
		counterpart: { id: string; name: string; avatarUrl?: string | null };
	};

	let loading = true,
		error = '';
	let items: OfferLite[] = [];

	type RoleTab = 'all' | 'buyer' | 'seller';
	let role: RoleTab = 'all';
	let status = '';
	let q = '';

	// ป้ายสถานะ (ข้อความ)
	const STATUS_LABEL: Record<string, string> = {
		REQUESTED: 'WAITING',
		REOFFER: 'RE-OFFER',
		ACCEPTED: 'ACCEPTED',
		COMPLETED: 'COMPLETED',
		REJECTED: 'REJECTED',
		CANCELLED: 'CANCELLED'
	};

	// ป้ายสถานะ (สีธีม)
	const statusBadge = (s: OfferLite['status']) => {
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

	// แท็บ role (active=no hover/cursor-pointer)
	const tabClass = (active: boolean) =>
		`px-3 py-1.5 rounded-md text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ` +
		(active
			? 'bg-surface-light cursor-default pointer-events-none'
			: 'cursor-pointer hover:bg-surface-light');

	const THB = (n: number) => '฿ ' + Number(n || 0).toLocaleString();
	const formatDT = (s?: string) => (s ? new Date(s).toLocaleString() : '');

	let abort: AbortController | null = null;

	async function load() {
		loading = true;
		error = '';
		try {
			if (abort) abort.abort();
			abort = new AbortController();

			const qs = new URLSearchParams();
			if (role !== 'all') qs.set('role', role);
			if (status) qs.set('status', status);
			if (q.trim()) qs.set('q', q.trim());

			const data = await apiJson<{ items: OfferLite[] }>(`/api/offers/mine?${qs.toString()}`, {
				signal: abort.signal
			} as any);
			items = data.items || [];
		} catch (e: any) {
			if (e?.name === 'AbortError') return;
			error = e?.message || 'โหลดรายการไม่สำเร็จ';
			items = [];
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		const sp = new URLSearchParams($page.url.search);
		const r = sp.get('role');
		const s = sp.get('status');
		const qq = sp.get('q');
		if (r === 'buyer' || r === 'seller' || r === 'all') role = r;
		if (s) status = s;
		if (qq) q = qq;
		load();
	});

	let t: any = null;
	$: (async () => {
		role;
		status;
		q;
		if (t) clearTimeout(t);
		t = setTimeout(() => {
			const sp = new URLSearchParams();
			if (role !== 'all') sp.set('role', role);
			if (status) sp.set('status', status);
			if (q.trim()) sp.set('q', q.trim());
			const url = sp.toString() ? `/offers?${sp.toString()}` : '/offers';
			history.replaceState(null, '', url);
			load();
		}, 250);
	})();

	function openOffer(id: string) {
		goto(`/offers/${id}`);
	}
	function openListing(id: string) {
		goto(`/listings/${id}`);
	}
</script>

<section class="mx-auto max-w-6xl px-4 py-6 space-y-4">
	<!-- Header -->
	<div class="flex items-center justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold">ข้อเสนอของฉัน</h1>
			<p class="text-sm text-neutral-600">รวมข้อเสนอทั้งฝั่งที่ซื้อและขาย</p>
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
					on:click={() => (role = 'all')}>ทั้งหมด</button
				>
				<button
					class={tabClass(role === 'buyer')}
					aria-pressed={role === 'buyer'}
					on:click={() => (role = 'buyer')}>ฝั่งที่ซื้อ</button
				>
				<button
					class={tabClass(role === 'seller')}
					aria-pressed={role === 'seller'}
					on:click={() => (role = 'seller')}>ฝั่งที่ขาย</button
				>
			</div>

			<!-- status select -->
			<select
				class="rounded border border-surface px-3 py-1.5 text-sm bg-surface-white focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
				bind:value={status}
				aria-label="กรองตามสถานะ"
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
					placeholder="ค้นหาจากสินค้า/ชื่อคู่สนทนา/สถานที่"
					bind:value={q}
				/>
				<button
					class="rounded border border-surface px-3 py-1.5 text-sm hover:bg-surface-light"
					on:click={load}
				>
					ค้นหา
				</button>
			</div>
		</div>
	</div>

	<!-- List -->
	{#if loading}
		<div class="grid gap-3">
			{#each Array(6) as _}
				<div class="rounded-lg border border-surface p-3 bg-surface-white shadow-card">
					<div class="h-5 w-1/3 bg-surface-light rounded mb-2 animate-pulse"></div>
					<div class="h-4 w-1/2 bg-surface-light rounded animate-pulse"></div>
				</div>
			{/each}
		</div>
	{:else if error}
		<div class="rounded border border-red-200 bg-red-50 p-3 text-red-700 text-sm">{error}</div>
	{:else if items.length === 0}
		<div
			class="rounded-xl border border-dashed border-surface bg-surface-white p-8 text-center shadow-card"
		>
			<div class="text-lg font-semibold">ยังไม่มีข้อเสนอ</div>
			<div class="text-sm text-neutral-600">เมื่อมีการติดต่อซื้อ-ขาย จะปรากฏที่นี่</div>
		</div>
	{:else}
		<div class="space-y-3">
			{#each items as o (o.id)}
				<article
					class="rounded-lg border border-surface p-3 bg-surface-white flex flex-col gap-3 shadow-card"
				>
					<!-- แถวบน: ชื่อสินค้า + สถานะ + บทบาทเรา -->
					<div class="flex items-start gap-2">
						<div class="font-semibold leading-snug line-clamp-2">{o.listing.title}</div>
						<span
							class={`ml-auto inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${statusBadge(o.status)}`}
						>
							{STATUS_LABEL[o.status] ?? o.status}
						</span>
					</div>

					<!-- รายละเอียด: คู่สนทนา + ราคา + นัด -->
					<div class="grid sm:grid-cols-2 gap-2 text-sm">
						<div>
							<div class="text-neutral-500">
								คู่สนทนา ({o.myRole === 'BUYER' ? 'ผู้ขาย' : 'ผู้ซื้อ'})
							</div>
							<div class="font-medium">{o.counterpart?.name}</div>
						</div>
						<div>
							<div class="text-neutral-500">ราคา</div>
							<div class="font-medium text-brand">{THB(o.listing.price)}</div>
						</div>
						<div>
							<div class="text-neutral-500">สถานที่นัด</div>
							<div class="font-medium">{o.meetPlace}</div>
						</div>
						<div>
							<div class="text-neutral-500">วัน–เวลา</div>
							<div class="font-medium">{formatDT(o.meetTime)}</div>
						</div>
					</div>

					{#if o.note}
						<div class="text-[12px] text-neutral-600">โน้ต: {o.note}</div>
					{/if}
					{#if o.rejectReason}
						<div class="text-[12px] text-red-600">เหตุผลปฏิเสธ: {o.rejectReason}</div>
					{/if}

					<!-- CTA -->
					<div class="flex flex-wrap gap-2 pt-1">
						<button
							class="rounded px-3 py-1.5 border border-surface text-sm hover:bg-surface-light"
							on:click={() => openOffer(o.id)}
						>
							เปิดดีล
						</button>
						<button
							class="rounded px-3 py-1.5 border border-surface text-sm hover:bg-surface-light"
							on:click={() => openListing(o.listing.id)}
						>
							ไปหน้าประกาศ
						</button>
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
		overflow: hidden;
	}
</style>

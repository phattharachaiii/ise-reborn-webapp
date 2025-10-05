<!-- src/lib/components/NotificationsBell.svelte -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { auth as authStore } from '$lib/stores/auth';
	import { apiJson, sseUrl } from '$lib/api/client';
	import { BellSolid } from 'flowbite-svelte-icons';

	export let limit = 10;

	// ===== const / stores =====
	const STREAM_PATH = '/api/notifications/stream';
	const auth = authStore;

	type Side = 'buyer' | 'seller';
	type NotificationItem = {
		id: string;
		title: string;
		message?: string | null;
		listingId?: string | null;
		offerId?: string | null;
		audience?: 'BUYER' | 'SELLER';
		createdAt: string;
		isRead: boolean;
	};

	// ===== state =====
	let open = false;
	let activeSide: Side = 'buyer';
	let itemsBuyer: NotificationItem[] = [];
	let itemsSeller: NotificationItem[] = [];
	let unreadTotal = 0;
	let loading = false;
	let err = '';

	// SSE / Polling
	let es: EventSource | null = null;
	let pollTimer: any = null;
	let heartBeatTimer: any = null;
	let lastEventTs = 0;
	let connecting = false;
	let destroyed = false;

	// ===== derived =====
	$: currentItems = activeSide === 'buyer' ? itemsBuyer : itemsSeller;

	// ===== utils =====
	const isId = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

	function linkTarget(n: NotificationItem): string | undefined {
		// ถ้าอยู่แท็บผู้ขาย → พาไปหน้าประกาศก่อน
		if (activeSide === 'seller') {
			if (isId(n.listingId)) return `/listing/${n.listingId}`;
			if (isId(n.offerId)) return `/offers/${n.offerId}`;
			return undefined;
		}
		// แท็บผู้ซื้อ → ไปหน้า offer ก่อน
		if (isId(n.offerId)) return `/offers/${n.offerId}`;
		if (isId(n.listingId)) return `/listing/${n.listingId}`;
		return undefined;
	}

	const normalize = (list: NotificationItem[]) =>
		(list ?? []).map((n) => ({
			...n,
			offerId: isId(n.offerId) ? n.offerId : null,
			listingId: isId(n.listingId) ? n.listingId : null
		}));

	// ===== fetchers =====
	async function loadSide(side: Side) {
		const data = await apiJson<{ items: NotificationItem[]; unread: number }>(
			`/api/notifications?limit=${limit}&side=${side}`
		);
		if (side === 'buyer') itemsBuyer = normalize(data.items);
		else itemsSeller = normalize(data.items);
		unreadTotal = data.unread ?? 0;
	}

	async function refreshBoth() {
		try {
			loading = true;
			err = '';
			await Promise.all([loadSide('buyer'), loadSide('seller')]);
		} catch (e: any) {
			err = e?.message ?? 'Fetch failed';
		} finally {
			loading = false;
		}
	}

	// ===== Polling / SSE =====
	function startPolling(intervalMs = 30000) {
		stopPolling();
		pollTimer = setInterval(refreshBoth, intervalMs);
	}
	function stopPolling() {
		if (pollTimer) clearInterval(pollTimer);
		pollTimer = null;
	}

	function stopSSE() {
		if (es) es.close();
		es = null;
		if (heartBeatTimer) clearInterval(heartBeatTimer);
		heartBeatTimer = null;
	}

	function connectSSE() {
		if (destroyed || connecting) return;
		if (typeof EventSource !== 'undefined' && es && es.readyState !== 2) return;

		connecting = true;
		stopSSE();

		// ยังไม่ล็อกอิน → ใช้ polling
		if (!$auth.user) {
			startPolling(30000);
			connecting = false;
			return;
		}

		try {
			// แนบ token ผ่าน query เพื่อเลี่ยงข้อจำกัด header ของ EventSource
			const token = $auth?.token;
			const url = token
				? sseUrl(`${STREAM_PATH}?token=${encodeURIComponent(token)}`)
				: sseUrl(STREAM_PATH);

			es = new EventSource(url, { withCredentials: true });

			es.onopen = () => {
				if (destroyed) return;
				stopPolling();
				lastEventTs = Date.now();

				// watchdog
				heartBeatTimer = setInterval(() => {
					const gap = Date.now() - lastEventTs;
					if (gap > 40000) {
						stopSSE();
						startPolling(20000);
						setTimeout(() => !destroyed && connectSSE(), 3000);
					}
				}, 10000);
			};

			es.onmessage = () => {
				lastEventTs = Date.now();
				refreshBoth();
			};

			es.onerror = () => {
				if (destroyed) return;
				stopSSE();
				startPolling(15000);
				setTimeout(() => !destroyed && connectSSE(), 5000);
			};
		} catch {
			startPolling(20000);
		} finally {
			setTimeout(() => (connecting = false), 200);
		}
	}

	// ===== actions =====
	function toggle() {
		open = !open;
	}

	function switchTab(side: Side) {
		activeSide = side;
	}

	async function markAllReadCurrent() {
		const ids = currentItems.filter((i) => !i.isRead).map((i) => i.id);
		if (!ids.length) return;
		try {
			await apiJson(`/api/notifications/mark-read`, {
				method: 'PATCH',
				body: JSON.stringify({ ids })
			});
			await refreshBoth();
		} catch {
			// ignore
		}
	}

	// close on outside / ESC
	function onDocClick(e: MouseEvent) {
		const t = e.target as HTMLElement;
		if (!t.closest?.('[data-bell-root]')) open = false;
	}
	function onDocKey(e: KeyboardEvent) {
		if (e.key === 'Escape') open = false;
	}

	// ===== lifecycle =====
	onMount(() => {
		destroyed = false;
		refreshBoth();
		if ($auth.user) connectSSE();
		document.addEventListener('click', onDocClick, true);
		document.addEventListener('keydown', onDocKey, true);
	});

	onDestroy(() => {
		destroyed = true;
		document.removeEventListener('click', onDocClick, true);
		document.removeEventListener('keydown', onDocKey, true);
		stopSSE();
		stopPolling();
	});

	// track auth state
	let lastAuthState = '';
	$: (() => {
		const state = $auth?.status || ($auth.user ? 'LOGGED_IN' : 'LOGGED_OUT');
		if (state === lastAuthState) return;
		lastAuthState = state;

		if (state === 'LOGGING_IN') {
			stopSSE();
			stopPolling();
		} else if (state === 'LOGGED_IN') {
			setTimeout(() => {
				if (!destroyed) {
					refreshBoth();
					connectSSE();
				}
			}, 150);
		} else {
			stopSSE();
			startPolling(30000);
		}
	})();
</script>

<div class="relative" data-bell-root>
	<!-- Button -->
	<button
		class=" relative grid h-10 w-10 place-items-center rounded-full border hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 cursor-pointer"
		aria-haspopup="menu"
		aria-expanded={open}
		on:click={toggle}
		aria-label="การแจ้งเตือน"
	>
		<BellSolid class="h-5 w-5 " />
		{#if unreadTotal > 0}
			<span
				class="absolute -top-1 -right-1 min-w-[1.25rem] rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] leading-none text-white"
				aria-label="ยังไม่ได้อ่าน {unreadTotal} รายการ"
			>
				{unreadTotal}
			</span>
		{/if}
	</button>

	<!-- Panel -->
	{#if open}
		<div
			role="menu"
			tabindex="-1"
			class="absolute right-0 z-50 mt-2 w-[22rem] max-h-[70vh] overflow-auto rounded-xl border bg-white p-2 text-sm shadow-lg"
		>
			<!-- header -->
			<div class="flex items-center justify-between px-1 pb-2">
				<div class="font-semibold">การแจ้งเตือน</div>
				<button
					class="text-xs underline hover:opacity-80 cursor-pointer"
					on:click={markAllReadCurrent}
				>
					อ่านแท็บนี้เป็นอ่านแล้ว
				</button>
			</div>

			<!-- segmented tabs -->
			<div class="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-neutral-100 p-1">
				<button
					class={`cursor-pointer rounded-md px-3 py-1 text-sm transition ${activeSide === 'buyer' ? 'bg-white shadow' : 'hover:bg-neutral-200'}`}
					on:click={() => switchTab('buyer')}
					aria-pressed={activeSide === 'buyer'}
				>
					ฉันเป็นผู้ซื้อ
				</button>
				<button
					class={`cursor-pointer rounded-md px-3 py-1 text-sm transition ${activeSide === 'seller' ? 'bg-white shadow' : 'hover:bg-neutral-200'}`}
					on:click={() => switchTab('seller')}
					aria-pressed={activeSide === 'seller'}
				>
					ฉันเป็นผู้ขาย
				</button>
			</div>

			{#if err}
				<div class="rounded-md border border-red-200 bg-red-50 p-2 text-red-700">{err}</div>
			{:else if loading}
				<!-- skeleton -->
				<div class="space-y-2">
					{#each Array(4) as _}
						<div class="animate-pulse rounded-md border bg-neutral-50 p-2">
							<div class="mb-1 h-3 w-2/3 rounded bg-neutral-200"></div>
							<div class="h-3 w-4/5 rounded bg-neutral-200"></div>
						</div>
					{/each}
				</div>
			{:else if currentItems.length === 0}
				<div class="grid place-items-center gap-1 py-6 text-center text-neutral-500">
					<BellSolid class="h-6 w-6 opacity-60" />
					<div class="text-xs">ยังไม่มีแจ้งเตือน</div>
				</div>
			{:else}
				<ul class="divide-y">
					{#each currentItems as n (n.id)}
						{#if linkTarget(n)}
							<li class="first:pt-0 last:pb-0">
								<a
									class="block rounded-md px-2 py-2 hover:bg-neutral-50 focus:bg-neutral-50"
									href={linkTarget(n)}
									on:click={() => (open = false)}
								>
									<div class="flex items-center gap-2">
										<div class="font-medium truncate">{n.title}</div>
										{#if n.audience}
											<span class="ml-auto rounded bg-neutral-100 px-1.5 py-0.5 text-[10px]"
												>{n.audience}</span
											>
										{/if}
									</div>
									{#if n.message}
										<div class="line-clamp-2 text-[12px] text-neutral-600">{n.message}</div>
									{/if}
									<div class="mt-0.5 text-[11px] text-neutral-400">
										{new Date(n.createdAt).toLocaleString()}
									</div>
								</a>
							</li>
						{:else}
							<li class="first:pt-0 last:pb-0">
								<div class="cursor-not-allowed rounded-md px-2 py-2 opacity-70">
									<div class="flex items-center gap-2">
										<div class="font-medium truncate">{n.title}</div>
										{#if n.audience}
											<span class="ml-auto rounded bg-neutral-100 px-1.5 py-0.5 text-[10px]"
												>{n.audience}</span
											>
										{/if}
									</div>
									{#if n.message}
										<div class="line-clamp-2 text-[12px] text-neutral-600">{n.message}</div>
									{/if}
									<div class="mt-0.5 text-[11px] text-neutral-400">
										{new Date(n.createdAt).toLocaleString()}
									</div>
								</div>
							</li>
						{/if}
					{/each}
				</ul>

				<!-- footer: ดูทั้งหมด -->
				<div class="mt-2 pt-2 border-t">
					<a
						href={`/offers`}
						class="block w-full text-center rounded-md px-3 py-2 text-sm bg-neutral-100 hover:bg-neutral-200 transition cursor-pointer"
						on:click={() => (open = false)}
						role="menuitem"
					>
						ดูทั้งหมด
					</a>
				</div>
			{/if}
		</div>
	{/if}
</div>

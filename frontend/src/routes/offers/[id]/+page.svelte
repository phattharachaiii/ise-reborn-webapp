<script lang="ts">
	import { page } from '$app/stores';
	import { apiJson } from '$lib/api/client';
	import { auth, openAuth } from '$lib/stores/auth';
	import QrScanModal from '$lib/components/QrScanModal.svelte'; // 👈 Scan modal
	import PlaceSelect from '$lib/components/PlaceSelect.svelte';
	import { toast } from '$lib/stores/toast';
	type Offer = {
		id: string;
		status: 'REQUESTED' | 'ACCEPTED' | 'REJECTED' | 'REOFFER' | 'COMPLETED';
		meetPlace: string;
		meetTime: string;
		note?: string | null;
		rejectReason?: string | null;
		lastActor: 'BUYER' | 'SELLER';
		qrToken?: string | null;

		listing: { id: string; title: string; price: number; imageUrls: string[] };
		seller: { id: string; name: string };
		buyer: { id: string; name: string };
		buyerId: string;
		sellerId: string;
		updatedAt: string;
	};

	type Meta = {
		isBuyer: boolean;
		isSeller: boolean;
		yourTurn: boolean;
		canAccept: boolean;
		canReject: boolean;
		canReoffer: boolean;
	};

	let offer: Offer | null = null;
	let meta: Meta | null = null;

	let loading = true;
	let err = '';
	let working = false;

	// modal states
	let showReject = false,
		rejectReason = '';
	let showReoffer = false,
		reMeetPlace = '',
		reMeetTime = '';

	// 👇 Scan/enter code modal
	let showScan = false;

	const id = $page.params.id;

	async function load() {
		loading = true;
		err = '';
		try {
			const data = await apiJson<{ offer: Offer; meta: Meta }>(`/api/offers/${id}`);
			offer = data.offer;
			meta = data.meta;
		} catch (e: any) {
			err = e?.message || 'Failed to load';
			offer = null;
			meta = null;
		} finally {
			loading = false;
		}
	}
	load();

	async function accept() {
		if (!offer) return;
		if (!$auth.user) return openAuth('login');
		working = true;
		try {
			await apiJson(`/api/offers/${offer.id}`, {
				method: 'PATCH',
				body: JSON.stringify({ action: 'ACCEPT' })
			});
			await load();
		} catch (e: any) {
			toast.error(e?.message || 'Action failed');
		} finally {
			working = false;
		}
	}

	async function doReject() {
		if (!offer) return;
		working = true;
		try {
			await apiJson(`/api/offers/${offer.id}`, {
				method: 'PATCH',
				body: JSON.stringify({ action: 'REJECT', reason: rejectReason || '' })
			});
			await load();
			showReject = false;
			rejectReason = '';
		} catch (e: any) {
			toast.error(e?.message || 'Action failed');
		} finally {
			working = false;
		}
	}

	// ===== Utils: Prevent selecting past (+5 minutes)
	function minLocalDateTimeString(addMinutes = 5) {
		const d = new Date(Date.now() + addMinutes * 60000);
		d.setSeconds(0, 0);
		// Convert to local datetime (for input type=datetime-local)
		const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
		return local.toISOString().slice(0, 16);
	}
	let minDT = minLocalDateTimeString(5);

	async function doReoffer() {
		if (!offer) return;
		if (!reMeetPlace || !reMeetTime) return toast.error('Please fill in both place and time');

		const chosen = new Date(reMeetTime); // string like "YYYY-MM-DDTHH:mm" (local)
		if (isNaN(chosen.getTime())) {
			toast.error('Invalid time format');
			return;
		}
		const MIN_DELTA_MS = 5 * 60 * 1000;
		if (chosen.getTime() < Date.now() + MIN_DELTA_MS) {
			toast.error('Please select a time at least 5 minutes from now');
			return;
		}

		working = true;
		try {
			await apiJson(`/api/offers/${offer.id}`, {
				method: 'PATCH',
				body: JSON.stringify({
					action: 'REOFFER',
					meetPlace: reMeetPlace,
					meetTime: chosen.toISOString() // Always send as ISO
				})
			});
			await load();
			showReoffer = false;
			reMeetPlace = '';
			reMeetTime = '';
			minDT = minLocalDateTimeString(5); // Refresh min value
		} catch (e: any) {
			toast.error(e?.message || 'Action failed');
		} finally {
			working = false;
		}
	}

	// ====== Confirm on-site with code (from scan/upload/paste) ======
	async function verifyScan(token: string) {
		if (!offer) return;
		try {
			await apiJson(`/api/offers/${offer.id}`, {
				method: 'PATCH',
				body: JSON.stringify({ action: 'SCAN', token })
			});
			await load();
			toast.success('On-site confirmation successful! Deal completed.');
			showScan = false;
		} catch (e: any) {
			toast.error(e?.message || 'Confirmation failed');
		}
	}

	const THB = (n: number) => `฿ ${Number(n).toLocaleString()}`;
</script>

<section class="mx-auto max-w-4xl px-4 py-6">
	<h1 class="text-xl font-bold mb-4">My Order</h1>

	{#if loading}
		<div class="rounded border p-3">Loading…</div>
	{:else if err}
		<div class="rounded border border-red-200 bg-red-50 p-3 text-red-700">{err}</div>
	{:else if !offer}
		<div class="text-sm text-neutral-500">Order not found</div>
	{:else}
		<article class="rounded-2xl border bg-white shadow p-4 space-y-3">
			<header class="flex items-start justify-between gap-3">
				<div>
					<div class="text-lg font-semibold">{offer.listing.title}</div>
					<div class="text-neutral-500 text-sm">
						Seller: <span class="font-medium">{offer.seller.name}</span>
						• Price {THB(offer.listing.price)}
					</div>
				</div>
				<span class="h-6 inline-flex items-center rounded-full border px-2 text-xs">
					{offer.status}
				</span>
			</header>

			<div class="grid sm:grid-cols-2 gap-3 text-sm">
				<div>
					<div class="text-neutral-500">Meeting Place</div>
					<div class="font-medium">{offer.meetPlace}</div>
				</div>
				<div>
					<div class="text-neutral-500">Date & Time</div>
					<div class="font-medium">{new Date(offer.meetTime).toLocaleString()}</div>
				</div>
			</div>

			{#if offer.note}
				<div class="text-xs text-neutral-600">Note: {offer.note}</div>
			{/if}
			{#if offer.rejectReason}
				<div class="text-xs text-red-600">Rejection Reason: {offer.rejectReason}</div>
			{/if}

			<!-- Status explanation -->
			{#if offer.status === 'ACCEPTED'}
				<div class="text-sm text-green-700">
					Accepted — Please attend at
					<span class="font-medium">{new Date(offer.meetTime).toLocaleString()}</span>
					{#if meta?.isBuyer}
						• Wait for the seller to show the QR code for you to scan and confirm on-site
						<div class="mt-3">
							<button
								class="cursor-pointer rounded px-3 py-2 bg-brand text-white"
								on:click={() => (showScan = true)}
							>
								Scan/Enter code to confirm on-site
							</button>
						</div>
					{/if}
				</div>
			{:else if offer.status === 'COMPLETED'}
				<div class="text-sm text-green-700">Deal completed</div>
			{:else if offer.status === 'REJECTED'}
				<div class="text-sm text-neutral-600">Order was rejected</div>
			{:else}
				<div class="text-sm text-neutral-600">
					{#if meta?.yourTurn}
						It's your turn to respond to this order
					{:else}
						Waiting for the other party to respond…
					{/if}
				</div>
			{/if}

			<!-- CTA: use meta from server -->
			{#if meta}
				<div class="flex flex-wrap gap-2 pt-2">
					{#if meta.canReoffer}
						<button class="rounded px-3 py-2 border" on:click={() => (showReoffer = true)}>
							Make a new offer
						</button>
					{/if}
					{#if meta.canReject}
						<button
							class="rounded px-3 py-2 border text-red-600"
							on:click={() => (showReject = true)}
						>
							Reject
						</button>
					{/if}
					{#if meta.canAccept}
						<button
							class="rounded px-3 py-2 bg-brand text-white disabled:opacity-60"
							on:click={accept}
							disabled={working}
						>
							Accept
						</button>
					{/if}
				</div>
			{/if}

			<!-- Notify that code is generated -->
			{#if offer.status === 'ACCEPTED' && offer.qrToken}
				<div class="mt-3 text-xs text-neutral-500">
					The code for on-site confirmation has been generated
				</div>
			{/if}
		</article>
	{/if}
</section>

<!-- Reject -->
{#if showReject}
	<div class="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
		<div class="w-[min(92vw,520px)] rounded-xl bg-white p-4 border shadow">
			<div class="text-lg font-semibold mb-2">Reject this order</div>
			<label class="block text-sm mb-1" for="reject-reason">Reason (optional)</label>
			<textarea
				id="reject-reason"
				rows="4"
				class="w-full rounded border px-3 py-2"
				bind:value={rejectReason}
			></textarea>

			<div class="mt-3 flex justify-end gap-2">
				<button class="rounded px-3 py-2 border" on:click={() => (showReject = false)}
					>Cancel</button
				>
				<button class="rounded px-3 py-2 bg-brand text-white" on:click={doReject}>Confirm</button>
			</div>
		</div>
	</div>
{/if}

<!-- Reoffer -->
{#if showReoffer}
	<div class="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
		<div class="w-[min(92vw,560px)] rounded-xl bg-white p-4 border shadow">
			<div class="text-lg font-semibold mb-2">Propose new date & place</div>
			<div class="grid sm:grid-cols-2 gap-3">
				<div>
					<label class="block text-sm mb-1">
						Meeting Place
						<PlaceSelect bind:value={reMeetPlace} required allowCustom />
					</label>
				</div>
				<div>
					<label class="block text-sm mb-1" for="re-meet-time">Meeting Time</label>
					<input
						id="re-meet-time"
						type="datetime-local"
						class="w-full rounded border px-3 py-2"
						bind:value={reMeetTime}
					/>
				</div>
			</div>
			<div class="mt-3 flex justify-end gap-2">
				<button class="rounded px-3 py-2 border" on:click={() => (showReoffer = false)}
					>Cancel</button
				>
				<button class="rounded px-3 py-2 bg-brand text-white" on:click={doReoffer}
					>Send new offer</button
				>
			</div>
		</div>
	</div>
{/if}

<!-- Scan/enter code modal -->
<QrScanModal
	open={showScan}
	onClose={() => (showScan = false)}
	on:result={(e) => verifyScan(e.detail)}
/>

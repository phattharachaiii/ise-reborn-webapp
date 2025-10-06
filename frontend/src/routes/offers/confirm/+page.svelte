<!-- src/lib/components/SellerOfferActions.svelte -->
<script lang="ts">
	import { toast } from '$lib/stores/toast';
	export let offerId: string;
	export let onChanged: () => void = () => {};

	let loading = false;
	async function doAction(action: string, payload: any = {}) {
		loading = true;
		try {
			const r = await fetch(`/api/offers/${offerId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action, ...payload })
			});
			const data = await r.json();
			if (!r.ok) toast.error(data.message || 'Action failed');
			else onChanged();
		} finally {
			loading = false;
		}
	}

	let meetPlace = '';
	let meetTime = '';
	let note = '';
	let reason = '';

	// Create/Show QR
	let qrUrl = '';
	async function accept() {
		await doAction('ACCEPT');
		// After accept, fetch offer to get token
		const r = await fetch(`/api/offers/${offerId}`);
		const { offer } = await r.json();
		qrUrl = `${location.origin}/offer/confirm?offerId=${offerId}&token=${offer.qrToken}`;
	}
</script>

<div class="space-y-2">
	<div class="grid grid-cols-3 gap-2">
		<button
			class="rounded px-3 py-2 bg-brand text-white disabled:opacity-60"
			on:click={accept}
			disabled={loading}
		>
			Accept & Show QR
		</button>
		<button
			class="rounded px-3 py-2 border disabled:opacity-60"
			on:click={() => doAction('REJECT', { reason })}
			disabled={loading}
		>
			Reject
		</button>
		<button
			class="rounded px-3 py-2 border disabled:opacity-60"
			on:click={() => doAction('REOFFER', { meetPlace, meetTime, note })}
			disabled={loading}
		>
			Reoffer
		</button>
	</div>

	<div class="grid grid-cols-2 gap-2">
		<input class="rounded border px-2 py-1" placeholder="New meeting place" bind:value={meetPlace} />
		<input class="rounded border px-2 py-1" type="datetime-local" bind:value={meetTime} />
	</div>
	<input class="rounded border px-2 py-1 w-full" placeholder="Note (optional)" bind:value={note} />
	<input class="rounded border px-2 py-1 w-full" placeholder="Reason for rejection" bind:value={reason} />

	{#if qrUrl}
		<div class="mt-3 p-3 rounded border bg-surface-light">
			<div class="text-sm font-semibold mb-2">QR for Buyer</div>
			<!-- Use qrcodejs library or <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`}> -->
			<img
				alt="qr"
				class="w-40 h-40"
				src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`}
			/>
			<div class="text-xs mt-2 break-all">{qrUrl}</div>
		</div>
	{/if}
</div>

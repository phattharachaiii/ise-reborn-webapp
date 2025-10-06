<!-- src/lib/components/SellerOfferActions.svelte -->
<script lang="ts">
	import { toast } from "$lib/stores/toast";
	// ✅ No external library version
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

	// Subform (Reoffer)
	let meetPlace = '';
	let meetTime = '';
	let note = '';
	let reason = '';

	// ===== QR control =====
	let qrUrl = ''; // QR link (generated after ACCEPT)
	let qrVisible = false; // Show/hide QR image
	let qrFullscreen = false; // Fullscreen mode (mobile)

	async function accept() {
		await doAction('ACCEPT');
		// Fetch token to generate QR link
		const r = await fetch(`/api/offers/${offerId}`);
		const { offer } = await r.json();
		if (!offer?.qrToken) {
			toast.error('QR code not received from server');
			return;
		}
		qrUrl = `${location.origin}/offer/confirm?offerId=${offerId}&token=${offer.qrToken}`;
		qrVisible = true;
	}

	async function copyQr() {
		if (!qrUrl) return;
		try {
			await navigator.clipboard.writeText(qrUrl);
			toast.success('QR link copied');
		} catch {
			toast.error('Copy failed');
		}
	}

	function openQr() {
		if (!qrUrl) return;
		window.open(qrUrl, '_blank', 'noopener,noreferrer');
	}
</script>

<div class="space-y-3">
	<!-- Main buttons -->
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

	<!-- Subform for Reoffer -->
	<div class="grid grid-cols-2 gap-2">
		<input class="rounded border px-2 py-1" placeholder="New meeting place" bind:value={meetPlace} />
		<input class="rounded border px-2 py-1" type="datetime-local" bind:value={meetTime} />
	</div>
	<input class="rounded border px-2 py-1 w-full" placeholder="Note (optional)" bind:value={note} />
	<input class="rounded border px-2 py-1 w-full" placeholder="Reject reason" bind:value={reason} />

	<!-- QR box -->
	{#if qrUrl}
		<div class="rounded border bg-surface-light p-3">
			<div class="flex items-center justify-between gap-2">
				<div class="text-sm font-semibold">QR for Buyer</div>
				<div class="flex items-center gap-2">
					<button
						class="rounded px-2 py-1 text-xs border"
						on:click={() => (qrVisible = !qrVisible)}
						aria-pressed={qrVisible}
					>
						{qrVisible ? 'Hide QR' : 'Show QR'}
					</button>
					<button class="rounded px-2 py-1 text-xs border" on:click={copyQr}>Copy link</button>
					<button class="rounded px-2 py-1 text-xs border" on:click={openQr}>Open link</button>
					<button
						class="rounded px-2 py-1 text-xs bg-black text-white disabled:opacity-50"
						on:click={() => (qrFullscreen = true)}
						disabled={!qrVisible}
						title={!qrVisible ? 'Press Show QR first' : 'Open fullscreen'}
					>
						Fullscreen
					</button>
				</div>
			</div>

			<!-- QR image (Mobile-first) -->
			<div class="mt-2 grid place-items-center">
				<div class="qr-box relative">
					<img
						alt="qr"
						class="qr-img"
						src={`https://api.qrserver.com/v1/create-qr-code/?size=640x640&data=${encodeURIComponent(qrUrl)}`}
						style="filter: {qrVisible ? 'none' : 'blur(10px)'}; opacity: {qrVisible ? 1 : 0.3};"
						decoding="async"
					/>
					{#if !qrVisible}
						<div class="qr-overlay">
							<div class="qr-overlay-card">Tap “Show QR” to reveal</div>
						</div>
					{/if}
				</div>
			</div>

			<div class="text-[11px] text-neutral-500 mt-2 break-all">
				{qrUrl}
			</div>
		</div>
	{/if}

	<!-- Fullscreen -->
	{#if qrFullscreen}
		<div class="fixed inset-0 z-50 flex flex-col bg-black/95">
			<div class="flex items-center justify-between p-3">
				<button class="rounded px-3 py-2 text-sm bg-white" on:click={() => (qrFullscreen = false)}>
					Close
				</button>
				<div class="text-white text-sm opacity-80">QR for on-site confirmation</div>
				<div class="w-[68px]"></div>
			</div>

			<div class="flex-1 overflow-auto grid place-items-center p-4">
				<img
					alt="qr-full"
					class="max-w-[86vw] max-h-[70vh] rounded-md bg-white"
					src={`https://api.qrserver.com/v1/create-qr-code/?size=1024x1024&data=${encodeURIComponent(qrUrl)}`}
					decoding="async"
				/>
			</div>

			<div class="p-3 grid grid-cols-2 gap-2">
				<button class="rounded bg-white py-2 text-sm" on:click={copyQr}>Copy link</button>
				<button class="rounded bg-white py-2 text-sm" on:click={openQr}>Open link</button>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Mobile-first */
	.qr-box {
		width: 220px;
		height: 220px;
	}
	.qr-img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		image-rendering: pixelated;
		background: #fff;
		border-radius: 0.5rem;
	}
	.qr-overlay {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
	}
	.qr-overlay-card {
		background: rgba(255, 255, 255, 0.9);
		color: #111;
		padding: 6px 10px;
		border-radius: 8px;
		font-size: 12px;
		border: 1px solid #e5e7eb;
	}
	@media (min-width: 480px) {
		.qr-box {
			width: 260px;
			height: 260px;
		}
	}
	@media (min-width: 640px) {
		.qr-box {
			width: 300px;
			height: 300px;
		}
	}
</style>

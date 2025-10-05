<!-- src/lib/components/SellerOfferActions.svelte -->
<script lang="ts">
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
			if (!r.ok) alert(data.message || 'ดำเนินการไม่สำเร็จ');
			else onChanged();
		} finally {
			loading = false;
		}
	}

	let meetPlace = '';
	let meetTime = '';
	let note = '';
	let reason = '';

	// สร้าง/โชว์ QR
	let qrUrl = '';
	async function accept() {
		await doAction('ACCEPT');
		// หลัง accept ดึง offer เพื่อได้ token
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
		<input class="rounded border px-2 py-1" placeholder="สถานที่ใหม่" bind:value={meetPlace} />
		<input class="rounded border px-2 py-1" type="datetime-local" bind:value={meetTime} />
	</div>
	<input class="rounded border px-2 py-1 w-full" placeholder="โน้ต (ถ้ามี)" bind:value={note} />
	<input class="rounded border px-2 py-1 w-full" placeholder="เหตุผล reject" bind:value={reason} />

	{#if qrUrl}
		<div class="mt-3 p-3 rounded border bg-surface-light">
			<div class="text-sm font-semibold mb-2">QR สำหรับผู้ซื้อ</div>
			<!-- ใช้ lib qrcodejs แบบง่าย หรือจะใช้ <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`}> ก็ได้ -->
			<img
				alt="qr"
				class="w-40 h-40"
				src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`}
			/>
			<div class="text-xs mt-2 break-all">{qrUrl}</div>
		</div>
	{/if}
</div>

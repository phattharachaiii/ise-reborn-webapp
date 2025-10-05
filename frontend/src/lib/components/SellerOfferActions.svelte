<!-- src/lib/components/SellerOfferActions.svelte -->
<script lang="ts">
	// ✅ ใช้เวอร์ชันไม่พึ่งไลบรารีอื่น
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

	// ฟอร์มย่อย (รีออฟเฟอร์)
	let meetPlace = '';
	let meetTime = '';
	let note = '';
	let reason = '';

	// ===== QR control =====
	let qrUrl = ''; // ลิงก์ QR (ถูกสร้างหลัง ACCEPT)
	let qrVisible = false; // แสดง/ซ่อนรูป QR
	let qrFullscreen = false; // โหมดเต็มหน้าจอ (มือถือ)

	async function accept() {
		await doAction('ACCEPT');
		// ดึง token เพื่อสร้างลิงก์ QR
		const r = await fetch(`/api/offers/${offerId}`);
		const { offer } = await r.json();
		if (!offer?.qrToken) {
			alert('ยังไม่ได้รับโค้ด QR จากเซิร์ฟเวอร์');
			return;
		}
		qrUrl = `${location.origin}/offer/confirm?offerId=${offerId}&token=${offer.qrToken}`;
		qrVisible = true;
	}

	async function copyQr() {
		if (!qrUrl) return;
		try {
			await navigator.clipboard.writeText(qrUrl);
			alert('คัดลอกลิงก์ QR แล้ว');
		} catch {
			alert('คัดลอกไม่สำเร็จ');
		}
	}

	function openQr() {
		if (!qrUrl) return;
		window.open(qrUrl, '_blank', 'noopener,noreferrer');
	}
</script>

<div class="space-y-3">
	<!-- ปุ่มหลัก -->
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

	<!-- ฟอร์มย่อยสำหรับ Reoffer -->
	<div class="grid grid-cols-2 gap-2">
		<input class="rounded border px-2 py-1" placeholder="สถานที่ใหม่" bind:value={meetPlace} />
		<input class="rounded border px-2 py-1" type="datetime-local" bind:value={meetTime} />
	</div>
	<input class="rounded border px-2 py-1 w-full" placeholder="โน้ต (ถ้ามี)" bind:value={note} />
	<input class="rounded border px-2 py-1 w-full" placeholder="เหตุผล reject" bind:value={reason} />

	<!-- กล่อง QR -->
	{#if qrUrl}
		<div class="rounded border bg-surface-light p-3">
			<div class="flex items-center justify-between gap-2">
				<div class="text-sm font-semibold">QR สำหรับผู้ซื้อ</div>
				<div class="flex items-center gap-2">
					<button
						class="rounded px-2 py-1 text-xs border"
						on:click={() => (qrVisible = !qrVisible)}
						aria-pressed={qrVisible}
					>
						{qrVisible ? 'ซ่อน QR' : 'แสดง QR'}
					</button>
					<button class="rounded px-2 py-1 text-xs border" on:click={copyQr}>คัดลอกลิงก์</button>
					<button class="rounded px-2 py-1 text-xs border" on:click={openQr}>เปิดลิงก์</button>
					<button
						class="rounded px-2 py-1 text-xs bg-black text-white disabled:opacity-50"
						on:click={() => (qrFullscreen = true)}
						disabled={!qrVisible}
						title={!qrVisible ? 'กดแสดง QR ก่อน' : 'เปิดแบบเต็มหน้าจอ'}
					>
						เต็มจอ
					</button>
				</div>
			</div>

			<!-- รูป QR (Mobile-first) -->
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
							<div class="qr-overlay-card">แตะ “แสดง QR” เพื่อเปิดเผย</div>
						</div>
					{/if}
				</div>
			</div>

			<div class="text-[11px] text-neutral-500 mt-2 break-all">
				{qrUrl}
			</div>
		</div>
	{/if}

	<!-- เต็มหน้าจอ -->
	{#if qrFullscreen}
		<div class="fixed inset-0 z-50 flex flex-col bg-black/95">
			<div class="flex items-center justify-between p-3">
				<button class="rounded px-3 py-2 text-sm bg-white" on:click={() => (qrFullscreen = false)}>
					ปิด
				</button>
				<div class="text-white text-sm opacity-80">QR สำหรับยืนยันหน้างาน</div>
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
				<button class="rounded bg-white py-2 text-sm" on:click={copyQr}>คัดลอกลิงก์</button>
				<button class="rounded bg-white py-2 text-sm" on:click={openQr}>เปิดลิงก์</button>
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

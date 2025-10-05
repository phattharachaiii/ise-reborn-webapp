<script lang="ts">
	import { page } from '$app/stores';
	import { apiJson } from '$lib/api/client';
	import { auth, openAuth } from '$lib/stores/auth';
	import QrScanModal from '$lib/components/QrScanModal.svelte'; // 👈 โมดัลสแกน
	import PlaceSelect from '$lib/components/PlaceSelect.svelte';

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

	// 👇 โมดัลสแกน/กรอกโค้ด
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
			err = e?.message || 'โหลดไม่สำเร็จ';
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
			alert(e?.message || 'ทำรายการไม่สำเร็จ');
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
			alert(e?.message || 'ทำรายการไม่สำเร็จ');
		} finally {
			working = false;
		}
	}

	// ===== Utils: ห้ามเลือกอดีต (+5 นาที)
	function minLocalDateTimeString(addMinutes = 5) {
		const d = new Date(Date.now() + addMinutes * 60000);
		d.setSeconds(0, 0);
		// แปลงเป็น local datetime (สำหรับ input type=datetime-local)
		const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
		return local.toISOString().slice(0, 16);
	}
	let minDT = minLocalDateTimeString(5);

	async function doReoffer() {
		if (!offer) return;
		if (!reMeetPlace || !reMeetTime) return alert('กรอกสถานที่และเวลาให้ครบ');

		const chosen = new Date(reMeetTime); // string แบบ "YYYY-MM-DDTHH:mm" (local)
		if (isNaN(chosen.getTime())) {
			alert('รูปแบบเวลาไม่ถูกต้อง');
			return;
		}
		const MIN_DELTA_MS = 5 * 60 * 1000;
		if (chosen.getTime() < Date.now() + MIN_DELTA_MS) {
			alert('กรุณาเลือกเวลาที่มากกว่าปัจจุบันอย่างน้อย 5 นาที');
			return;
		}

		working = true;
		try {
			await apiJson(`/api/offers/${offer.id}`, {
				method: 'PATCH',
				body: JSON.stringify({
					action: 'REOFFER',
					meetPlace: reMeetPlace,
					meetTime: chosen.toISOString() // ส่งเป็น ISO เสมอ
				})
			});
			await load();
			showReoffer = false;
			reMeetPlace = '';
			reMeetTime = '';
			minDT = minLocalDateTimeString(5); // รีเฟรชค่า min
		} catch (e: any) {
			alert(e?.message || 'ทำรายการไม่สำเร็จ');
		} finally {
			working = false;
		}
	}

	// ====== ยืนยันหน้างานด้วยโค้ด (จากสแกน/อัปโหลด/วาง) ======
	async function verifyScan(token: string) {
		if (!offer) return;
		try {
			await apiJson(`/api/offers/${offer.id}`, {
				method: 'PATCH',
				body: JSON.stringify({ action: 'SCAN', token })
			});
			await load();
			alert('ยืนยันหน้างานสำเร็จ! ดีลเสร็จสมบูรณ์');
			showScan = false;
		} catch (e: any) {
			alert(e?.message || 'ยืนยันไม่สำเร็จ');
		}
	}

	const THB = (n: number) => `฿ ${Number(n).toLocaleString()}`;
</script>

<section class="mx-auto max-w-4xl px-4 py-6">
	<h1 class="text-xl font-bold mb-4">ออเดอร์ของฉัน</h1>

	{#if loading}
		<div class="rounded border p-3">กำลังโหลด…</div>
	{:else if err}
		<div class="rounded border border-red-200 bg-red-50 p-3 text-red-700">{err}</div>
	{:else if !offer}
		<div class="text-sm text-neutral-500">ไม่พบออเดอร์</div>
	{:else}
		<article class="rounded-2xl border bg-white shadow p-4 space-y-3">
			<header class="flex items-start justify-between gap-3">
				<div>
					<div class="text-lg font-semibold">{offer.listing.title}</div>
					<div class="text-neutral-500 text-sm">
						ผู้ขาย: <span class="font-medium">{offer.seller.name}</span>
						• ราคา {THB(offer.listing.price)}
					</div>
				</div>
				<span class="h-6 inline-flex items-center rounded-full border px-2 text-xs">
					{offer.status}
				</span>
			</header>

			<div class="grid sm:grid-cols-2 gap-3 text-sm">
				<div>
					<div class="text-neutral-500">สถานที่นัด</div>
					<div class="font-medium">{offer.meetPlace}</div>
				</div>
				<div>
					<div class="text-neutral-500">วัน–เวลา</div>
					<div class="font-medium">{new Date(offer.meetTime).toLocaleString()}</div>
				</div>
			</div>

			{#if offer.note}
				<div class="text-xs text-neutral-600">โน้ต: {offer.note}</div>
			{/if}
			{#if offer.rejectReason}
				<div class="text-xs text-red-600">เหตุผลปฏิเสธ: {offer.rejectReason}</div>
			{/if}

			<!-- อธิบายสถานะ -->
			{#if offer.status === 'ACCEPTED'}
				<div class="text-sm text-green-700">
					ยอมรับแล้ว — กรุณาไปตามเวลานัด
					<span class="font-medium">{new Date(offer.meetTime).toLocaleString()}</span>
					{#if meta?.isBuyer}
						• รอผู้ขายแสดง QR เพื่อให้คุณสแกนยืนยันที่หน้างาน
						<div class="mt-3">
							<button
								class="rounded px-3 py-2 bg-brand text-white"
								on:click={() => (showScan = true)}
							>
								สแกน/กรอกโค้ด เพื่อยืนยันหน้างาน
							</button>
						</div>
					{/if}
				</div>
			{:else if offer.status === 'COMPLETED'}
				<div class="text-sm text-green-700">จบดีลแล้ว</div>
			{:else if offer.status === 'REJECTED'}
				<div class="text-sm text-neutral-600">ออเดอร์ถูกปฏิเสธ</div>
			{:else}
				<div class="text-sm text-neutral-600">
					{#if meta?.yourTurn}
						ถึงคิวคุณตอบกลับออเดอร์นี้
					{:else}
						รอฝ่ายตรงข้ามตอบกลับ…
					{/if}
				</div>
			{/if}

			<!-- CTA: ใช้ meta จากเซิร์ฟเวอร์ -->
			{#if meta}
				<div class="flex flex-wrap gap-2 pt-2">
					{#if meta.canReoffer}
						<button class="rounded px-3 py-2 border" on:click={() => (showReoffer = true)}>
							เสนอใหม่
						</button>
					{/if}
					{#if meta.canReject}
						<button
							class="rounded px-3 py-2 border text-red-600"
							on:click={() => (showReject = true)}
						>
							ปฏิเสธ
						</button>
					{/if}
					{#if meta.canAccept}
						<button
							class="rounded px-3 py-2 bg-brand text-white disabled:opacity-60"
							on:click={accept}
							disabled={working}
						>
							ยอมรับ
						</button>
					{/if}
				</div>
			{/if}

			<!-- แจ้งว่ามีโค้ดแล้ว -->
			{#if offer.status === 'ACCEPTED' && offer.qrToken}
				<div class="mt-3 text-xs text-neutral-500">โค้ดสำหรับยืนยันหน้างานถูกสร้างแล้ว</div>
			{/if}
		</article>
	{/if}
</section>

<!-- Reject -->
{#if showReject}
	<div class="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
		<div class="w-[min(92vw,520px)] rounded-xl bg-white p-4 border shadow">
			<div class="text-lg font-semibold mb-2">ปฏิเสธออเดอร์นี้</div>
			<label class="block text-sm mb-1">เหตุผล (ไม่บังคับ)</label>
			<textarea rows="4" class="w-full rounded border px-3 py-2" bind:value={rejectReason} />
			<div class="mt-3 flex justify-end gap-2">
				<button class="rounded px-3 py-2 border" on:click={() => (showReject = false)}
					>ยกเลิก</button
				>
				<button class="rounded px-3 py-2 bg-brand text-white" on:click={doReject}>ยืนยัน</button>
			</div>
		</div>
	</div>
{/if}

<!-- Reoffer -->
{#if showReoffer}
	<div class="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
		<div class="w-[min(92vw,560px)] rounded-xl bg-white p-4 border shadow">
			<div class="text-lg font-semibold mb-2">เสนอวัน–สถานที่ใหม่</div>
			<div class="grid sm:grid-cols-2 gap-3">
				<div>
					<label class="block text-sm mb-1">สถานที่นัด</label>
					<PlaceSelect bind:value={reMeetPlace} required allowCustom />
				</div>
				<div>
					<label class="block text-sm mb-1">เวลานัด</label>
					<input
						type="datetime-local"
						class="w-full rounded border px-3 py-2"
						bind:value={reMeetTime}
						min={minDT}
						on:focus={() => (minDT = minLocalDateTimeString(5))}
						on:click={() => (minDT = minLocalDateTimeString(5))}
					/>
				</div>
			</div>
			<div class="mt-3 flex justify-end gap-2">
				<button class="rounded px-3 py-2 border" on:click={() => (showReoffer = false)}
					>ยกเลิก</button
				>
				<button class="rounded px-3 py-2 bg-brand text-white" on:click={doReoffer}
					>ส่งข้อเสนอใหม่</button
				>
			</div>
		</div>
	</div>
{/if}

<!-- โมดัลสแกน/กรอกโค้ด -->
<QrScanModal
	open={showScan}
	onClose={() => (showScan = false)}
	on:result={(e) => verifyScan(e.detail)}
/>

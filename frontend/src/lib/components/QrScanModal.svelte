<!-- src/lib/components/QrScanModal.svelte -->
<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';

	export let open = false;
	export let onClose: () => void = () => {};

	const dispatch = createEventDispatcher<{ result: string }>();

	// แท็บที่มีให้ใช้
	type Tab = 'scan' | 'upload' | 'paste';
	let activeTab: Tab = 'scan';

	// state สแกนกล้อง
	let videoEl: HTMLVideoElement | null = null;
	let stream: MediaStream | null = null;
	let hasCameraSupport = false;
	let barcodeDetectorAvailable = 'BarcodeDetector' in globalThis;
	let detector: any = null; // BarcodeDetector ถ้ามี

	// state อัปโหลดรูป
	let imgPreviewUrl: string | null = null;

	// state วางโค้ด
	let tokenInput = '';

	// ===== Utils =====
	/**
	 * รองรับทั้ง
	 *  - URL แบบเก่า: reborn://... ?t=TOKEN  -> คืนเฉพาะ TOKEN
	 *  - URL แบบใหม่: https://... ?action=... -> คืน "ทั้ง URL" ให้ backend แปลต่อ
	 *  - ข้อความล้วน/JSON/base64 -> คืนค่าที่รับมา (ให้ฝั่งถัดไปตัดสินใจ)
	 */
	function parseTokenFromQR(raw: string): string | null {
		try {
			if (!raw) return null;
			// เป็น URL?
			if (/^https?:\/\//i.test(raw) || /^[a-z]+:\/\//i.test(raw)) {
				const u = new URL(raw);
				const t = u.searchParams.get('t');
				// ถ้ามี ?t= ให้คงพฤติกรรมเดิม (ส่งเฉพาะ token)
				if (t) return t;
				// ถ้าไม่มี ?t= ให้ส่ง "ทั้ง URL" กลับไปเพื่อให้ backend /api/qr แปล action เอง
				return raw.trim();
			}
			// ไม่ใช่ URL -> ส่งข้อความล้วนกลับ
			return raw.trim();
		} catch {
			return null;
		}
	}
	function ok(msg: string) {
		const tokenOrRaw = parseTokenFromQR(msg);
		if (!tokenOrRaw) return alert('QR/Token ไม่ถูกต้อง');
		// ส่งขึ้น parent เหมือนเดิม (เดิมเคยรับ token; ตอนนี้ถ้าเป็น URL ใหม่จะได้ URL เต็ม)
		dispatch('result', tokenOrRaw);
	}

	// ===== Camera init / teardown =====
	async function startCamera() {
		stopCamera();
		try {
			if (!navigator.mediaDevices?.getUserMedia) return false;
			stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'environment' }
			});
			if (videoEl) {
				videoEl.srcObject = stream;
				await videoEl.play();
			}
			return true;
		} catch {
			return false;
		}
	}
	function stopCamera() {
		if (stream) {
			stream.getTracks().forEach((t) => t.stop());
			stream = null;
		}
		if (videoEl) videoEl.srcObject = null;
	}

	let rafId: number | null = null;
	let canvas: HTMLCanvasElement | null = null;
	let ctx: CanvasRenderingContext2D | null = null;

	async function tickScanLoop() {
		if (!open || activeTab !== 'scan' || !videoEl) return;
		if (videoEl.readyState < 2) {
			rafId = requestAnimationFrame(tickScanLoop);
			return;
		}
		try {
			if (barcodeDetectorAvailable) {
				if (!detector) {
					// @ts-ignore
					detector = new BarcodeDetector({ formats: ['qr_code'] });
				}
				const bit = await createImageBitmap(videoEl);
				const codes = await detector.detect(bit);
				if (codes && codes.length) {
					const raw = codes[0].rawValue || '';
					ok(String(raw));
					return;
				}
			} else {
				// fallback (ต้องมี jsQR ติดตั้งในโครงการ ถ้าไม่มีจะข้าม)
				const { default: jsQR } = await import('jsqr').catch(() => ({ default: null as any }));
				if (jsQR) {
					if (!canvas) {
						canvas = document.createElement('canvas');
						ctx = canvas.getContext('2d');
					}
					const w = videoEl.videoWidth,
						h = videoEl.videoHeight;
					if (w && h && ctx && canvas) {
						canvas.width = w;
						canvas.height = h;
						ctx.drawImage(videoEl, 0, 0, w, h);
						const img = ctx.getImageData(0, 0, w, h);
						const code = jsQR(img.data, img.width, img.height);
						if (code?.data) {
							ok(String(code.data));
							return;
						}
					}
				}
			}
		} catch {
			/* ignore */
		}
		rafId = requestAnimationFrame(tickScanLoop);
	}

	// ===== File upload decode =====
	async function onPickFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		imgPreviewUrl = URL.createObjectURL(file);

		try {
			const bmp = await createImageBitmap(file);
			// BarcodeDetector ก่อน
			if (barcodeDetectorAvailable) {
				if (!detector) {
					// @ts-ignore
					detector = new BarcodeDetector({ formats: ['qr_code'] });
				}
				const codes = await detector.detect(bmp);
				if (codes?.length) {
					ok(String(codes[0].rawValue || ''));
					return;
				}
			}
			// fallback jsQR
			const { default: jsQR } = await import('jsqr').catch(() => ({ default: null as any }));
			if (jsQR) {
				const w = bmp.width,
					h = bmp.height;
				const cv = document.createElement('canvas');
				const c = cv.getContext('2d');
				cv.width = w;
				cv.height = h;
				c!.drawImage(bmp, 0, 0);
				const img = c!.getImageData(0, 0, w, h);
				const code = jsQR(img.data, img.width, img.height);
				if (code?.data) {
					ok(String(code.data));
					return;
				}
			}
			alert('อ่าน QR จากรูปไม่สำเร็จ ลองรูปที่คมชัด/สว่างขึ้น');
		} catch {
			alert('ไม่สามารถอ่านรูปได้');
		}
	}

	function submitPasted() {
		if (!tokenInput.trim()) return;
		ok(tokenInput.trim());
	}

	// ===== Lifecycle =====
	onMount(async () => {
		// ตรวจความสามารถของกล้อง
		hasCameraSupport = !!navigator.mediaDevices?.getUserMedia;
		if (!hasCameraSupport) activeTab = 'upload'; // ไม่มีกล้อง → ไปอัปโหลด

		if (open && hasCameraSupport && activeTab === 'scan') {
			await startCamera();
			tickScanLoop();
		}
	});

	$: (async () => {
		// เมื่อ open/activeTab เปลี่ยน คุมกล้อง
		if (open && activeTab === 'scan' && hasCameraSupport) {
			if (!stream) await startCamera();
			if (rafId == null) tickScanLoop();
		} else {
			if (rafId != null) cancelAnimationFrame(rafId), (rafId = null);
			stopCamera();
		}
	})();

	onDestroy(() => {
		if (rafId != null) cancelAnimationFrame(rafId);
		stopCamera();
		if (imgPreviewUrl) URL.revokeObjectURL(imgPreviewUrl);
	});
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
		<div class="w-full max-w-md rounded-lg bg-white shadow-xl">
			<div class="flex items-center justify-between border-b p-3">
				<div class="font-semibold">ยืนยันดีลด้วย QR/โค้ด</div>
				<button class="px-2 py-1 text-sm" on:click={onClose}>ปิด</button>
			</div>

			<!-- Tabs -->
			<div class="flex gap-1 p-2">
				<button
					class="px-3 py-1 rounded {activeTab === 'scan'
						? 'bg-black text-white'
						: 'bg-neutral-100'} disabled:opacity-50"
					on:click={() => (activeTab = 'scan')}
					disabled={!hasCameraSupport}
					title={hasCameraSupport ? '' : 'อุปกรณ์นี้ไม่รองรับการสแกนกล้อง'}>สแกนกล้อง</button
				>
				<button
					class="px-3 py-1 rounded {activeTab === 'upload'
						? 'bg-black text-white'
						: 'bg-neutral-100'}"
					on:click={() => (activeTab = 'upload')}>อัปโหลดรูป</button
				>
				<button
					class="px-3 py-1 rounded {activeTab === 'paste'
						? 'bg-black text-white'
						: 'bg-neutral-100'}"
					on:click={() => (activeTab = 'paste')}>วางโค้ด</button
				>
			</div>

			<!-- Body -->
			<div class="p-3 space-y-3">
				{#if activeTab === 'scan'}
					{#if hasCameraSupport}
						<video bind:this={videoEl} class="w-full rounded bg-black" playsinline></video>
						<p class="text-xs text-neutral-500">
							หากภาพมืด/เบลอ ให้ลองปรับแสงหรือสลับไป “อัปโหลดรูป” แทน
						</p>
					{:else}
						<div class="rounded border bg-yellow-50 p-3 text-sm">
							อุปกรณ์นี้ไม่รองรับการสแกนอัตโนมัติ กรุณาใช้งาน “อัปโหลดรูป” หรือ “วางโค้ด”
						</div>
					{/if}
				{:else if activeTab === 'upload'}
					<input type="file" accept="image/*" on:change={onPickFile} />
					{#if imgPreviewUrl}
						<img
							src={imgPreviewUrl}
							alt="preview"
							class="mt-2 max-h-56 rounded border object-contain"
						/>
					{/if}
					<p class="text-xs text-neutral-500">เลือกรูปที่คมชัด เห็น QR เต็ม ๆ</p>
				{:else if activeTab === 'paste'}
					<label class="block text-sm mb-1"
						>วางโค้ดหรือลิงก์ (รองรับทั้งโค้ดล้วน และ URL ที่ไม่มี ?t=)</label
					>
					<input
						class="w-full rounded border px-3 py-2"
						placeholder="เช่น https://app.example/qr/buy-request/xxx หรือ วางโค้ดล้วน ๆ"
						bind:value={tokenInput}
					/>
					<div class="mt-2">
						<button class="rounded bg-black text-white px-3 py-1" on:click={submitPasted}>
							ใช้โค้ดนี้
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	video {
		aspect-ratio: 3/4;
	}
</style>

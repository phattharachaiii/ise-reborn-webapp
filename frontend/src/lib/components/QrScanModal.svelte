<!-- src/lib/components/QrScanModal.svelte -->
<script lang="ts">
	import { toast } from '$lib/stores/toast';
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';

	export let open = false;
	export let onClose: () => void = () => {};

	const dispatch = createEventDispatcher<{ result: string }>();

	// Available tabs
	type Tab = 'scan' | 'upload' | 'paste';
	let activeTab: Tab = 'scan';

	// Camera scan state
	let videoEl: HTMLVideoElement | null = null;
	let stream: MediaStream | null = null;
	let hasCameraSupport = false;
	let barcodeDetectorAvailable = 'BarcodeDetector' in globalThis;
	let detector: any = null; // BarcodeDetector if available

	// Image upload state
	let imgPreviewUrl: string | null = null;

	// Paste code state
	let tokenInput = '';

	// ===== Utils =====
	/**
	 * Supports:
	 *  - Old URL: reborn://... ?t=TOKEN  -> return only TOKEN
	 *  - New URL: https://... ?action=... -> return "full URL" for backend to parse
	 *  - Plain text/JSON/base64 -> return as is (let next step decide)
	 */
	function parseTokenFromQR(raw: string): string | null {
		try {
			if (!raw) return null;
			// Is it a URL?
			if (/^https?:\/\//i.test(raw) || /^[a-z]+:\/\//i.test(raw)) {
				const u = new URL(raw);
				const t = u.searchParams.get('t');
				// If ?t= exists, return only the token
				if (t) return t;
				// If no ?t=, return the full URL for backend /api/qr to parse action
				return raw.trim();
			}
			// Not a URL -> return plain text
			return raw.trim();
		} catch {
			return null;
		}
	}
	function ok(msg: string) {
		const tokenOrRaw = parseTokenFromQR(msg);
		if (!tokenOrRaw) return toast.error('QR/Token Not Valid');
		// Send to parent (previously only token; now may be full URL)
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
				// fallback (requires jsQR installed in project, otherwise skip)
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
			// BarcodeDetector first
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
			toast.error('Failed to read QR from image. Try a clearer/brighter image.');
		} catch {
			toast.error('Cannot read image.');
		}
	}

	function submitPasted() {
		if (!tokenInput.trim()) return;
		ok(tokenInput.trim());
	}

	// ===== Lifecycle =====
	onMount(async () => {
		// Check camera support
		hasCameraSupport = !!navigator.mediaDevices?.getUserMedia;
		if (!hasCameraSupport) activeTab = 'upload'; // No camera → switch to upload

		if (open && hasCameraSupport && activeTab === 'scan') {
			await startCamera();
			tickScanLoop();
		}
	});

	$: (async () => {
		// When open/activeTab changes, control camera
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
				<div class="font-semibold">Confirm deal with QR/Code</div>
				<button
					class="px-2 py-1 text-sm font-semibold text-gray-600 hover:text-white
		 bg-gray-100 hover:bg-red-500 border border-gray-200
		 rounded-full shadow-sm transition-all duration-200
		 hover:scale-105 active:scale-95 cursor-pointer"
					on:click={onClose}
				>
					✕
				</button>
			</div>

			<!-- Tabs -->
			<div class="flex gap-1 p-2">
				<button
					class="cursor-pointer hover:bg-gray-700 transition-colors duration-200 hover:text-white px-3 py-1 rounded {activeTab === 'scan'
						? 'bg-black text-white'
						: 'bg-neutral-100'} disabled:opacity-50"
					on:click={() => (activeTab = 'scan')}
					disabled={!hasCameraSupport}
					title={hasCameraSupport ? '' : 'This device does not support camera scanning'}>Scan Camera</button
				>
				<button
					class="cursor-pointer hover:bg-gray-700 transition-colors duration-200 hover:text-white px-3 py-1 rounded {activeTab === 'upload'
						? 'bg-black text-white'
						: 'bg-neutral-100'}"
					on:click={() => (activeTab = 'upload')}>Upload Image</button
				>
				<button
					class="cursor-pointer hover:bg-gray-700 transition-colors duration-200 hover:text-white px-3 py-1 rounded {activeTab === 'paste'
						? 'bg-black text-white'
						: 'bg-neutral-100'}"
					on:click={() => (activeTab = 'paste')}>Paste Code</button
				>
			</div>

			<!-- Body -->
			<div class="p-3 space-y-3">
				{#if activeTab === 'scan'}
					{#if hasCameraSupport}
						<video bind:this={videoEl} class="w-full rounded bg-black" playsinline></video>
						<p class="text-xs text-neutral-500">
							If the image is dark/blurry, try adjusting the lighting or switch to "Upload Image".
						</p>
					{:else}
						<div class="rounded border bg-yellow-50 p-3 text-sm">
							This device does not support automatic scanning. Please use "Upload Image" or "Paste Code".
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
					<p class="text-xs text-neutral-500">Choose a clear image with the full QR visible.</p>
				{:else if activeTab === 'paste'}
					<label class="block text-sm mb-1"
						>Paste code or link (supports both plain code and URLs without ?t=)</label
					>
					<input
						class="w-full rounded border px-3 py-2"
						placeholder="e.g. https://app.example/qr/buy-request/xxx or paste plain code"
						bind:value={tokenInput}
					/>
					<div class="mt-2">
						<button class="cursor-pointer rounded bg-brand hover:bg-brand-h text-white px-3 py-1" on:click={submitPasted}>
							Use this code
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

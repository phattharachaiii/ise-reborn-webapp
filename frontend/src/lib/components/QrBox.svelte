<!-- src/lib/components/QrBox.svelte -->
<script lang="ts">
	/** tokenUrl: ลิงก์ที่ฝั่งผู้ซื้อจะเปิด (มี token อยู่ในพารามิเตอร์) */
	export let tokenUrl: string;

	let show = false;
	let fullscreen = false;

	function openNew() {
		if (!tokenUrl) return;
		window.open(tokenUrl, '_blank', 'noopener,noreferrer');
	}
	async function copyLink() {
		if (!tokenUrl) return;
		try {
			await navigator.clipboard.writeText(tokenUrl);
			alert('คัดลอกลิงก์แล้ว');
		} catch {
			alert('คัดลอกไม่สำเร็จ');
		}
	}
</script>

<div class="rounded-lg border bg-white p-3 shadow-sm w-[min(92vw,360px)]">
	<div class="flex items-center justify-between gap-2">
		<div class="text-sm font-semibold">QR สำหรับผู้ซื้อ</div>
		<div class="flex items-center gap-2">
			<button
				type="button"
				class="rounded px-2 py-1 text-xs border"
				on:click={() => (show = !show)}
				aria-pressed={show}
			>
				{show ? 'ซ่อน' : 'แสดง'}
			</button>
			<button type="button" class="rounded px-2 py-1 text-xs border" on:click={copyLink}>
				คัดลอกลิงก์
			</button>
			<button type="button" class="rounded px-2 py-1 text-xs border" on:click={openNew}>
				เปิดลิงก์
			</button>
			<button
				type="button"
				class="rounded px-2 py-1 text-xs bg-black text-white disabled:opacity-50"
				on:click={() => (fullscreen = true)}
				disabled={!show}
				title={!show ? 'กดแสดง QR ก่อน' : 'เปิดแบบเต็มหน้าจอ'}
			>
				เต็มจอ
			</button>
		</div>
	</div>

	<div class="mt-2 grid place-items-center">
		<div class="qrbox relative">
			<img
				alt="qr"
				class="qrimg"
				src={`https://api.qrserver.com/v1/create-qr-code/?size=640x640&data=${encodeURIComponent(tokenUrl)}`}
				style="filter: {show ? 'none' : 'blur(10px)'}; opacity: {show ? 1 : 0.35};"
				decoding="async"
			/>
			{#if !show}
				<div class="overlay">
					<div class="hint">แตะ “แสดง” เพื่อเปิดเผย</div>
				</div>
			{/if}
		</div>
	</div>

	<div class="mt-2 text-[11px] text-neutral-500 break-all">{tokenUrl}</div>

	{#if fullscreen}
		<div class="fixed inset-0 z-[1000] flex flex-col bg-black/95">
			<div class="flex items-center justify-between p-3">
				<button class="rounded bg-white px-3 py-2 text-sm" on:click={() => (fullscreen = false)}>
					ปิด
				</button>
				<div class="text-white text-sm opacity-80">QR สำหรับยืนยันหน้างาน</div>
				<div class="w-[64px]"></div>
			</div>
			<div class="flex-1 grid place-items-center p-4">
				<img
					alt="qr-full"
					class="max-w-[88vw] max-h-[72vh] rounded-md bg-white"
					src={`https://api.qrserver.com/v1/create-qr-code/?size=1024x1024&data=${encodeURIComponent(tokenUrl)}`}
					decoding="async"
				/>
			</div>
			<div class="p-3 grid grid-cols-2 gap-2">
				<button class="rounded bg-white py-2 text-sm" on:click={copyLink}>คัดลอกลิงก์</button>
				<button class="rounded bg-white py-2 text-sm" on:click={openNew}>เปิดลิงก์</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.qrbox {
		width: 220px;
		height: 220px;
	}
	.qrimg {
		width: 100%;
		height: 100%;
		object-fit: contain;
		background: #fff;
		border-radius: 0.5rem;
		image-rendering: pixelated;
	}
	.overlay {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
	}
	.hint {
		background: rgba(255, 255, 255, 0.92);
		color: #111;
		padding: 6px 10px;
		border-radius: 8px;
		font-size: 12px;
		border: 1px solid #e5e7eb;
	}
	@media (min-width: 480px) {
		.qrbox {
			width: 260px;
			height: 260px;
		}
	}
	@media (min-width: 640px) {
		.qrbox {
			width: 300px;
			height: 300px;
		}
	}
</style>

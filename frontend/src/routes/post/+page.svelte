<!-- src/routes/post/+page.svelte -->
<script lang="ts">
	import { api, apiJson } from '$lib/api/client';
	import { openAuth } from '$lib/stores/auth';
	import { browser } from '$app/environment';
	import { onDestroy } from 'svelte';

	const MAX_FILES = 5;
	const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
	const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

	// ให้ตรงกับ Prisma enum: Condition { NEW, USED }
	const CONDITIONS = [
		{ value: 'NEW', label: 'ใหม่' },
		{ value: 'USED', label: 'มือสอง' }
	] as const;

	let title = '';
	let category = '';
	let priceText = '0';
	let description = '';
	// ถ้ายังไม่เพิ่มใน DB/Backend ให้คอมเมนต์ไว้ก่อน
	// let meetPoint = '';
	type ConditionEnum = 'NEW' | 'USED';
	let condition: ConditionEnum = 'USED';

	type Picked = { file: File; url: string; error?: string };
	let files: Picked[] = [];

	let creating = false;
	let errorMsg = '';

	function validateFile(f: File) {
		if (!ACCEPTED_TYPES.includes(f.type)) return 'ชนิดไฟล์ไม่รองรับ';
		if (f.size > MAX_IMAGE_BYTES) return 'ไฟล์ใหญ่เกินกำหนด';
	}

	function choose(e: Event) {
		const list = (e.target as HTMLInputElement).files;
		if (!list) return;

		const left = Math.max(0, MAX_FILES - files.length);
		const incoming = Array.from(list).slice(0, left);

		files = [
			...files,
			...incoming.map((f) => ({
				file: f,
				url: URL.createObjectURL(f),
				error: validateFile(f)
			}))
		];
	}

	function removeAt(i: number) {
		const item = files[i];
		if (browser && item?.url) URL.revokeObjectURL(item.url);
		files = files.filter((_, idx) => idx !== i);
	}

	onDestroy(() => {
		if (!browser) return;
		files.forEach((p) => p.url && URL.revokeObjectURL(p.url));
	});

	/**
	 * อัปโหลดรูปแบบ Minimal Sign:
	 * - ขอ params จาก /api/images/sign (timestamp/signature/apiKey/cloudName)
	 * - ส่งเฉพาะ key ที่ Cloudinary ใช้เซ็นจริง: file, api_key, timestamp, signature
	 * - ห้ามใส่ folder/public_id/upload_preset ระหว่างแก้ Invalid Signature
	 */
	async function uploadImages(): Promise<string[]> {
		const valid = files.filter((x) => !x.error);
		if (valid.length === 0) return [];

		// ขอ signature จาก backend (Minimal Sign: timestamp only)
		const sig = await apiJson<{
			cloudName: string;
			apiKey: string;
			timestamp: number;
			signature: string;
			stringToSign: string;
		}>('/api/images/sign', { method: 'POST' });

		const urls: string[] = [];
		for (const p of valid) {
			const form = new FormData();
			form.append('file', p.file);
			form.append('api_key', sig.apiKey);
			form.append('timestamp', String(sig.timestamp));
			form.append('signature', sig.signature);
			// ❌ งดเพิ่มคีย์อื่น ๆ จนกว่าจะเซ็นร่วมกันทั้งสองฝั่ง (server/client)

			const r = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
				method: 'POST',
				body: form
			});
			const j = await r.json();
			if (!r.ok) throw new Error(j?.error?.message || 'upload failed');
			urls.push(j.secure_url);
		}
		return urls;
	}

	async function submit() {
		errorMsg = '';

		// 1) validate ฟอร์ม
		const price = Number(priceText) || 0;
		if (!title.trim() || !category || price <= 0) {
			errorMsg = 'กรอกชื่อสินค้า / หมวดหมู่ / ราคา ให้ครบ';
			return;
		}
		if (files.some((x) => x.error)) {
			errorMsg = 'มีไฟล์รูปที่ไม่ผ่านเงื่อนไข โปรดลบ/แก้ไขก่อน';
			return;
		}

		// 2) อัปโหลดรูป
		creating = true;
		try {
			const images = await uploadImages();

			// 3) สร้างประกาศ
			const res = await api('/api/listings', {
				method: 'POST',
				body: JSON.stringify({
					title: title.trim(),
					description: description.trim(),
					price,
					condition, // 'NEW' | 'USED'
					images, // array ของ Cloudinary URLs
					category // ต้องเป็นหนึ่งใน enum Category ของ Prisma
				})
			});

			if (res.status === 401) {
				// ยังไม่ล็อกอิน
				openAuth('login');
				return;
			}

			const data = await res.json();
			if (!res.ok) throw new Error(data.message || 'สร้างไม่สำเร็จ');

			location.href = `/listing/${data.listing.id}`;
		} catch (e: any) {
			errorMsg = e?.message || 'เกิดข้อผิดพลาด';
		} finally {
			creating = false;
		}
	}
</script>

<section class="mx-auto max-w-4xl px-4 py-8">
	<div class="rounded-2xl border bg-white shadow p-6 md:p-8">
		<h1 class="text-center text-2xl md:text-3xl font-extrabold text-brand mb-6">
			ลงขายสินค้าของคุณ
		</h1>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			<!-- อัปโหลดรูป (ซ้าย) -->
			<div>
				<label class="block text-sm font-medium mb-2">รูปภาพสินค้า (รูปแรกจะเป็นรูปปก)</label>

				<label
					class="block aspect-[4/3] rounded-xl border-2 border-dashed border-surface/70 bg-neutral-50
                 grid place-items-center cursor-pointer hover:bg-neutral-100 transition"
				>
					<div class="text-center text-neutral-500">
						<div class="text-5xl mb-2">📷</div>
						<div>คลิกเพื่ออัปโหลดรูปภาพ</div>
						<div class="text-xs mt-1">(สูงสุด {MAX_FILES} รูป)</div>
					</div>
					<input
						class="hidden"
						type="file"
						multiple
						accept={ACCEPTED_TYPES.join(',')}
						on:change={choose}
					/>
				</label>

				{#if files.length > 0}
					<div class="grid grid-cols-3 gap-3 mt-3">
						{#each files as f, i}
							<div class="relative group">
								<img src={f.url} alt="preview" class="w-full h-24 object-cover rounded border" />
								<button
									type="button"
									class="absolute top-1 right-1 text-xs px-2 py-0.5 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100"
									on:click={() => removeAt(i)}>ลบ</button
								>
								{#if f.error}
									<div class="text-[10px] text-red-600 mt-1">{f.error}</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- ฟอร์ม (ขวา) -->
			<div class="space-y-4">
				<div>
					<label class="block text-sm mb-1">ชื่อสินค้า</label>
					<input
						class="w-full rounded border px-3 py-2"
						placeholder="เช่น หนังสือเรียน, เสื้อยูนิฟอร์ม"
						bind:value={title}
					/>
				</div>

				<div>
					<label class="block text-sm mb-1">หมวดหมู่</label>
					<select class="w-full rounded border px-3 py-2" bind:value={category}>
						<option value="">-- เลือกหมวดหมู่ --</option>
						<option value="BOOKS">หนังสือ</option>
						<option value="CLOTHES">เสื้อผ้า</option>
						<option value="GADGET">อุปกรณ์</option>
						<option value="FURNITURE">เฟอร์นิเจอร์</option>
						<option value="SPORTS">กีฬา</option>
						<option value="STATIONERY">เครื่องเขียน</option>
						<option value="ELECTRONICS">เครื่องใช้ไฟฟ้า</option>
						<option value="VEHICLES">ยานพาหนะ</option>
						<option value="MUSIC">ดนตรี</option>
						<option value="OTHERS">อื่น ๆ</option>
					</select>
				</div>

				<div>
					<label class="block text-sm mb-1">สภาพ</label>
					<select
						class="w-full rounded border px-3 py-2"
						name="condition"
						id="condition"
						bind:value={condition}
					>
						{#each CONDITIONS as { value, label }}
							<option {value}>{label}</option>
						{/each}
					</select>
				</div>

				<div>
					<label class="block text-sm mb-1">ราคา</label>
					<div class="flex">
						<span class="inline-flex items-center px-3 border border-r-0 rounded-l bg-neutral-50"
							>฿</span
						>
						<input
							class="w-full rounded-r border px-3 py-2"
							inputmode="numeric"
							bind:value={priceText}
						/>
					</div>
				</div>

				<div>
					<label class="block text-sm mb-1">รายละเอียด</label>
					<textarea
						class="w-full rounded border px-3 py-2"
						rows="4"
						placeholder="บอกรายละเอียดสินค้า สภาพ ฯลฯ"
						bind:value={description}
					/>
				</div>
			</div>
		</div>

		{#if errorMsg}
			<div class="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
				{errorMsg}
			</div>
		{/if}

		<div class="mt-6">
			<button
				class="w-full rounded-full bg-brand text-white py-3 text-lg font-semibold hover:bg-brand-2 disabled:opacity-60"
				on:click={submit}
				disabled={creating}
			>
				{creating ? 'กำลังลงขาย...' : 'ลงขายสินค้า'}
			</button>
		</div>
	</div>
</section>

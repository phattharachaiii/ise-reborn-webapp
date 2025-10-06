<!-- src/routes/post/+page.svelte -->
<script lang="ts">
	import { api, apiJson } from '$lib/api/client';
	import { openAuth } from '$lib/stores/auth';
	import { browser } from '$app/environment';
	import { onDestroy } from 'svelte';

	const MAX_FILES = 5;
	const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
	const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

	// Match Prisma enum: Condition { NEW, USED }
	const CONDITIONS = [
		{ value: 'NEW', label: 'New' },
		{ value: 'USED', label: 'Used' }
	] as const;

	let title = '';
	let category = '';
	let priceText = '0';
	let description = '';
	// If not added in DB/Backend, comment out for now
	// let meetPoint = '';
	type ConditionEnum = 'NEW' | 'USED';
	let condition: ConditionEnum = 'USED';

	type Picked = { file: File; url: string; error?: string };
	let files: Picked[] = [];

	let creating = false;
	let errorMsg = '';

	function validateFile(f: File) {
		if (!ACCEPTED_TYPES.includes(f.type)) return 'Unsupported file type';
		if (f.size > MAX_IMAGE_BYTES) return 'File size exceeds the limit';
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
	 * Minimal Sign image upload:
	 * - Request params from /api/images/sign (timestamp/signature/apiKey/cloudName)
	 * - Send only keys used by Cloudinary for signing: file, api_key, timestamp, signature
	 * - Do not add folder/public_id/upload_preset until signature is shared on both server/client
	 */
	async function uploadImages(): Promise<string[]> {
		const valid = files.filter((x) => !x.error);
		if (valid.length === 0) return [];

		// Request signature from backend (Minimal Sign: timestamp only)
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

			const r = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
				method: 'POST',
				body: form
			});
			const j = await r.json();
			if (!r.ok) throw new Error(j?.error?.message || 'Upload failed');
			urls.push(j.secure_url);
		}
		return urls;
	}

	async function submit() {
		errorMsg = '';

		// 1) Validate form
		const price = Number(priceText) || 0;
		if (!title.trim() || !category || price <= 0) {
			errorMsg = 'Please fill in product name, category, and price.';
			return;
		}
		if (files.some((x) => x.error)) {
			errorMsg = 'Some images do not meet the requirements. Please remove or fix them.';
			return;
		}

		// 2) Upload images
		creating = true;
		try {
			const images = await uploadImages();

			// 3) Create listing
			const res = await api('/api/listings', {
				method: 'POST',
				body: JSON.stringify({
					title: title.trim(),
					description: description.trim(),
					price,
					condition, // 'NEW' | 'USED'
					images, // array of Cloudinary URLs
					category // Must be one of Prisma enum Category
				})
			});

			if (res.status === 401) {
				// Not logged in
				openAuth('login');
				return;
			}

			const data = await res.json();
			if (!res.ok) throw new Error(data.message || 'Failed to create listing');

			location.href = `/listing/${data.listing.id}`;
		} catch (e: any) {
			errorMsg = e?.message || 'An error occurred';
		} finally {
			creating = false;
		}
	}
</script>

<section class="mx-auto max-w-4xl px-4 py-8">
	<div class="rounded-2xl border bg-white shadow p-6 md:p-8">
		<h1 class="text-center text-2xl md:text-3xl font-extrabold text-brand mb-6">
			Sell Your Product
		</h1>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			<!-- Image upload (left) -->
			<div>
				<label class="block text-sm font-medium mb-2" for="product-images">
					Product Images (the first image will be the cover)
				</label>

				<label
					class="block aspect-[4/3] rounded-xl border-2 border-dashed border-surface/70 bg-neutral-50
				 grid place-items-center cursor-pointer hover:bg-neutral-100 transition"
				>
					<div class="text-center text-neutral-500">
						<div class="text-5xl mb-2">📷</div>
						<div>Click to upload images</div>
						<div class="text-xs mt-1">(Up to {MAX_FILES} images)</div>
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
									on:click={() => removeAt(i)}>Remove</button
								>
								{#if f.error}
									<div class="text-[10px] text-red-600 mt-1">{f.error}</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Form (right) -->
			<div class="space-y-4">
				<div>
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="block text-sm mb-1">Product Name</label>
					<input
						class="w-full rounded border px-3 py-2"
						placeholder="e.g. Textbook, Uniform"
						bind:value={title}
					/>
				</div>

				<div>
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="block text-sm mb-1">Category</label>
					<select class="w-full rounded border px-3 py-2" bind:value={category}>
						<option value="">-- Select Category --</option>
						<option value="BOOKS">Books</option>
						<option value="CLOTHES">Clothes</option>
						<option value="GADGET">Gadgets</option>
						<option value="FURNITURE">Furniture</option>
						<option value="SPORTS">Sports</option>
						<option value="STATIONERY">Stationery</option>
						<option value="ELECTRONICS">Electronics</option>
						<option value="VEHICLES">Vehicles</option>
						<option value="MUSIC">Music</option>
						<option value="OTHERS">Others</option>
					</select>
				</div>

				<div>
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="block text-sm mb-1">Condition</label>
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
					<label class="block text-sm mb-1" for="price">Price</label>
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
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="block text-sm mb-1">Description</label>
					<textarea
						class="w-full rounded border px-3 py-2"
						rows="4"
						placeholder="Describe your product, condition, etc."
						bind:value={description}
					></textarea>
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
				class="cursor-pointer tr w-full rounded-full bg-brand text-white py-3 text-lg font-semibold hover:bg-brand-h disabled:opacity-60"
				on:click={submit}
				disabled={creating}
			>
				{creating ? 'Posting...' : 'Post Product'}
			</button>
		</div>
	</div>
</section>

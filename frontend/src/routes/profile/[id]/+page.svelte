<!-- frontend/src/routes/profile/[id]/+page.svelte -->
<script lang="ts">
	import { page } from '$app/stores';
	import { api, apiJson } from '$lib/api/client';
	import { onMount } from 'svelte';
	import { auth as authStore, openAuth } from '$lib/stores/auth';
	import { get } from 'svelte/store';

	export const data: any = undefined;
	$: id = $page.params.id;

	let user: any = null;
	let listings: any[] = [];
	let loading = true;
	let err = '';

	// Report form
	let reason = '';
	let details = '';
	type EvFile = { file: File; url: string };
	let evidenceFiles: EvFile[] = [];
	let submitting = false;

	let showSuccess = false;

	onMount(async () => {
		try {
			const ures = await api('/api/users/' + id);
			const ujson = await ures.json();
			if (!ures.ok) throw new Error(ujson.message || 'Failed to load user');
			user = ujson.user;

			const lres = await api('/api/listings?sellerId=' + id + '&limit=12');
			const ljson = await lres.json();
			listings = ljson.items || [];
		} catch (e: any) {
			err = e?.message || 'Error';
		} finally {
			loading = false;
		}
	});

	async function uploadEvidence(): Promise<string[]> {
		if (evidenceFiles.length === 0) return [];
		const sig = await apiJson<{
			cloudName: string;
			apiKey: number | string;
			timestamp: number;
			signature: string;
		}>('/api/images/sign', { method: 'POST' });

		const urls: string[] = [];
		for (const p of evidenceFiles) {
			const form = new FormData();
			form.append('file', p.file);
			form.append('api_key', String(sig.apiKey));
			form.append('timestamp', String(sig.timestamp));
			form.append('signature', sig.signature);

			const up = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
				method: 'POST',
				body: form
			});
			const jd = await up.json();
			if (!up.ok) throw new Error(jd?.error?.message || 'Upload failed');
			urls.push(jd.secure_url || jd.url);
		}
		return urls;
	}

	function onChoose(e: Event) {
		const list = (e.target as HTMLInputElement).files;
		if (!list) return;
		const incoming = Array.from(list).slice(0, 5 - evidenceFiles.length);
		evidenceFiles = [
			...evidenceFiles,
			...incoming.map((f) => ({ file: f, url: URL.createObjectURL(f) }))
		];
	}
	function removeFile(i: number) {
		const p = evidenceFiles[i];
		try {
			URL.revokeObjectURL(p.url);
		} catch {}
		evidenceFiles = evidenceFiles.filter((_, idx) => idx !== i);
	}

	async function submitReport() {
		const me = get(authStore).user;
		if (!me) {
			openAuth('login');
			return;
		}
		if (!reason.trim()) {
			// popup/toast
			alert('Please provide a reason.');
			return;
		}
		submitting = true;
		try {
			const evidenceImageUrls = await uploadEvidence();
			const res = await api('/api/reports', {
				method: 'POST',
				body: JSON.stringify({
					targetUserId: id,
					reason: reason.trim(),
					details: details.trim() || undefined,
					evidenceImageUrls
				})
			});
			const j = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(j?.message || 'Failed to submit report');

			// Clear form on success
			reason = '';
			details = '';
			evidenceFiles.forEach((f) => {
				try {
					URL.revokeObjectURL(f.url);
				} catch {}
			});
			evidenceFiles = [];
			showSuccess = true;
		} catch (e: any) {
			alert(e?.message || 'Error');
		} finally {
			submitting = false;
		}
	}
</script>

<section class="mx-auto max-w-4xl px-4 py-8">
	{#if loading}
		<div>Loading...</div>
	{:else if err}
		<div class="text-red-600">{err}</div>
	{:else}
		<div class="rounded-2xl border bg-white shadow p-6 md:p-8">
			<div class="flex items-center gap-4">
				<img
					src={user?.avatarUrl || 'https://placehold.co/96x96'}
					alt="avatar"
					class="w-16 h-16 rounded-full border object-cover"
				/>
				<div>
					<h1 class="text-xl font-bold">{user?.name || 'User'}</h1>
					<div class="text-xs text-neutral-500">Status: {user?.accountStatus}</div>
				</div>
			</div>

			<h2 class="mt-6 font-semibold">Active Listings</h2>
			{#if listings.length === 0}
				<div class="text-sm text-neutral-500 mt-1">No active items.</div>
			{:else}
				<div class="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
					{#each listings as it}
						<a
							href={'/listing/' + it.id}
							class="block border rounded-lg overflow-hidden hover:shadow"
						>
							<img
								src={it.imageUrls?.[0] || 'https://placehold.co/300x225'}
								alt={it.title}
								class="w-full h-32 object-cover"
							/>
							<div class="p-2">
								<div class="font-medium line-clamp-1">{it.title}</div>
								<div class="text-sm text-neutral-600">฿{it.price}</div>
							</div>
						</a>
					{/each}
				</div>
			{/if}

			<div class="mt-8 border-t pt-6">
				<h2 class="font-semibold">Report this user</h2>
				<div class="text-xs text-neutral-600 mb-2">
					Please provide a reason and optional evidence images.
				</div>

				<div class="space-y-3">
					<div>
						<label for="reason" class="block text-sm mb-1">Reason*</label>
						<input
							id="reason"
							class="w-full rounded border px-3 py-2"
							bind:value={reason}
							placeholder="E.g., Fraudulent behavior, scam attempt, etc."
						/>
					</div>

					<div>
						<label for="details" class="block text-sm mb-1">Details (optional)</label>
						<textarea
							id="details"
							class="w-full rounded border px-3 py-2 min-h-24"
							bind:value={details}
							placeholder="Provide more context..."
						></textarea>
					</div>

					<!-- Evidence -->
					<div class="space-y-2">
						<div class="flex items-center justify-between">
							<label for="evidence-file-input" class="block text-sm">Evidence Images (optional)</label>
							<div class="text-xs text-neutral-500">{evidenceFiles.length}/5</div>
						</div>

						
						<!-- Dropzone -->
						<div class="mt-2">
							<label
								class="block w-full rounded-xl border-2 border-dashed border-neutral-300
		   p-6 sm:p-8 md:p-10 cursor-pointer hover:bg-neutral-50 transition
		   grid place-items-center text-center min-h-40 sm:min-h-48"
							>
								<div>
									<div class="text-4xl leading-none mb-2">📎</div>
									<div class="text-sm font-medium">Attach images</div>
									<div class="text-xs text-neutral-500 mt-1">
										Drag & drop or click · up to 5 images
									</div>
								</div>

								<input id="evidence-file-input" type="file" accept="image/*" multiple class="hidden" on:change={onChoose} />
							</label>
						</div>

						<!-- Preview -->
						{#if evidenceFiles.length > 0}
							<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
								{#each evidenceFiles as f, i}
									<div class="relative group aspect-square rounded-md overflow-hidden border">
										<img
											src={f.url}
											alt="evidence"
											class="w-full h-full object-cover"
											loading="lazy"
											decoding="async"
										/>
										<button
											type="button"
											class="absolute top-1 right-1 text-[11px] px-2 py-0.5 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100"
											on:click={() => removeFile(i)}
										>
											Remove
										</button>
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<div class="pt-2">
						<button
							class="rounded-full px-5 py-2 bg-brand text-white hover:bg-brand-2 disabled:opacity-60 cursor-pointer"
							on:click={submitReport}
							disabled={submitting}
						>
							{submitting ? 'Submitting...' : 'Submit Report'}
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
</section>

<!-- Popup Success -->
{#if showSuccess}
	<div class="fixed inset-0 z-[95] bg-black/30 overflow-y-auto">
		<div class="min-h-full flex items-center justify-center p-4">
			<div class="w-[min(90vw,420px)] rounded-xl bg-white p-4 border border-surface shadow-card">
				<div class="text-lg font-semibold mb-1">Report submitted</div>
				<p class="text-sm text-neutral-600">
					Thank you for your report. Our team will review it shortly.
				</p>
				<div class="mt-4 flex justify-end gap-2">
					<button
						class="rounded px-3 py-2 bg-brand text-white hover:bg-brand-2"
						on:click={() => (showSuccess = false)}
					>
						OK
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

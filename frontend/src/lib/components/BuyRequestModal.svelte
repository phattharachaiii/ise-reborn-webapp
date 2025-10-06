<script lang="ts">
	import { apiJson } from '$lib/api/client';
	import { openAuth } from '$lib/stores/auth';
	import PlaceSelect from '$lib/components/PlaceSelect.svelte';

	export let open = false;
	export let listingId: string;
	export let onClose: () => void = () => {};
	export let onSubmitted: () => void = () => {};

	let meetPlace = '';
	let meetTime = '';
	let note = '';
	let loading = false;
	let errorMsg = '';

	function minLocalDateTimeString(addMinutes = 5) {
		const d = new Date(Date.now() + addMinutes * 60000);
		d.setSeconds(0, 0);
		const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
		return local.toISOString().slice(0, 16);
	}
	let minDT = minLocalDateTimeString(5);

	async function submit() {
		errorMsg = '';
		if (!listingId) return;
		if (!meetPlace.trim() || !meetTime) {
			errorMsg = 'Please fill in both meeting place and time.';
			return;
		}
		const chosen = new Date(meetTime);
		if (isNaN(chosen.getTime())) {
			errorMsg = 'Invalid date and time format.';
			return;
		}
		if (chosen.getTime() < Date.now() + 5 * 60 * 1000) {
			errorMsg = 'Please select a time at least 5 minutes from now.';
			return;
		}

		loading = true;
		try {
			await apiJson('/api/offers', {
				method: 'POST',
				body: JSON.stringify({
					listingId,
					meetPlace: meetPlace.trim(),
					meetTime: chosen.toISOString(),
					note: note.trim() || undefined
				})
			});
			onSubmitted();
			onClose();
			meetPlace = '';
			meetTime = '';
			note = '';
			minDT = minLocalDateTimeString(5);
		} catch (e: any) {
			errorMsg = e?.message || 'Failed to submit request.';
		} finally {
			loading = false;
		}
	}
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
		<div class="w-full max-w-lg rounded-xl bg-white shadow-xl border">
			<header class="flex items-center justify-between p-4 border-b">
				<h2 class="font-semibold">Submit Purchase Request</h2>
				<button
					class="px-2 py-1 text-sm font-semibold text-gray-600 hover:text-white
		 bg-gray-100 hover:bg-red-500 border border-gray-200
		 rounded-full shadow-sm transition-all duration-200
		 hover:scale-105 active:scale-95 cursor-pointer"
					on:click={onClose}
				>
					✕
				</button>
			</header>

			<div class="p-4 space-y-3">
				<div>
					<div>
						<label class="block text-sm mb-1">Meeting Place</label>
						<PlaceSelect bind:value={meetPlace} required allowCustom />
					</div>
				</div>

				<div>
					<label class="block text-sm mb-1">Meeting Date &amp; Time</label>
					<input
						type="datetime-local"
						class="w-full rounded border px-3 py-2"
						bind:value={meetTime}
						min={minDT}
						on:focus={() => (minDT = minLocalDateTimeString(5))}
						on:click={() => (minDT = minLocalDateTimeString(5))}
					/>
					<p class="text-[11px] text-neutral-500 mt-1">Must be at least 5 minutes from now.</p>
				</div>

				<div>
					<label class="block text-sm mb-1">Note (optional)</label>
					<input
						class="w-full rounded border px-3 py-2"
						bind:value={note}
						placeholder="Additional information for the seller"
					/>
				</div>

				{#if errorMsg}
					<div class="rounded border border-red-200 bg-red-50 text-red-700 p-2 text-sm">
						{errorMsg}
					</div>
				{/if}
			</div>

			<footer class="p-4 border-t flex justify-center gap-2">
				<button
					class="rounded px-4 py-2 bg-brand text-white disabled:opacity-60 cursor-pointer
		  hover:brightness-110 active:scale-95 transition-all duration-150"
					disabled={loading}
					on:click={submit}
				>
					{loading ? 'Submitting…' : 'Submit Purchase Request'}
				</button>
			</footer>
		</div>
	</div>
{/if}

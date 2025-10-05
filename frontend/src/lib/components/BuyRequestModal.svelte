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
			errorMsg = 'กรอกสถานที่และเวลานัดให้ครบ';
			return;
		}
		const chosen = new Date(meetTime);
		if (isNaN(chosen.getTime())) {
			errorMsg = 'รูปแบบเวลาไม่ถูกต้อง';
			return;
		}
		if (chosen.getTime() < Date.now() + 5 * 60 * 1000) {
			errorMsg = 'กรุณาเลือกเวลาที่มากกว่าปัจจุบันอย่างน้อย 5 นาที';
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
			errorMsg = e?.message || 'ส่งคำขอไม่สำเร็จ';
		} finally {
			loading = false;
		}
	}
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
		<div class="w-full max-w-lg rounded-xl bg-white shadow-xl border">
			<header class="flex items-center justify-between p-4 border-b">
				<h2 class="font-semibold">ส่งคำขอซื้อ</h2>
				<button class="px-2 py-1 text-sm" on:click={onClose}>ปิด</button>
			</header>

			<div class="p-4 space-y-3">
				<div>
					<div>
						<label class="block text-sm mb-1">สถานที่นัด</label>
						<PlaceSelect bind:value={meetPlace} required allowCustom />
					</div>
				</div>

				<div>
					<label class="block text-sm mb-1">วัน–เวลานัด</label>
					<input
						type="datetime-local"
						class="w-full rounded border px-3 py-2"
						bind:value={meetTime}
						min={minDT}
						on:focus={() => (minDT = minLocalDateTimeString(5))}
						on:click={() => (minDT = minLocalDateTimeString(5))}
					/>
					<p class="text-[11px] text-neutral-500 mt-1">ต้องมากกว่าปัจจุบันอย่างน้อย 5 นาที</p>
				</div>

				<div>
					<label class="block text-sm mb-1">โน้ต (ถ้ามี)</label>
					<input
						class="w-full rounded border px-3 py-2"
						bind:value={note}
						placeholder="ข้อมูลเพิ่มเติมสำหรับผู้ขาย"
					/>
				</div>

				{#if errorMsg}
					<div class="rounded border border-red-200 bg-red-50 text-red-700 p-2 text-sm">
						{errorMsg}
					</div>
				{/if}
			</div>

			<footer class="p-4 border-t flex justify-end gap-2">
				<button class="rounded px-4 py-2 border" on:click={onClose}>ยกเลิก</button>
				<button
					class="rounded px-4 py-2 bg-brand text-white disabled:opacity-60"
					disabled={loading}
					on:click={submit}
				>
					{loading ? 'กำลังส่ง…' : 'ส่งคำขอซื้อ'}
				</button>
			</footer>
		</div>
	</div>
{/if}

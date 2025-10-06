<!-- src/lib/components/PlaceSelect.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { CAMPUS_SPOTS, type CampusSpot } from '$lib/constants/meet-places';

	export let value = ''; // ชื่อสถานที่ที่เลือก (หรือที่พิมพ์เอง)
	export let required = false;
	export let allowCustom = true;
	export let disabled = false;
	export let name = 'meetPlace';

	const OTHER = '__OTHER__';
	let mode: 'LIST' | 'OTHER' = 'LIST';
	let customText = '';
	let error = '';

	// 1) เรียงและจัดกลุ่มตาม area
	const grouped = (() => {
		// เรียงชื่อภายในโซน
		const sorted: CampusSpot[] = [...CAMPUS_SPOTS].sort((a, b) =>
			a.name.localeCompare(b.name, 'th')
		);
		// ลำดับโซน (ปรับได้ตามที่อยากให้โชว์ก่อน-หลัง)
		const AREA_ORDER = [
			'โซนคณะ',
			'โซนอาคารเรียนรวม',
			'โซนวิชาการ',
			'โซนสำนักงาน',
			'โซนกลาง',
			'โซนหอพัก',
			'โซนสวัสดิการ',
			'โซนกีฬา',
			'โซนพักผ่อน',
			'การเดินทาง',
			'ทางเข้า-ออก',
			'อื่นๆ'
		];
		const buckets = new Map<string, CampusSpot[]>();
		for (const s of sorted) {
			const k = s.area || 'อื่นๆ';
			if (!buckets.has(k)) buckets.set(k, []);
			buckets.get(k)!.push(s);
		}
		// คืนเป็น array เพื่อวนซ้ำใน template
		const byOrder = [...buckets.entries()].sort((a, b) => {
			const ia = AREA_ORDER.indexOf(a[0]);
			const ib = AREA_ORDER.indexOf(b[0]);
			return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
		});
		return byOrder; // [ [area, CampusSpot[]], ... ]
	})();

	function hydrateInitial() {
		// ถ้ามีค่าเริ่มต้น แต่ไม่พบใน list → OTHER
		const all = grouped.flatMap(([, arr]) => arr);
		if (value && !all.some((o) => o.name === value)) {
			mode = 'OTHER';
			customText = value;
		}
	}

	function onSelect(e: Event) {
		const v = (e.target as HTMLSelectElement).value;
		if (v === OTHER) {
			mode = 'OTHER';
			customText = '';
			value = '';
			return;
		}
		mode = 'LIST';
		// map จาก id → name
		const all = grouped.flatMap(([, arr]) => arr);
		const found = all.find((o) => o.id === v);
		value = found ? found.name : '';
	}

	// sync ค่าเมื่อโหมด OTHER
	$: if (mode === 'OTHER') value = customText;

	onMount(hydrateInitial);
</script>

<div class="space-y-2">
	<select
		class="w-full rounded border px-3 py-2"
		{name}
		on:change={onSelect}
		{disabled}
		required={required && mode === 'LIST'}
	>
		<option value="">-- เลือกสถานที่นัด --</option>

		{#each grouped as [area, spots] (area)}
			<optgroup label={area}>
				{#each spots as o (o.id)}
					<option value={o.id} selected={mode === 'LIST' && value === o.name}>
						{o.name}{o.open ? ` (${o.open})` : ''}
					</option>
				{/each}
			</optgroup>
		{/each}

		{#if allowCustom}
			<optgroup label="กำหนดเอง">
				<option value={OTHER} selected={mode === 'OTHER'}>อื่น ๆ (พิมพ์เอง)</option>
			</optgroup>
		{/if}
	</select>

	{#if mode === 'OTHER' && allowCustom}
		<input
			class="w-full rounded border px-3 py-2"
			placeholder="พิมพ์สถานที่เอง"
			bind:value={customText}
			{disabled}
			{required}
		/>
	{/if}

	{#if error}
		<div class="text-[12px] text-red-600">{error}</div>
	{/if}
</div>

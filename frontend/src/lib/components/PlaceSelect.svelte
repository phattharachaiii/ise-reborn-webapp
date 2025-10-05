<!-- src/lib/components/PlaceSelect.svelte -->
<script lang="ts">
	// dropdown รายชื่อจาก /api/meet-places + ตัวเลือก "OTHER" เพื่อพิมพ์เอง
	export let value = ''; // bind:value ← ชื่อสถานที่ที่เลือก (หรือที่พิมพ์เอง)
	export let required = false;
	export let allowCustom = true;
	export let disabled = false;
	export let name = 'meetPlace';

	let options: Array<{ id: string; name: string; area: string; open?: string | null }> = [];
	let loading = false;
	let error = '';

	const OTHER = '__OTHER__';
	let mode: 'LIST' | 'OTHER' = 'LIST';
	let customText = '';

	async function load() {
		loading = true;
		error = '';
		try {
			// เรียกโดยไม่ใส่ q → backend จะส่ง top 10 กลับมา
			const r = await fetch('/api/meet-places', { credentials: 'include' });
			const j = await r.json();
			if (!r.ok) throw new Error(j?.message || 'โหลดสถานที่ไม่สำเร็จ');
			options = Array.isArray(j?.suggestions) ? j.suggestions : [];
			// ถ้า value ที่ส่งเข้ามาไม่ตรงกับ options ให้สลับไปโหมด OTHER
			if (value && !options.some((o) => o.name === value)) {
				mode = 'OTHER';
				customText = value;
			}
		} catch (e: any) {
			error = e?.message || 'โหลดสถานที่ไม่สำเร็จ';
		} finally {
			loading = false;
		}
	}
	load();

	function onSelect(e: Event) {
		const v = (e.target as HTMLSelectElement).value;
		if (v === OTHER) {
			mode = 'OTHER';
			customText = '';
			value = '';
			return;
		}
		mode = 'LIST';
		const found = options.find((o) => o.id === v);
		value = found ? found.name : '';
	}

	$: if (mode === 'OTHER') value = customText;
</script>

<div class="space-y-2">
	<select
		class="w-full rounded border px-3 py-2"
		{name}
		on:change={onSelect}
		disabled={disabled || loading}
		aria-busy={loading}
		required={required && mode === 'LIST'}
	>
		<option value="">-- เลือกสถานที่นัด --</option>
		{#each options as o}
			<option value={o.id} selected={mode === 'LIST' && value === o.name}>
				{o.name}
				{o.open ? `(${o.open})` : ''}
			</option>
		{/each}
		{#if allowCustom}
			<option value="__OTHER__" selected={mode === 'OTHER'}>อื่น ๆ (พิมพ์เอง)</option>
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

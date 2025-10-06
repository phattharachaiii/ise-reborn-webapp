<script lang="ts">
	export let max = 5;
	let inputEl: HTMLInputElement;
	let files: string[] = [];
	const onChange = async () => {
		files = [];
		const list = Array.from(inputEl.files ?? []).slice(0, max);
		for (const f of list) {
			if (f.type.startsWith('image/')) {
				const reader = new FileReader();
				const url: string = await new Promise((res) => {
					reader.onload = () => res(reader.result as string);
					reader.readAsDataURL(f);
				});
				files.push(url);
			}
		}
	};
</script>

<label
	class="border-2 border-dashed border-surface rounded-lg h-[300px] w-full flex flex-col items-center justify-center text-center cursor-pointer hover:border-[color:var(--color-brand-orange)] hover:bg-orange-50 transition"
>
	<div class="text-4xl">📷</div>
	<div class="text-neutral-500">Click to upload images</div>
	<small class="text-neutral-400">(Maximum {max} images)</small>
	<input
		bind:this={inputEl}
		type="file"
		multiple
		accept="image/*"
		class="hidden"
		on:change={onChange}
	/>
</label>
{#if files.length}
	<div class="mt-3 grid grid-cols-5 gap-2">
		{#each files as src}
			<img {src} alt="preview" class="w-20 h-20 rounded object-cover border border-surface" />
		{/each}
	</div>
{/if}

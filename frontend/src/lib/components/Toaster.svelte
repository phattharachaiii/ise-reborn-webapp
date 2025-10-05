<!-- src/lib/components/Toaster.svelte -->
<script lang="ts">
	import { toast, type ToastItem } from '$lib/stores/toast';
	import { fade, fly } from 'svelte/transition';
	import {
		CheckCircleSolid,
		ExclamationCircleSolid,
		InfoCircleSolid,
		CloseCircleSolid
	} from 'flowbite-svelte-icons';

	let items: ToastItem[] = [];
	const unsub = toast.subscribe((v) => (items = v));

	function icon(kind: ToastItem['kind']) {
		if (kind === 'success') return CheckCircleSolid;
		if (kind === 'error') return ExclamationCircleSolid;
		return InfoCircleSolid;
	}

	function color(kind: ToastItem['kind']) {
		if (kind === 'success') return 'bg-green-50 border-green-200 text-green-800';
		if (kind === 'error') return 'bg-red-50 border-red-200 text-red-800';
		return 'bg-neutral-50 border-neutral-200 text-neutral-800';
	}
</script>

<div class="fixed bottom-4 right-4 z-[120] space-y-2 w-[92vw] max-w-sm">
	{#each items as t (t.id)}
		<div
			in:fly={{ y: 12, duration: 150 }}
			out:fade={{ duration: 150 }}
			class="rounded-xl border shadow-card p-3 flex gap-3 items-start {color(t.kind)}"
		>
			{#if icon(t.kind)}
				{@const Icon = icon(t.kind)}
				<Icon class="w-5 h-5 mt-0.5 shrink-0" />
			{/if}
			<div class="min-w-0">
				{#if t.title}<div class="font-semibold">{t.title}</div>{/if}
				{#if t.message}
					<div class="text-sm opacity-90 break-words">{t.message}</div>
				{/if}
			</div>
			<button
				class="ml-auto p-1 rounded hover:bg-black/5"
				on:click={() => toast.dismiss(t.id)}
				aria-label="Close toast"
			>
				<CloseCircleSolid class="w-4 h-4" />
			</button>
		</div>
	{/each}
</div>

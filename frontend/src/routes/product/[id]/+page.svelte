<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import { page } from '$app/stores';
	import { derived } from 'svelte/store';
	import { toast } from '$lib/stores/toast';
	const products = {
		p4: {
			title: 'Fundamental of Physics Book',
			price: 450,
			image:
				'https://images.unsplash.com/photo-1544947950-fa07a98d237f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800'
		}
	} as const;

	const id = derived(page, ($p) => $p.params.id as keyof typeof products);

	let showBuyModal = false;
	let showSellerBanner = false;
	let presetLocation = 'Central Canteen';
	let customLocation = '';

	const openBuy = () => (showBuyModal = true);
	const closeBuy = () => (showBuyModal = false);
	const sendRequest = () => {
		toast.success(
			'Request sent successfully! 🎉\nPlease wait for the seller to respond within 24 hours.'
		);
		showSellerBanner = true;
		closeBuy();
	};
</script>

<div class="mx-auto max-w-6xl px-4 py-8">
	<div class="bg-white rounded-xl p-6 shadow-card border border-surface grid md:grid-cols-2 gap-8">
		<div>
			<img src={products[$id]?.image} alt={products[$id]?.title} class="w-full rounded-lg" />
		</div>
		<div>
			<h1 class="text-3xl font-bold">{products[$id]?.title}</h1>
			<div class="text-2xl font-extrabold text-brand my-4">
				฿ {products[$id]?.price?.toLocaleString()}
			</div>
			<div class="flex items-center gap-4 bg-surface-light rounded-lg p-4">
				<div class="size-12 rounded-full bg-neutral-200 grid place-items-center">👤</div>
				<div>
					<div class="font-semibold">Somchai Jaidee</div>
					<div class="text-sm text-neutral-500">Faculty of Engineering</div>
				</div>
			</div>
			<div class="mt-6">
				<p class="font-semibold mb-1">Details:</p>
				<p class="text-neutral-700">
					Physics 1 textbook, 95% condition, no markings, already covered with plastic.
				</p>
			</div>
			<button
				class="mt-6 w-full rounded-lg bg-brand text-white py-3 text-lg font-medium hover:bg-brand-2 transition"
				on:click={openBuy}>Buy Now</button
			>

			{#if showSellerBanner}
				<div
					class="mt-6 p-4 rounded-lg border border-[color:var(--color-brand-orange)] bg-orange-50"
				>
					<h4 class="font-semibold">📬 You have 1 new purchase request!</h4>
					<p class="mt-1 text-sm">
						<strong>Buyer:</strong> Somying Rukrian<br /><strong>Proposed Location:</strong> Central
						Canteen
					</p>
					<p class="italic text-sm text-neutral-600">Please respond within 24 hours.</p>
					<div class="flex flex-wrap gap-2 mt-3">
						<button class="flex-1 min-w-24 rounded bg-green-600 text-white px-4 py-2"
							>✔ Accept</button
						>
						<button class="flex-1 min-w-24 rounded bg-red-600 text-white px-4 py-2"
							>✖ Reject</button
						>
						<button class="flex-1 min-w-24 rounded bg-neutral-600 text-white px-4 py-2"
							>🔄 Propose Another Location</button
						>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<Modal bind:open={showBuyModal} title="Confirm Purchase and Meeting Location" onClose={closeBuy}>
	<div class="space-y-4">
		<div>
			<label class="block text-sm font-medium mb-1" for="preset-location">
				Select Meeting Location
			</label>
			<select
				bind:value={presetLocation}
				class="w-full rounded border border-surface px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[color:oklch(65%_0.2_60)]/30"
			>
				<option value="Central Canteen">Central Canteen</option>
				<option value="Under Engineering Building">Under Engineering Building</option>
				<option value="Library">Library</option>
			</select>
		</div>
		<div>
			<label class="block text-sm font-medium mb-1" for="custom-location">
				Or Propose Another Location
			</label>
			<input
				bind:value={customLocation}
				placeholder="e.g. In front of 7-Eleven, Building A"
				class="w-full rounded border border-surface px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[color:oklch(65%_0.2_60)]/30"
			/>
		</div>
		<div class="flex gap-2">
			<button class="rounded bg-neutral-300 text-neutral-800 px-4 py-2" on:click={closeBuy}
				>Cancel</button
			>
			<button class="flex-1 rounded bg-brand text-white px-4 py-2" on:click={sendRequest}
				>Send Request</button
			>
		</div>
	</div>
</Modal>

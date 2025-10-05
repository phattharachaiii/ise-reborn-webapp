<script lang="ts">
	import ProductCard from './ProductCard.svelte';
	import type { ProductCardInput } from './ProductCard.svelte';
	export let items: ProductCardInput[] = [];
</script>

<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
	{#each items as item}
		<ProductCard {item} />
	{/each}
</div>

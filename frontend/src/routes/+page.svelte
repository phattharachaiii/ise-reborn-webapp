<script lang="ts">
	import { apiJson } from '$lib/api/client';
	import ProductGrid from '$lib/components/ProductGrid.svelte';
	import { onMount } from 'svelte';
	import { auth, openAuth } from '$lib/stores/auth'; //เอาไว้้เช็คว่า login หรือยัง
	import { goto } from '$app/navigation'; //ให้เด้ง Popup login
	// === DTO จาก backend ===
	type ListingDTO = {
		id: string;
		title: string;
		description: string;
		price: number;
		condition: string; // NEW | LIKE_NEW | USED
		status: string; // ACTIVE | SOLD | HIDDEN
		createdAt: string;
		imageUrls?: string[]; // << สำคัญ: ต้องมี field นี้
		seller?: { id: string; name: string };
	};

	// === shape ให้การ์ด/กริด ===
	type ProductCardData = {
		id: string;
		title: string;
		price: number;
		image?: string | null;
		boosted?: boolean;
	};

	// (ออปชัน) ถ้าใช้ Cloudinary อยากให้เป็น thumbnail เร็วขึ้น
	function toThumb(url?: string | null, size = 400) {
		if (!url) return null;
		return url.includes('/upload/')
			? url.replace('/upload/', `/upload/c_fill,w_${size},h_${size},q_auto,f_auto/`)
			: url;
	}

	function toProductCardData(x: ListingDTO): ProductCardData {
		const cover = x.imageUrls?.[0] ?? null;
		return {
			id: x.id,
			title: x.title,
			price: x.price,
			image: toThumb(cover), // << ใช้รูปแรกเป็นปก (ย่อด้วย transformation ถ้ามี)
			boosted: false
		};
	}

	let loading = true;
	let items: ProductCardData[] = [];
	let total = 0;
	let query = '';

	async function load() {
		loading = true;
		try {
			const data = await apiJson<{ items: ListingDTO[]; total?: number }>(
				`/api/listings?query=${encodeURIComponent(query)}`
			);
			items = (data.items ?? []).map(toProductCardData);
			total = data.total ?? items.length;
		} catch (e: any) {
			console.error('load listings error:', e);
			items = [];
			total = 0;
		} finally {
			loading = false;
		}
	}
	function handlePostClick(e: MouseEvent) {
		// ถ้ายังไม่ล็อกอิน → เปิด modal login แทนการไป /post
		if (!$auth.user) {
			e.preventDefault(); // กันการนำทางของ <a>
			openAuth('login'); // เปิดป๊อปอัพล็อกอิน
			return;
		}
		// ถ้าล็อกอินแล้ว ปล่อยให้ลิงก์ทำงานตามปกติ หรือจะสั่ง goto ก็ได้:
		// goto('/post');
	}

	onMount(load);
</script>

<div class="flex flex-col items-center text-center bg-white p-16 gap-4 rounded-lg shadow">
	<h1 class="text-brand text-3xl font-bold">ตลาดนัดมือสอง เพื่อนักศึกษา</h1>
	<p class="text-lg text-neutral-600">ซื้อ-ขาย ปลอดภัย ยืนยันตัวตนด้วยอีเมลสถาบัน</p>
	<a
		href="/post"
		on:click={handlePostClick}
		class="
            inline-flex items-center justify-center
            py-2 px-6 rounded-full text-base font-bold text-white
            border border-[color:var(--color-brand-orange)]
            bg-brand hover:bg-brand-hover
            sm:bg-transparent sm:text-brand sm:hover:bg-black
            transition
          "
	>
		ลงขายเลย !
	</a>
</div>
<section class="mx-auto max-w-6xl px-4 py-6 space-y-4 overflow-y-auto">
	{#if loading}
		<p>กำลังโหลด…</p>
	{:else if items.length === 0}
		<div class="rounded-xl border border-dashed border-surface bg-white p-8 text-center">
			<h3 class="text-lg font-semibold mb-2">ยังไม่มีประกาศสินค้า</h3>
			<p class="text-sm text-neutral-600 mb-4">เป็นคนแรกที่ลงขายให้เพื่อน ๆ ในมอได้เลย!</p>
			<!-- <a href="/post" class="inline-block rounded bg-brand text-white px-4 py-2">ลงขายเลย</a> -->
		</div>
	{:else}
		<div class="space-y-12">
			<div>
				<p class="mt-8 text-3xl text-gray-750 font-bold">✨ สินค้ามาใหม่ล่าสุด {total} รายการ</p>
			</div>
			<ProductGrid {items} />
		</div>
	{/if}
</section>

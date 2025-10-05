<!-- src/lib/components/ProductCard.svelte -->
<script context="module" lang="ts">
	export type ProductCardInput = {
		id: string;
		title: string;
		price: number;
		status?: 'ACTIVE' | 'SOLD' | 'HIDDEN' | string;
		imageUrls?: string[] | string | null;
		images?: string[] | string | null;
		imageUrl?: string | null;
		coverUrl?: string | null;
		thumbnailUrl?: string | null;
		image?: string | null;
		cover?: string | null;
		photoUrl?: string | null;

		category?: string;
		boostedUntil?: string | null;
		seller?: { id: string; name: string } | null;
	};
</script>

<script lang="ts">
	// 👉 ถ้า parent เผลอส่ง undefined มา จะไม่ระเบิด แต่ขึ้น skeleton แทน
	export let item: ProductCardInput | null | undefined;

	const CAT_LABEL: Record<string, string> = {
		BOOKS: 'หนังสือ',
		CLOTHES: 'เสื้อผ้า',
		GADGET: 'อุปกรณ์',
		FURNITURE: 'เฟอร์นิเฟอร์',
		SPORTS: 'กีฬา',
		STATIONERY: 'เครื่องเขียน',
		ELECTRONICS: 'เครื่องใช้ไฟฟ้า',
		VEHICLES: 'ยานพาหนะ',
		MUSIC: 'ดนตรี',
		OTHERS: 'อื่น ๆ'
	};

	const DEBUG_IMG = false;
	const DEFAULT_IMG =
		"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='480' viewBox='0 0 800 480'><rect width='800' height='480' fill='%23eee'/></svg>";

	function normalizeImageUrls(v: unknown): string[] {
		if (Array.isArray(v))
			return v.filter((s): s is string => typeof s === 'string' && Boolean(s.trim()));
		if (typeof v === 'string') {
			const s = v.trim();
			if (!s) return [];
			try {
				const arr = JSON.parse(s);
				if (Array.isArray(arr))
					return arr.filter(
						(x: unknown): x is string => typeof x === 'string' && Boolean(x.trim())
					);
			} catch {
				// not JSON → try comma-separated
			}
			return s
				.split(',')
				.map((x) => x.trim())
				.filter(Boolean);
		}
		return [];
	}
	function primaryUrlsFromItem(it: any): string[] {
		if (!it) return [];
		const out: string[] = [];
		out.push(...normalizeImageUrls(it?.imageUrls));
		out.push(...normalizeImageUrls(it?.images));
		for (const s of [
			it?.imageUrl,
			it?.coverUrl,
			it?.thumbnailUrl,
			it?.image,
			it?.cover,
			it?.photoUrl
		] as (string | null | undefined)[]) {
			if (typeof s === 'string' && s.trim()) out.push(s.trim());
		}
		return Array.from(new Set(out));
	}
	function sanitizeUrl(raw: string): string {
		try {
			const u = new URL(
				raw,
				typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
			);
			if (u.protocol === 'http:') u.protocol = 'https:';
			u.pathname = encodeURI(decodeURI(u.pathname));
			return u.toString();
		} catch {
			return raw;
		}
	}
	function hasTransform(url: string): boolean {
		const i = url.indexOf('/upload/');
		if (i === -1) return false;
		const first = url.slice(i + 8).split('/')[0] || '';
		return first.includes(',') || /^[a-zA-Z]_[^/]+$/.test(first);
	}
	function toThumb(url?: string | null, size = 640): string {
		if (!url) return DEFAULT_IMG;
		url = sanitizeUrl(url);
		if (!url.includes('/upload/')) return url;
		if (hasTransform(url)) return url;
		const t = `c_fill,w_${size},h_${Math.round((size * 3) / 4)},q_auto,f_auto`;
		return url.replace(/\/upload\/(v\d+\/)?/i, (_m, v) => `/upload/${t}/${v ?? ''}`);
	}

	// reactive
	let coverOrig = '';
	let coverThumb = DEFAULT_IMG;
	$: allUrls = primaryUrlsFromItem(item);
	$: coverOrig = allUrls[0] ? sanitizeUrl(allUrls[0]) : '';
	$: coverThumb = coverOrig ? toThumb(coverOrig, 640) : DEFAULT_IMG;

	let loaded = false,
		error = false;
	function onImgError(e: Event) {
		error = true;
		const img = e.currentTarget as HTMLImageElement;
		if (!img.dataset.triedOrig && coverOrig) {
			img.dataset.triedOrig = '1';
			img.src = coverOrig;
			return;
		}
		if (img.src !== DEFAULT_IMG) img.src = DEFAULT_IMG;
	}
	function onImgLoad() {
		loaded = true;
		error = false;
	}

	// UI helpers
	$: isBoosted = !!item?.boostedUntil && new Date(item!.boostedUntil!).getTime() > Date.now();
	$: status = (item?.status || '').toUpperCase();
	const STATUS_STYLE: Record<string, string> = {
		ACTIVE: 'bg-green-50 text-green-700 border-green-200',
		SOLD: 'bg-neutral-100 text-neutral-600 border-neutral-200',
		HIDDEN: 'bg-yellow-50 text-yellow-700 border-yellow-200'
	};
	const THB = (n: number | string | null | undefined) => `฿ ${Number(n ?? 0).toLocaleString()}`;
</script>

{#if !item}
	<!-- skeleton card เมื่อยังไม่มีข้อมูล -->
	<div class="block rounded-2xl border border-neutral-200/70 bg-white shadow-sm overflow-hidden">
		<div class="h-48 md:h-56 w-full bg-neutral-100 animate-pulse"></div>
		<div class="px-4 pt-3 pb-4 space-y-2">
			<div class="h-4 w-3/4 bg-neutral-200 rounded"></div>
			<div class="h-4 w-1/3 bg-neutral-200 rounded"></div>
			<div class="h-3 w-1/2 bg-neutral-100 rounded"></div>
		</div>
	</div>
{:else}
	<a
		class="group block rounded-2xl border border-neutral-200/70 bg-white shadow-sm hover:shadow-lg transition-all duration-200 ease-out hover:-translate-y-0.5 overflow-hidden"
		href={`/listing/${item.id}`}
		aria-label={item.title}
	>
		<!-- รูปสินค้า + ป้าย -->
		<div class="relative">
			<div class="h-48 md:h-56 w-full bg-neutral-100 animate-pulse" hidden={loaded}></div>

			<img
				src={coverThumb}
				alt={item.title}
				loading="lazy"
				decoding="async"
				class="h-48 md:h-56 w-full object-cover transition-transform duration-300 group-hover:scale-105"
				style="aspect-ratio: 4/3"
				on:error={onImgError}
				on:load={onImgLoad}
				sizes="(max-width: 768px) 100vw, 25vw"
			/>

			<div
				class="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent"
			></div>

			<div class="absolute left-3 top-3 flex items-center gap-2">
				{#if isBoosted}
					<span class="rounded-full bg-orange-500 text-white text-[11px] px-2 py-0.5 shadow-sm"
						>โปรโมท</span
					>
				{/if}
				{#if status}
					<span
						class={`rounded-full border text-[11px] px-2 py-0.5 backdrop-blur-sm ${STATUS_STYLE[status] || 'bg-white/90 text-neutral-700 border-neutral-200'}`}
					>
						{status}
					</span>
				{/if}
			</div>

			{#if DEBUG_IMG}
				<div
					class="absolute inset-x-0 bottom-0 text-[10px] leading-3 bg-black/60 text-white p-1 space-y-1"
				>
					<div>loaded: {String(loaded)} | error: {String(error)}</div>
					<div class="truncate">thumb: {coverThumb}</div>
					<div class="truncate">orig: {coverOrig}</div>
				</div>
			{/if}
		</div>

		<!-- เนื้อหา -->
		<div class="px-4 pt-3 pb-4">
			<div class="flex items-start gap-2">
				<h3
					class="line-clamp-2 font-semibold text-[15px] leading-snug text-neutral-900 group-hover:text-neutral-800"
				>
					{item.title}
				</h3>
				{#if item.category}
					<span
						class="ml-auto shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] bg-neutral-50 text-neutral-600"
					>
						{CAT_LABEL[item.category] ?? item.category}
					</span>
				{/if}
			</div>

			<div class="mt-2 font-extrabold text-orange-600">
				{THB(item.price)}
			</div>

			{#if item.seller?.name}
				<div class="mt-1 text-[11px] text-neutral-500">โดย {item.seller.name}</div>
			{/if}
		</div>
	</a>
{/if}

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>

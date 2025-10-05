<!-- src/routes/listings/[id]/+page.svelte -->
<script lang="ts">
	import { apiJson } from '$lib/api/client';
	import { auth as authStore, openAuth, refreshMe } from '$lib/stores/auth';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import BuyRequestModal from '$lib/components/BuyRequestModal.svelte';
	import QrBox from '$lib/components/QrBox.svelte';

	const auth = authStore;

	// ---------- Types ----------
	type Listing = {
		id: string;
		title: string;
		description: string;
		price: number;
		condition: 'NEW' | 'LIKE_NEW' | 'USED' | string;
		status: 'ACTIVE' | 'SOLD' | 'HIDDEN' | string;
		imageUrls: string[];
		category?: string;
		seller: { id: string; name: string; avatarUrl?: string | null };
		sellerId?: string;
	};

	type Offer = {
		id: string;
		status: 'REQUESTED' | 'ACCEPTED' | 'REJECTED' | 'REOFFER' | 'COMPLETED';
		meetPlace: string;
		meetTime: string;
		note?: string | null;
		rejectReason?: string | null;
		lastActor: 'BUYER' | 'SELLER';
		buyer: { id: string; name: string; avatarUrl?: string | null };
		createdAt: string;
		updatedAt: string;
		qrToken?: string;
	};

	// ---------- Labels ----------
	const CAT_LABEL: Record<string, string> = {
		BOOKS: 'หนังสือ',
		CLOTHES: 'เสื้อผ้า',
		GADGET: 'อุปกรณ์',
		FURNITURE: 'เฟอร์นิเจอร์',
		SPORTS: 'กีฬา',
		STATIONERY: 'เครื่องเขียน',
		ELECTRONICS: 'เครื่องใช้ไฟฟ้า',
		VEHICLES: 'ยานพาหนะ',
		MUSIC: 'ดนตรี',
		OTHERS: 'อื่น ๆ'
	};
	const COND_LABEL: Record<string, string> = {
		NEW: 'ใหม่',
		LIKE_NEW: 'สภาพดีมาก',
		USED: 'มือสอง'
	};

	// ถึงคิวผู้ขายก็ต่อเมื่อฝั่งล่าสุดที่กดคือ BUYER
	const myTurnSeller = (o: Offer) => o.lastActor === 'BUYER';
	// ถึงคิวผู้ซื้อก็ต่อเมื่อฝั่งล่าสุดที่กดคือ SELLER
	const myTurnBuyer = (o: Offer) => o.lastActor === 'SELLER';

	const DEFAULT_IMG =
		"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1000' height='1000' viewBox='0 0 1000 1000'><rect width='1000' height='1000' fill='%23eee'/><rect x='250' y='250' width='500' height='500' rx='24' ry='24' fill='%23d0d0d0'/><rect x='300' y='320' width='400' height='40' rx='8' ry='8' fill='%23c4c4c4'/><rect x='300' y='380' width='280' height='16' rx='6' ry='6' fill='%23cdcdcd'/></svg>";

	// ---------- Img utils (ไม่บังคับ https บน localhost) ----------
	function normalizeUrl(input?: string | null): string | null {
		if (!input) return null;
		try {
			if (input.startsWith('data:')) return input;
			const u = new URL(
				input,
				typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
			);
			const isHttpsPage =
				typeof window !== 'undefined' ? window.location.protocol === 'https:' : false;
			const isCloudinary =
				/(^|\.)cloudinary\.com$/.test(u.hostname) || /(^|\.)res\.cloudinary\.com$/.test(u.hostname);
			// กัน mixed content เฉพาะกรณีหน้าเรา https และรูปเป็น Cloudinary เท่านั้น
			if (u.protocol === 'http:' && isHttpsPage && isCloudinary) u.protocol = 'https:';
			return u.toString();
		} catch {
			return input as string;
		}
	}
	const safeUrl = (u?: string | null) => normalizeUrl(u);

	function hasTransform(url: string): boolean {
		const after = url.split('/upload/')[1] || '';
		const first = after.split('/')[0] || '';
		return first.includes(',') || /^[a-zA-Z]_[^/]+$/.test(first);
	}
	function toThumb(input?: string | null, size = 1000) {
		const url = normalizeUrl(input);
		if (!url) return DEFAULT_IMG;
		if (!url.includes('/upload/')) return url;
		if (hasTransform(url)) return url;
		const t = `c_fill,w_${size},h_${size},q_auto,f_auto`;
		return url.replace(/\/upload\/(v\d+\/)?/i, (_m, v) => `/upload/${t}/${v ?? ''}`);
	}
	function toMini(input?: string | null, size = 250) {
		const url = normalizeUrl(input);
		if (!url) return DEFAULT_IMG;
		if (!url.includes('/upload/')) return url;
		if (hasTransform(url)) return url;
		const t = `c_fill,w_${size},h_${size},q_auto,f_auto`;
		return url.replace(/\/upload\/(v\d+\/)?/i, (_m, v) => `/upload/${t}/${v ?? ''}`);
	}
	const formatDT = (s?: string) => (s ? new Date(s).toLocaleString() : '');

	// ---------- State ----------
	let listing: Listing | null = null;
	let loading = true;
	let working = false;
	let errorMsg = '';

	// image
	let coverOriginal = '';
	let coverThumb = DEFAULT_IMG;
	let activeIdx = 0;
	let showLightbox = false;

	// edit (owner)
	let edit = false;
	let fTitle = '';
	let fPrice = '';
	let fCondition: Listing['condition'] = 'USED';
	let fCategory: string = 'OTHERS';
	let fDesc = '';

	// buy modal (buyer)
	let showBuyModal = false;

	// offers (seller)
	let offers: Offer[] = [];
	let loadingOffers = false;
	let offersError = '';
	let offersLoadedFor: string | null = null; // ป้องกันโหลดซ้ำ

	// toasts + modals (no browser alert)
	type Toast = { id: number; text: string; type?: 'success' | 'error' | 'info' };
	let toasts: Toast[] = [];
	function toast(text: string, type: Toast['type'] = 'info') {
		const id = Date.now() + Math.random();
		toasts = [...toasts, { id, text, type }];
		setTimeout(() => (toasts = toasts.filter((t) => t.id !== id)), 2200);
	}
	function errText(e: any, fallback = 'ทำรายการไม่สำเร็จ') {
		const status = e?.status ?? e?.code;
		const msg = String(e?.message ?? '').toUpperCase();
		if (status === 401) return 'กรุณาเข้าสู่ระบบก่อน';
		if (status === 403) {
			if (msg.includes('NOT_YOUR_TURN') || msg.includes('WAIT_FOR_BUYER'))
				return 'รอผู้ซื้อดำเนินการก่อน';
			if (msg.includes('WAIT_FOR_SELLER')) return 'รอผู้ขายดำเนินการก่อน';
			if (msg.includes('FORBIDDEN')) return 'คุณไม่มีสิทธิ์ทำรายการนี้';
			return 'ยังไม่ถึงคิวคุณดำเนินการ';
		}
		if (msg.includes('OFFER_NOT_FOUND')) return 'ไม่พบคำขอนี้แล้ว';
		return fallback;
	}

	let showDelete = false;
	let showReject = false;
	let showReoffer = false;
	let rejectReason = '';
	let reMeetPlace = '';
	let reMeetTime = '';

	$: id = $page.params.id;
	const isOwner = () =>
		!!(
			listing &&
			$auth.user &&
			(listing.seller?.id === $auth.user.id || (listing as any).sellerId === $auth.user.id)
		);

	const isAdmin = () => $auth.user?.role === 'ADMIN';
	const canBuy = () => listing && !isOwner() && listing.status === 'ACTIVE';

	// ใช้รูปล่าสุดของผู้ขาย: ถ้าเจ้าของเพิ่งเปลี่ยนรูปใน session เดียว ให้ดึงจาก $auth ด้วย
	$: sellerAvatar = (() => {
		if (listing?.seller?.id && $auth.user?.id === listing.seller.id) {
			return safeUrl($auth.user?.avatarUrl || listing.seller?.avatarUrl || null);
		}
		return safeUrl(listing?.seller?.avatarUrl || null);
	})();

	// ---------- Loaders ----------
	async function loadListing() {
		loading = true;
		errorMsg = '';
		listing = null;
		try {
			const data = await apiJson<{ listing: Listing }>(`/api/listings/${$page.params.id}`);
			listing = data.listing;
			activeIdx = 0;
			coverOriginal = listing.imageUrls?.[0] ? normalizeUrl(listing.imageUrls[0]) || '' : '';
			coverThumb = coverOriginal ? toThumb(coverOriginal, 1000) : DEFAULT_IMG;
			fTitle = listing.title;
			fPrice = String(listing.price ?? '');
			fCondition = listing.condition as any;
			fCategory = (listing.category as string) || 'OTHERS';
			fDesc = listing.description;
		} catch (e: any) {
			errorMsg = e?.message || 'ไม่พบรายการ';
		} finally {
			loading = false;
		}
	}
	async function loadOffers() {
		if (!listing || !isOwner()) return;
		loadingOffers = true;
		offersError = '';
		try {
			const data = await apiJson<{ offers: Offer[] }>(`/api/listings/${listing.id}/offers`);
			offers = data.offers;
		} catch (e: any) {
			offersError = e?.message || 'โหลดข้อเสนอไม่สำเร็จ';
		} finally {
			loadingOffers = false;
		}
	}
	onMount(async () => {
		if (!$auth.user?.id) {
			try {
				await refreshMe();
			} catch {}
		}
		await loadListing();
		if (isOwner()) {
			offersLoadedFor = listing!.id;
			await loadOffers();
		}
	});

	$: if (
		listing &&
		$auth.user?.id &&
		isOwner() &&
		!loadingOffers &&
		offersLoadedFor !== listing.id
	) {
		offersLoadedFor = listing.id;
		loadOffers();
	}

	// ---------- Buyer flow ----------
	function openBuy() {
		if (!$auth.user) return openAuth('login');
		if (isOwner()) return toast('คุณเป็นเจ้าของประกาศนี้', 'error');
		if (listing?.status !== 'ACTIVE') return toast('ประกาศนี้ไม่ได้เปิดขาย', 'error');
		showBuyModal = true;
	}

	// ---------- Owner/Admin actions ----------
	async function markStatus(status: 'SOLD' | 'HIDDEN' | 'ACTIVE') {
		if (!listing) return;
		if (!$auth.user) return openAuth('login');
		working = true;
		try {
			const data = await apiJson<{ listing: Listing }>(`/api/listings/${listing.id}`, {
				method: 'PATCH',
				body: JSON.stringify({ status })
			});
			listing = data.listing;
			toast('อัปเดตสถานะแล้ว', 'success');
		} catch (e: any) {
			toast(e?.message || 'อัปเดตไม่สำเร็จ', 'error');
		} finally {
			working = false;
		}
	}

	function enterEdit() {
		if (!listing) return;
		edit = true;
		fTitle = listing.title;
		fPrice = String(listing.price ?? '');
		fCondition = listing.condition as any;
		fCategory = (listing.category as string) || 'OTHERS';
		fDesc = listing.description;
	}
	function cancelEdit() {
		edit = false;
	}

	async function saveEdit() {
		if (!listing) return;
		if (!$auth.user) return openAuth('login');
		const priceNum = Number(fPrice);
		if (!fTitle.trim() || !fDesc.trim() || !priceNum || priceNum <= 0) {
			return toast('กรอกข้อมูลให้ครบ (ราคา > 0)', 'error');
		}
		working = true;
		try {
			const data = await apiJson<{ listing: Listing }>(`/api/listings/${listing.id}`, {
				method: 'PATCH',
				body: JSON.stringify({
					title: fTitle.trim(),
					description: fDesc.trim(),
					price: priceNum,
					condition: fCondition,
					category: fCategory
				})
			});
			listing = data.listing;
			edit = false;
			toast('บันทึกแล้ว', 'success');
		} catch (e: any) {
			toast(e?.message || 'บันทึกไม่สำเร็จ', 'error');
		} finally {
			working = false;
		}
	}

	async function doRemove() {
		if (!listing) return;
		if (!$auth.user) return openAuth('login');
		working = true;
		try {
			await apiJson(`/api/listings/${listing.id}`, { method: 'DELETE' });
			toast('ลบประกาศแล้ว', 'success');
			goto('/');
		} catch (e: any) {
			toast(e?.message || 'ลบไม่สำเร็จ', 'error');
		} finally {
			working = false;
			showDelete = false;
		}
	}

	// ---------- Offer actions (seller) ----------
	let actionOfferId = '';
	function openReject(id: string) {
		actionOfferId = id;
		rejectReason = '';
		showReject = true;
	}
	function openReoffer(id: string) {
		actionOfferId = id;
		reMeetPlace = '';
		reMeetTime = '';
		showReoffer = true;
	}

	async function acceptOffer(id: string) {
		try {
			await apiJson(`/api/offers/${id}`, {
				method: 'PATCH',
				body: JSON.stringify({ action: 'ACCEPT' })
			});
			await loadOffers();
			toast('ยอมรับคำขอแล้ว — สร้าง QR สำเร็จ', 'success');
		} catch (e: any) {
			toast(errText(e, 'ทำรายการไม่สำเร็จ'), 'error');
		}
	}

	async function rejectOffer() {
		try {
			await apiJson(`/api/offers/${actionOfferId}`, {
				method: 'PATCH',
				body: JSON.stringify({ action: 'REJECT', reason: rejectReason || '' })
			});
			await loadOffers();
			toast('ปฏิเสธคำขอแล้ว', 'success');
			showReject = false;
		} catch (e: any) {
			toast(errText(e, 'ทำรายการไม่สำเร็จ'), 'error');
		}
	}

	async function reoffer() {
		try {
			if (!reMeetPlace || !reMeetTime) return toast('กรอกสถานที่และเวลาให้ครบ', 'error');
			await apiJson(`/api/offers/${actionOfferId}`, {
				method: 'PATCH',
				body: JSON.stringify({
					action: 'REOFFER',
					meetPlace: reMeetPlace,
					meetTime: new Date(reMeetTime).toISOString()
				})
			});
			await loadOffers();
			toast('ส่งข้อเสนอใหม่แล้ว', 'success');
			showReoffer = false;
		} catch (e: any) {
			toast(errText(e, 'ทำรายการไม่สำเร็จ'), 'error');
		}
	}

	// ---------- Img interactions ----------
	function onImgError(e: Event) {
		const img = e.currentTarget as HTMLImageElement;
		const tried = img.dataset.triedOrig === '1';
		if (!tried && coverOriginal) {
			img.dataset.triedOrig = '1';
			img.src = coverOriginal;
			return;
		}
		if (img.src !== DEFAULT_IMG) img.src = DEFAULT_IMG;
	}
	function onThumbError(e: Event) {
		const img = e.currentTarget as HTMLImageElement;
		const orig = img.getAttribute('data-orig') || '';
		const tried = img.dataset.triedOrig === '1';
		if (!tried && orig) {
			img.dataset.triedOrig = '1';
			img.src = orig;
			return;
		}
		if (img.src !== DEFAULT_IMG) img.src = DEFAULT_IMG;
	}
	function selectCover(u: string) {
		const n = normalizeUrl(u) || '';
		coverOriginal = n;
		coverThumb = toThumb(n, 1000);
	}
	function pick(idx: number) {
		if (!listing?.imageUrls?.[idx]) return;
		activeIdx = idx;
		selectCover(listing.imageUrls[idx]);
	}
	function openLightbox() {
		if (coverOriginal) showLightbox = true;
	}
	function closeLightbox() {
		showLightbox = false;
	}

	// Share / Copy
	async function shareListing() {
		const url = typeof window !== 'undefined' ? window.location.href : '';
		const text = listing?.title || 'สินค้า';
		try {
			if ((navigator as any).share) {
				await (navigator as any).share({ title: text, text, url });
			} else {
				await navigator.clipboard.writeText(url);
				toast('คัดลอกลิงก์แล้ว', 'success');
			}
		} catch {}
	}
</script>

<section class="mx-auto px-4 py-6 max-w-6xl">
	{#if loading}
		<div class="grid md:grid-cols-2 gap-6">
			<div class="aspect-square rounded-xl bg-surface-light animate-pulse" />
			<div class="space-y-3">
				<div class="h-8 w-2/3 rounded bg-surface-light animate-pulse" />
				<div class="h-24 rounded bg-surface-light animate-pulse" />
			</div>
		</div>
	{:else if !listing}
		<div class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
			{errorMsg || 'ไม่พบรายการ'}
		</div>
	{:else}
		<div class="grid md:grid-cols-2 gap-8">
			<!-- Left: gallery -->
			<div class="space-y-3">
				<div class="relative group">
					<img
						src={coverThumb}
						alt={listing.title}
						class="w-full aspect-square object-cover rounded-xl border shadow-sm"
						loading="lazy"
						decoding="async"
						sizes="(max-width: 768px) 100vw, 50vw"
						on:error={onImgError}
						on:click={openLightbox}
						aria-label="ดูภาพขนาดใหญ่"
					/>
					<button
						class="absolute right-2 bottom-2 rounded-md bg-black/50 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition"
						on:click={openLightbox}>ดูภาพใหญ่</button
					>
				</div>

				{#if listing.imageUrls?.length > 1}
					<!-- มือถือ: สไลด์แนวนอน / เดสก์ท็อป: 4 คอลัมน์ -->
					<div
						class="md:grid md:grid-cols-4 md:gap-2 overflow-x-auto md:overflow-visible no-scrollbar -mx-1 px-1"
					>
						<div class="flex md:block gap-2 md:gap-0">
							{#each listing.imageUrls as u, i (u)}
								<button
									type="button"
									class={`rounded-lg border overflow-hidden cursor-pointer relative shrink-0 w-24 h-24 md:w-auto md:h-auto ${i === activeIdx ? 'ring-2 ring-orange-500' : 'hover:border-orange-300'}`}
									on:click={() => {
										activeIdx = i;
										pick(i);
									}}
									aria-label={`ดูรูปที่ ${i + 1}`}
								>
									<img
										src={toMini(u)}
										data-orig={normalizeUrl(u) || ''}
										alt="thumb"
										class="w-24 h-24 md:w-full md:h-24 object-cover"
										loading="lazy"
										decoding="async"
										on:error={onThumbError}
									/>
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<!-- Right: details -->
			<div class="bg-white rounded-xl border shadow p-4 md:p-6 relative">
				<!-- Status chip at corner -->
				<div class="absolute right-4 top-4">
					<span
						class="rounded-full border px-2.5 py-0.5 text-xs
            {listing.status === 'ACTIVE' ? 'bg-green-50 text-green-700 border-green-200' : ''}
            {listing.status === 'SOLD' ? 'bg-neutral-100 text-neutral-600 border-neutral-200' : ''}
            {listing.status === 'HIDDEN' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : ''}"
					>
						{listing.status}
					</span>
				</div>

				{#if !edit}
					<!-- Title + chips -->
					<div class="flex items-start gap-3 pr-16">
						<h1 class="text-2xl md:text-3xl font-extrabold leading-tight">{listing.title}</h1>
						<div class="ml-auto flex items-center gap-2">
							{#if listing.category}
								<span
									class="inline-flex items-center rounded-full border px-3 py-1 text-xs bg-neutral-50 text-neutral-700"
								>
									{CAT_LABEL[listing.category] ?? listing.category}
								</span>
							{/if}
						</div>
					</div>

					<!-- Price + share -->
					<div class="mt-2 flex items-center gap-3">
						<div class="text-2xl md:text-[28px] text-orange-600 font-extrabold">
							฿ {Number(listing.price).toLocaleString()}
						</div>
						<div class="ml-auto flex items-center gap-2">
							<button
								class="rounded-lg border px-3 py-1.5 text-sm hover:bg-neutral-50"
								on:click={shareListing}
								aria-label="แชร์ประกาศ"
							>
								แชร์
							</button>
						</div>
					</div>

					<!-- Seller -->
					<div class="rounded-xl border bg-neutral-50 p-3 mt-3 flex items-center gap-3">
						{#if sellerAvatar}
							<img
								src={sellerAvatar}
								alt={listing.seller?.name
									? `รูปโปรไฟล์ของ ${listing.seller.name}`
									: 'รูปโปรไฟล์ผู้ขาย'}
								class="h-10 w-10 rounded-full object-cover border"
								on:error={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
							/>
						{:else}
							<div
								class="h-10 w-10 rounded-full bg-orange-100 text-orange-700 grid place-items-center font-bold"
							>
								{(listing.seller?.name || 'S').slice(0, 1).toUpperCase()}
							</div>
						{/if}
						<div class="leading-tight">
							<div class="text-xs text-neutral-500">ผู้ขาย</div>
							<div class="text-[15px] font-medium">{listing.seller?.name}</div>
						</div>
					</div>

					<!-- quick facts -->
					<div class="mt-4 grid grid-cols-2 gap-3 text-sm">
						<div class="rounded-lg border p-3">
							<div class="text-neutral-500">สภาพ</div>
							<div class="font-medium">
								{COND_LABEL[String(listing.condition)] ?? listing.condition}
							</div>
						</div>
						<div class="rounded-lg border p-3">
							<div class="text-neutral-500">หมวดหมู่</div>
							<div class="font-medium">
								{CAT_LABEL[listing.category ?? ''] ?? (listing.category || '—')}
							</div>
						</div>
					</div>

					<!-- Description -->
					<div class="mt-4">
						<div class="text-sm text-neutral-500 mb-1">รายละเอียด</div>
						<div class="text-[15px] leading-relaxed whitespace-pre-line">{listing.description}</div>
					</div>

					{#if canBuy()}
						<div class="sticky bottom-0 mt-5">
							<button
								class="w-full rounded-lg bg-orange-600 text-white py-2.5 font-semibold cursor-pointer hover:bg-orange-700 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
								on:click={openBuy}>ติดต่อ นัดซื้อ</button
							>
						</div>
					{/if}
				{:else}
					<!-- Edit form -->
					<div class="space-y-3">
						<div>
							<label class="block text-sm mb-1">ชื่อสินค้า</label>
							<input class="w-full rounded border px-3 py-2" bind:value={fTitle} />
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label class="block text-sm mb-1">ราคา (บาท)</label>
								<input class="w-full rounded border px-3 py-2" bind:value={fPrice} />
							</div>
							<div>
								<label class="block text-sm mb-1">สภาพ</label>
								<select class="w-full rounded border px-3 py-2" bind:value={fCondition}>
									<option value="NEW">ใหม่</option>
									<option value="USED">มือสอง</option>
								</select>
							</div>
						</div>
						<div>
							<label class="block text-sm mb-1">หมวดหมู่</label>
							<select class="w-full rounded border px-3 py-2" bind:value={fCategory}>
								{#each Object.keys(CAT_LABEL) as c}
									<option value={c}>{CAT_LABEL[c]}</option>
								{/each}
							</select>
						</div>
						<div>
							<label class="block text-sm mb-1">รายละเอียด</label>
							<textarea class="w-full rounded border px-3 py-2" rows="5" bind:value={fDesc} />
						</div>
						<div class="flex flex-wrap gap-2 pt-2">
							<button
								class="rounded px-4 py-2 bg-brand text-white disabled:opacity-60"
								on:click={saveEdit}
								disabled={working}>บันทึก</button
							>
							<button class="rounded px-4 py-2 border" on:click={cancelEdit} disabled={working}
								>ยกเลิก</button
							>
						</div>
					</div>
				{/if}

				{#if (isOwner() || isAdmin()) && !edit}
					<div class="mt-5 grid grid-cols-2 gap-2">
						<button
							class="rounded px-3 py-2 border cursor-pointer disabled:opacity-60"
							on:click={() => markStatus('SOLD')}
							disabled={working || listing.status === 'SOLD'}
						>
							ทำเครื่องหมาย: ขายแล้ว
						</button>
						<button
							class="rounded px-3 py-2 border cursor-pointer disabled:opacity-60"
							on:click={() => markStatus('HIDDEN')}
							disabled={working || listing.status === 'HIDDEN'}
						>
							ซ่อน
						</button>
						<button
							class="rounded px-3 py-2 border cursor-pointer disabled:opacity-60"
							on:click={() => markStatus('ACTIVE')}
							disabled={working || listing.status === 'ACTIVE'}
						>
							เปิดขาย
						</button>
						<button
							class="rounded px-3 py-2 border text-red-600 cursor-pointer disabled:opacity-60"
							on:click={() => (showDelete = true)}
							disabled={working}
						>
							ลบประกาศ
						</button>
					</div>
					<div class="mt-3">
						<button class="rounded px-3 py-2 border w-full" on:click={enterEdit}
							>แก้ไขรายละเอียดทั้งหมด</button
						>
					</div>
				{/if}
			</div>
		</div>

		<!-- Offers (owner) -->
		{#if isOwner() && listing}
			<div class="mt-8">
				<h2 class="text-lg font-bold mb-2">คำขอซื้อที่เข้ามา</h2>

				{#if loadingOffers}
					<div class="rounded border bg-surface-light p-3 text-sm">กำลังโหลด…</div>
				{:else if offersError}
					<div class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
						{offersError}
					</div>
				{:else if offers.length === 0}
					<div class="rounded border bg-surface-light p-3 text-sm">ยังไม่มีคำขอซื้อ</div>
				{:else}
					<div class="space-y-3">
						{#each offers as o (o.id)}
							<div class="rounded-lg border p-3 flex gap-3 sm:flex-row flex-col">
								<!-- ส่วนข้อมูลหลัก -->
								<div class="flex flex-col gap-1">
									<div class="text-sm">
										<span class="font-semibold">{o.buyer?.name || 'ผู้ซื้อ'}</span>
										<span class="ml-2 text-[12px] rounded-full border px-2 py-0.5">{o.status}</span>
									</div>
									<div class="text-[13px] text-neutral-600">
										นัดรับ:
										<span class="font-medium">{o.meetPlace}</span>
										@ <span class="font-medium">{formatDT(o.meetTime)}</span>
									</div>
									{#if o.note}
										<div class="text-[12px] text-neutral-500">โน้ตจากผู้ซื้อ: {o.note}</div>
									{/if}
									{#if o.rejectReason}
										<div class="text-[12px] text-red-600">เหตุผลปฏิเสธ: {o.rejectReason}</div>
									{/if}
								</div>

								<!-- ปุ่มกระทำ -->
								{#if o.status === 'REQUESTED' || o.status === 'REOFFER'}
									<div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 w-full">
										{#if myTurnSeller(o)}
											<div class="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
												<button
													class="w-full sm:w-auto rounded px-3 py-2 border"
													on:click={() => openReoffer(o.id)}>เสนอใหม่</button
												>
												<button
													class="w-full sm:w-auto rounded px-3 py-2 border text-red-600"
													on:click={() => openReject(o.id)}>ปฏิเสธ</button
												>
												<button
													class="w-full sm:w-auto rounded px-3 py-2 bg-brand text-white"
													on:click={() => acceptOffer(o.id)}>ยอมรับ</button
												>
											</div>
											<div class="text-[12px] text-neutral-500 md:ml-2">
												{#if o.status === 'REQUESTED'}ถึงคิวคุณตอบรับคำขอนี้{/if}
												{#if o.status === 'REOFFER'}คู่สนทนาเสนอวัน–เวลาใหม่{/if}
											</div>
										{:else}
											<div class="text-[12px] text-neutral-500">รอผู้ซื้อดำเนินการ…</div>
										{/if}
									</div>
								{/if}

								<!-- สถานะอื่น ๆ -->
								{#if o.status === 'ACCEPTED'}
									<div class="text-[12px] text-green-700">
										ยอมรับแล้ว — รอผู้ซื้อสแกน QR ในวันนัด
									</div>
								{:else if o.status === 'COMPLETED'}
									<div class="text-[12px] text-green-700">จบดีลแล้ว</div>
								{:else if o.status === 'REJECTED'}
									<div class="text-[12px] text-neutral-500">ปฏิเสธแล้ว</div>
								{/if}

								<!-- QR -->
								{#if o.status === 'ACCEPTED'}
									<div class="mt-1 w-full">
										<div class="text-[12px] text-green-700 mb-1 md:text-right">
											แสดง QR ให้ผู้ซื้อสแกน
										</div>
										<div class="w-full md:flex md:justify-end">
											<div class="w-full sm:w-auto">
												<QrBox tokenUrl={`reborn://offer/${o.id}?t=${o.qrToken}`} />
											</div>
										</div>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</section>

<!-- Lightbox -->
{#if showLightbox}
	<div
		class="fixed inset-0 z-[100] bg-black/80 grid place-items-center p-4"
		on:click={closeLightbox}
		role="dialog"
		aria-modal="true"
	>
		<img
			src={coverOriginal || coverThumb}
			alt="ภาพสินค้า"
			class="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
		/>
	</div>
{/if}

<!-- Buyer modal -->
<BuyRequestModal
	open={showBuyModal}
	listingId={listing ? listing.id : ''}
	onClose={() => (showBuyModal = false)}
	on:created={() => {
		showBuyModal = false;
		toast('ส่งคำขอซื้อแล้ว', 'success');
	}}
/>

<!-- ---------- Lightweight Modals & Toasts ---------- -->
{#if showDelete}
	<div class="fixed inset-0 z-[90] bg-black/30 overflow-y-auto">
		<div class="min-h-full flex items-center justify-center p-4">
			<div
				class="w-[min(90vw,420px)] rounded-xl bg-white p-4 border shadow-card
                  max-h-[90vh] overflow-y-auto"
			>
				<div class="text-lg font-semibold mb-2">ลบประกาศนี้?</div>
				<p class="text-sm text-neutral-600">การลบไม่สามารถย้อนกลับได้</p>
				<div class="mt-4 flex justify-end gap-2">
					<button class="rounded px-3 py-2 border" on:click={() => (showDelete = false)}
						>ยกเลิก</button
					>
					<button
						class="rounded px-3 py-2 bg-red-600 text-white"
						on:click={doRemove}
						disabled={working}>ลบ</button
					>
				</div>
			</div>
		</div>
	</div>
{/if}

{#if showReject}
	<div class="fixed inset-0 z-[90] bg-black/30 overflow-y-auto">
		<div class="min-h-full flex items-center justify-center p-4">
			<div
				class="w-[min(90vw,480px)] rounded-xl bg-white p-4 border shadow-card
                  max-h-[90vh] overflow-y-auto"
			>
				<div class="text-lg font-semibold mb-2">ปฏิเสธคำขอซื้อ</div>
				<label class="block text-sm mb-1">เหตุผล (ไม่บังคับ)</label>
				<textarea rows="4" class="w-full rounded border px-3 py-2" bind:value={rejectReason} />
				<div class="mt-4 flex justify-end gap-2">
					<button class="rounded px-3 py-2 border" on:click={() => (showReject = false)}
						>ยกเลิก</button
					>
					<button class="rounded px-3 py-2 bg-brand text-white" on:click={rejectOffer}
						>ยืนยัน</button
					>
				</div>
			</div>
		</div>
	</div>
{/if}

{#if showReoffer}
	<div class="fixed inset-0 z-[90] bg-black/30 overflow-y-auto">
		<div class="min-h-full flex items-center justify-center p-4">
			<div
				class="w-[min(90vw,520px)] rounded-xl bg-white p-4 border shadow-card
                  max-h-[90vh] overflow-y-auto"
			>
				<div class="text-lg font-semibold mb-2">เสนอวัน–สถานที่ใหม่</div>
				<div class="grid md:grid-cols-2 gap-3">
					<div>
						<label class="block text-sm mb-1">สถานที่นัด</label>
						<input class="w-full rounded border px-3 py-2" bind:value={reMeetPlace} />
					</div>
					<div>
						<label class="block text-sm mb-1">เวลานัด</label>
						<input
							type="datetime-local"
							class="w-full rounded border px-3 py-2"
							bind:value={reMeetTime}
						/>
					</div>
				</div>
				<div class="mt-4 flex justify-end gap-2">
					<button class="rounded px-3 py-2 border" on:click={() => (showReoffer = false)}
						>ยกเลิก</button
					>
					<button class="rounded px-3 py-2 bg-brand text-white" on:click={reoffer}
						>ส่งข้อเสนอใหม่</button
					>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Sticky CTA (mobile only) -->
{#if listing && canBuy()}
	<div class="md:hidden fixed bottom-0 inset-x-0 z-[80] bg-white/95 backdrop-blur border-t p-3">
		<div class="max-w-6xl mx-auto flex items-center gap-3">
			<div class="font-extrabold text-orange-600">
				฿ {Number(listing?.price || 0).toLocaleString()}
			</div>
			<button
				class="ml-auto rounded-lg bg-orange-600 text-white px-4 py-2 font-semibold hover:bg-orange-700"
				on:click={openBuy}>ติดต่อ นัดซื้อ</button
			>
		</div>
	</div>
{/if}

<!-- toasts -->
<div class="fixed bottom-4 left-1/2 -translate-x-1/2 z-[95] space-y-2">
	{#each toasts as t (t.id)}
		<div
			class="px-3 py-2 rounded-lg shadow-card border text-sm
      {t.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : ''}
      {t.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : ''}
      {t.type === 'info' ? 'bg-white border-surface text-neutral-700' : ''}"
		>
			{t.text}
		</div>
	{/each}
</div>

<style>
	/* ซ่อนแถบสกรอลล์แนวนอนของ thumbs บนมือถือ (optional) */
	.no-scrollbar::-webkit-scrollbar {
		display: none;
	}
	.no-scrollbar {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
</style>

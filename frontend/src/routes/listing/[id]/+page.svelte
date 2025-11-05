<!-- src/routes/listings/[id]/+page.svelte -->
<script lang="ts">
	import { apiJson } from '$lib/api/client';
	import { auth as authStore, openAuth, refreshMe } from '$lib/stores/auth';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import BuyRequestModal from '$lib/components/BuyRequestModal.svelte';
	import QrBox from '$lib/components/QrBox.svelte';
	import { ShareNodesSolid } from 'flowbite-svelte-icons';
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
		BOOKS: 'Books',
		CLOTHES: 'Clothes',
		GADGET: 'Gadget',
		FURNITURE: 'Furniture',
		SPORTS: 'Sports',
		STATIONERY: 'Stationery',
		ELECTRONICS: 'Electronics',
		VEHICLES: 'Vehicles',
		MUSIC: 'Music',
		OTHERS: 'Others'
	};
	const COND_LABEL: Record<string, string> = {
		NEW: 'New',
		LIKE_NEW: 'Like New',
		USED: 'Used'
	};

	// Seller's turn if last actor is BUYER
	const myTurnSeller = (o: Offer) => o.lastActor === 'BUYER';
	// Buyer's turn if last actor is SELLER
	const myTurnBuyer = (o: Offer) => o.lastActor === 'SELLER';

	const DEFAULT_IMG =
		"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1000' height='1000' viewBox='0 0 1000 1000'><rect width='1000' height='1000' fill='%23eee'/><rect x='250' y='250' width='500' height='500' rx='24' ry='24' fill='%23d0d0d0'/><rect x='300' y='320' width='400' height='40' rx='8' ry='8' fill='%23c4c4c4'/><rect x='300' y='380' width='280' height='16' rx='6' ry='6' fill='%23cdcdcd'/></svg>";

	// ---------- Img utils (no https required on localhost) ----------
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
			// Prevent mixed content only if our page is https and image is from Cloudinary
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
	let offersLoadedFor: string | null = null; // Prevent duplicate loading

	// toasts + modals (no browser alert)
	type Toast = { id: number; text: string; type?: 'success' | 'error' | 'info' };
	let toasts: Toast[] = [];
	function toast(text: string, type: Toast['type'] = 'info') {
		const id = Date.now() + Math.random();
		toasts = [...toasts, { id, text, type }];
		setTimeout(() => (toasts = toasts.filter((t) => t.id !== id)), 2200);
	}
	function errText(e: any, fallback = 'Action failed') {
		const status = e?.status ?? e?.code;
		const msg = String(e?.message ?? '').toUpperCase();
		if (status === 401) return 'Please log in first';
		if (status === 403) {
			if (msg.includes('NOT_YOUR_TURN') || msg.includes('WAIT_FOR_BUYER'))
				return 'Waiting for buyer to proceed';
			if (msg.includes('WAIT_FOR_SELLER')) return 'Waiting for seller to proceed';
			if (msg.includes('FORBIDDEN')) return 'You do not have permission for this action';
			return 'It is not your turn to proceed';
		}
		if (msg.includes('OFFER_NOT_FOUND')) return 'Offer not found';
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

	// Use latest seller avatar: if owner just changed avatar in this session, use $auth
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
			errorMsg = e?.message || 'Listing not found';
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
			offersError = e?.message || 'Failed to load offers';
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
		if (isOwner()) return toast('You are the owner of this listing', 'error');
		if (listing?.status !== 'ACTIVE') return toast('This listing is not for sale', 'error');
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
			toast('Status updated', 'success');
		} catch (e: any) {
			toast(e?.message || 'Update failed', 'error');
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
			return toast('Please fill all fields (price > 0)', 'error');
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
			toast('Saved', 'success');
		} catch (e: any) {
			toast(e?.message || 'Save failed', 'error');
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
			toast('Listing deleted', 'success');
			goto('/');
		} catch (e: any) {
			toast(e?.message || 'Delete failed', 'error');
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
			toast('Offer accepted — QR created', 'success');
		} catch (e: any) {
			toast(errText(e, 'Action failed'), 'error');
		}
	}

	async function rejectOffer() {
		try {
			await apiJson(`/api/offers/${actionOfferId}`, {
				method: 'PATCH',
				body: JSON.stringify({ action: 'REJECT', reason: rejectReason || '' })
			});
			await loadOffers();
			toast('Offer rejected', 'success');
			showReject = false;
		} catch (e: any) {
			toast(errText(e, 'Action failed'), 'error');
		}
	}

	async function reoffer() {
		try {
			if (!reMeetPlace || !reMeetTime) return toast('Please fill meeting place and time', 'error');
			await apiJson(`/api/offers/${actionOfferId}`, {
				method: 'PATCH',
				body: JSON.stringify({
					action: 'REOFFER',
					meetPlace: reMeetPlace,
					meetTime: new Date(reMeetTime).toISOString()
				})
			});
			await loadOffers();
			toast('New offer sent', 'success');
			showReoffer = false;
		} catch (e: any) {
			toast(errText(e, 'Action failed'), 'error');
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
		const text = listing?.title || 'Product';
		try {
			if ((navigator as any).share) {
				await (navigator as any).share({ title: text, text, url });
			} else {
				await navigator.clipboard.writeText(url);
				toast('Link copied', 'success');
			}
		} catch {}
	}
</script>

<!-- UI/UX: Centered card frame, light tone, use existing theme classes -->
<section class="min-h-screen flex items-center justify-center">
	<div class="w-[1280px] px-4 md:py-8">
		<div class="rounded-2xl border border-surface bg-white shadow-card p-4 md:p-6">
			{#if loading}
				<div class="grid md:grid-cols-2 gap-6">
					<div class="aspect-square rounded-xl bg-surface-light animate-pulse"></div>
					<div class="space-y-3">
						<div class="h-8 w-2/3 rounded bg-surface-light animate-pulse"></div>
						<div class="h-24 rounded bg-surface-light animate-pulse"></div>
					</div>
				</div>
			{:else if !listing}
				<div class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
					{errorMsg || 'Listing not found'}
				</div>
			{:else}
				<div class="grid gap-8 md:grid-cols-2">
					<!-- Left: gallery -->
					<div class="space-y-3">
						<div class="relative group">
							<button
								type="button"
								class="w-full aspect-square object-cover rounded-xl border border-surface shadow-card p-0 m-0 focus:outline-none"
								on:click={openLightbox}
								aria-label="View large image"
								tabindex="0"
								style="background: none;"
							>
								<img
									src={coverThumb}
									alt={listing.title}
									class="w-full aspect-square object-cover rounded-xl"
									loading="lazy"
									decoding="async"
									sizes="(max-width: 768px) 100vw, 50vw"
									on:error={onImgError}
									draggable="false"
								/>
							</button>
							<button
								class="absolute right-3 bottom-3 rounded-md bg-black/55 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition"
								on:click={openLightbox}
							>
								View large image
							</button>
						</div>

						{#if listing.imageUrls?.length > 1}
							<div
								class="overflow-x-auto md:overflow-visible no-scrollbar -mx-1 px-1"
							>
								<div class="gap-2">
									{#each listing.imageUrls as u, i (u)}
										<button
											type="button"
											class={`rounded-lg border border-surface overflow-hidden cursor-pointer relative shrink-0 w-24 h-24 md:w-auto md:h-auto ${i === activeIdx ? 'ring-2 ring-[var(--color-brand-orange)]' : 'hover:border-[var(--color-brand-orange)]/50'}`}
											on:click={() => {
												activeIdx = i;
												pick(i);
											}}
											aria-label={`View image ${i + 1}`}
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
					<div class="bg-white rounded-xl border border-surface shadow-card p-4 md:p-6 relative">
						<!-- Status chip at corner -->
						<div class="absolute right-4">
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
								<h1 class="text-3xl md:text-4xl font-extrabold leading-tight">{listing.title}</h1>
								<div class="ml-auto flex items-center gap-2">
									{#if listing.category}
										<span
											class="inline-flex items-center rounded-full border border-surface px-3 py-1 text-xs bg-neutral-50 text-neutral-700"
										>
											{CAT_LABEL[listing.category] ?? listing.category}
										</span>
									{/if}
								</div>
							</div>

							<!-- Price + share -->
							<div class="mt-2 flex items-center gap-3">
								<div class="text-[28px] md:text-[32px] text-brand font-extrabold">
									฿ {Number(listing.price).toLocaleString()}
								</div>
								<div class="ml-auto flex items-center gap-2">
									<button
										class="cursor-pointer rounded-lg border border-surface px-3 py-1.5 text-sm hover:bg-neutral-50"
										on:click={shareListing}
										aria-label="Share listing"
									>
										<ShareNodesSolid class="w-4 h-4 mr-1" />
									</button>
								</div>
							</div>

							<!-- Seller -->
							<div
								class="rounded-xl border border-surface bg-neutral-50 p-3 mt-3 flex items-center gap-3"
							>
								{#if sellerAvatar}
									<img
										src={sellerAvatar}
										alt={listing.seller?.name
											? `Profile picture of ${listing.seller.name}`
											: 'Seller profile picture'}
										class="h-10 w-10 rounded-full object-cover border"
										on:error={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
									/>
								{:else}
									<div
										class="h-10 w-10 rounded-full bg-orange-100 text-brand grid place-items-center font-bold"
									>
										{(listing.seller?.name || 'S').slice(0, 1).toUpperCase()}
									</div>
								{/if}
								<div class="leading-tight">
									<div class="text-xs text-neutral-500">Seller</div>
									<div class="text-[15px] font-medium">
										{#if listing.seller?.id}
											<a class="text-brand hover:underline" href={'/profile/' + listing.seller.id}>
												{listing.seller?.name ?? 'Seller'}
											</a>
										{:else}
											{listing.seller?.name ?? 'Seller'}
										{/if}
									</div>
								</div>
							</div>

							<!-- quick facts -->
							<div class="mt-4 grid grid-cols-2 gap-3 text-sm">
								<div class="rounded-lg border border-surface p-3">
									<div class="text-neutral-500">Condition</div>
									<div class="font-medium">
										{COND_LABEL[String(listing.condition)] ?? listing.condition}
									</div>
								</div>
								<div class="rounded-lg border border-surface p-3">
									<div class="text-neutral-500">Category</div>
									<div class="font-medium">
										{CAT_LABEL[listing.category ?? ''] ?? (listing.category || '—')}
									</div>
								</div>
							</div>

							<!-- Description -->
							<div class="mt-4">
								<div class="text-sm text-neutral-500 mb-1">Description</div>
								<div class="text-[15px] leading-relaxed whitespace-pre-line">
									{listing.description}
								</div>
							</div>

							{#if canBuy()}
								<div class="sticky bottom-0 mt-5">
									<button
										class="w-full rounded-lg bg-brand text-white py-2.5 font-semibold cursor-pointer hover:bg-brand-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-orange)]/40"
										on:click={openBuy}>Contact / Buy</button
									>
								</div>
							{/if}
						{:else}
							<!-- Edit form -->
							<div class="space-y-3">
								<div>
									<label for="product-name" class="block text-sm mb-1">Product name</label>
									<input
										id="product-name"
										class="w-full rounded border border-surface px-3 py-2"
										bind:value={fTitle}
									/>
								</div>
								<div class="grid grid-cols-2 gap-3">
									<div>
										<label for="product-price" class="block text-sm mb-1">Price (Baht)</label>
										<input
											id="product-price"
											class="w-full rounded border border-surface px-3 py-2"
											bind:value={fPrice}
										/>
									</div>
									<div>
										<label for="product-condition" class="block text-sm mb-1">Condition</label>
										<select
											id="product-condition"
											class="w-full rounded border border-surface px-3 py-2"
											bind:value={fCondition}
										>
											<option value="NEW">New</option>
											<option value="USED">Used</option>
										</select>
									</div>
								</div>
								<div>
									<label for="product-category" class="block text-sm mb-1">Category</label>
									<select
										id="product-category"
										class="w-full rounded border border-surface px-3 py-2"
										bind:value={fCategory}
									>
										{#each Object.keys(CAT_LABEL) as c}
											<option value={c}>{CAT_LABEL[c]}</option>
										{/each}
									</select>
								</div>
								<div>
									<label for="product-description" class="block text-sm mb-1">Description</label>
									<textarea
										id="product-description"
										class="w-full rounded border border-surface px-3 py-2"
										rows="5"
										bind:value={fDesc}
									></textarea>
								</div>
								<div class="flex flex-wrap gap-2 pt-2">
									<button
										class="rounded px-4 py-2 bg-brand text-white hover:bg-brand-2 transition disabled:opacity-60"
										on:click={saveEdit}
										disabled={working}>Save</button
									>
									<button
										class="rounded px-4 py-2 border border-surface hover:bg-neutral-50"
										on:click={cancelEdit}
										disabled={working}>Cancel</button
									>
								</div>
							</div>
						{/if}

						{#if (isOwner() || isAdmin()) && !edit}
							<div class="mt-5 grid grid-cols-2 gap-2">
								<button
									class="rounded px-3 py-2 border border-surface hover:bg-neutral-50 cursor-pointer disabled:opacity-60"
									on:click={() => markStatus('SOLD')}
									disabled={working || listing.status === 'SOLD'}
								>
									Mark as Sold
								</button>
								<button
									class="rounded px-3 py-2 border border-surface hover:bg-neutral-50 cursor-pointer disabled:opacity-60"
									on:click={() => markStatus('HIDDEN')}
									disabled={working || listing.status === 'HIDDEN'}
								>
									Hide
								</button>
								<button
									class="rounded px-3 py-2 border border-surface hover:bg-neutral-50 cursor-pointer disabled:opacity-60"
									on:click={() => markStatus('ACTIVE')}
									disabled={working || listing.status === 'ACTIVE'}
								>
									Activate
								</button>
								<button
									class="rounded px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-60"
									on:click={() => (showDelete = true)}
									disabled={working}
								>
									Delete Listing
								</button>
							</div>
							<div class="mt-3">
								<button
									class="cursor-pointer rounded px-3 py-2 border border-surface w-full hover:bg-neutral-50"
									on:click={enterEdit}>Edit all details</button
								>
							</div>
						{/if}
					</div>
				</div>

				<!-- Offers (owner) -->
				{#if isOwner() && listing}
					<div class="mt-8">
						<h2 class="text-lg font-bold mb-2">Incoming Purchase Requests</h2>

						{#if loadingOffers}
							<div class="rounded border border-surface bg-surface-light p-3 text-sm">Loading…</div>
						{:else if offersError}
							<div class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
								{offersError}
							</div>
						{:else if offers.length === 0}
							<div class="rounded border border-surface bg-surface-light p-3 text-sm">
								No purchase requests yet
							</div>
						{:else}
							<div class="space-y-3">
								{#each offers as o (o.id)}
									<div class="rounded-lg border border-surface p-3 flex gap-3 sm:flex-row flex-col">
										<!-- Main info -->
										<div class="flex flex-col gap-1">
											<div class="text-sm">
												<span class="font-semibold">{o.buyer?.name || 'Buyer'}</span>
												<span class="ml-2 text-[12px] rounded-full border px-2 py-0.5"
													>{o.status}</span
												>
											</div>
											<div class="text-[13px] text-neutral-600">
												Meet at:
												<span class="font-medium">{o.meetPlace}</span>
												@ <span class="font-medium">{formatDT(o.meetTime)}</span>
											</div>
											{#if o.note}
												<div class="text-[12px] text-neutral-500">Note from buyer: {o.note}</div>
											{/if}
											{#if o.rejectReason}
												<div class="text-[12px] text-red-600">
													Rejection reason: {o.rejectReason}
												</div>
											{/if}
										</div>

										<!-- Actions -->
										{#if o.status === 'REQUESTED' || o.status === 'REOFFER'}
											<div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 w-full">
												{#if myTurnSeller(o)}
													<div class="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
														<button
															class="cursor-pointer w-full sm:w-auto rounded px-3 py-2 border border-surface hover:bg-neutral-50"
															on:click={() => openReoffer(o.id)}>Counter offer</button
														>
														<button
															class="cursor-pointer w-full sm:w-auto rounded px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50"
															on:click={() => openReject(o.id)}>Reject</button
														>
														<button
															class="cursor-pointer w-full sm:w-auto rounded px-3 py-2 bg-brand text-white hover:bg-brand-2"
															on:click={() => acceptOffer(o.id)}>Accept</button
														>
													</div>
													<div class="text-[12px] text-neutral-500 md:ml-2">
														{#if o.status === 'REQUESTED'}Your turn to respond to this request{/if}
														{#if o.status === 'REOFFER'}The other party proposed a new date/time{/if}
													</div>
												{:else}
													<div class="text-[12px] text-neutral-500">
														Waiting for buyer to proceed…
													</div>
												{/if}
											</div>
										{/if}

										<!-- Other statuses -->
										{#if o.status === 'ACCEPTED'}
											<div class="text-[12px] text-green-700">
												Accepted — waiting for buyer to scan QR on meeting day
											</div>
										{:else if o.status === 'COMPLETED'}
											<div class="text-[12px] text-green-700">Deal completed</div>
										{:else if o.status === 'REJECTED'}
											<div class="text-[12px] text-neutral-500">Rejected</div>
										{/if}

										<!-- QR -->
										{#if o.status === 'ACCEPTED'}
											<div class="mt-1 w-full">
												<div class="text-[12px] text-green-700 mb-1 md:text-right">
													Show this QR to the buyer
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
		</div>
	</div>
</section>

<!-- Lightbox -->
{#if showLightbox}
	<div
		class="fixed inset-0 z-[100] bg-black/80 grid place-items-center p-4"
		role="dialog"
		aria-modal="true"
	>
		<button
			class="absolute right-4 top-4 text-white/80 hover:text-white text-2xl font-bold transition-transform hover:scale-110"
			on:click={closeLightbox}
			aria-label="Close large image"
		>
			✕
		</button>

		<img
			src={coverOriginal || coverThumb}
			alt="Product"
			class="h-screen w-screen object-contain bg-black"
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
		toast('Purchase request sent', 'success');
	}}
/>

<!-- ---------- Lightweight Modals & Toasts ---------- -->
{#if showDelete}
	<div class="fixed inset-0 z-[90] bg-black/30 overflow-y-auto">
		<div class="min-h-full flex items-center justify-center p-4">
			<div
				class="w-[min(90vw,420px)] rounded-xl bg-white p-4 border border-surface shadow-card
				  max-h-[90vh] overflow-y-auto"
			>
				<div class="text-lg font-semibold mb-2">Delete this listing?</div>
				<p class="text-sm text-neutral-600">This action cannot be undone</p>
				<div class="mt-4 flex justify-end gap-2">
					<button
						class="rounded px-3 py-2 border border-surface hover:bg-neutral-50"
						on:click={() => (showDelete = false)}>Cancel</button
					>
					<button
						class="rounded px-3 py-2 bg-red-600 text-white hover:bg-red-700"
						on:click={doRemove}
						disabled={working}>Delete</button
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
				class="w-[min(90vw,480px)] rounded-xl bg-white p-4 border border-surface shadow-card
				  max-h-[90vh] overflow-y-auto"
			>
				<div class="text-lg font-semibold mb-2">Reject purchase request</div>
				<label for="reject-reason" class="block text-sm mb-1">Reason (optional)</label>
				<textarea
					id="reject-reason"
					rows="4"
					class="w-full rounded border border-surface px-3 py-2"
					bind:value={rejectReason}
				></textarea>
				<div class="mt-4 flex justify-end gap-2">
					<button
						class="rounded px-3 py-2 border border-surface hover:bg-neutral-50"
						on:click={() => (showReject = false)}>Cancel</button
					>
					<button
						class="rounded px-3 py-2 bg-brand text-white hover:bg-brand-2"
						on:click={rejectOffer}>Confirm</button
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
				class="w-[min(90vw,520px)] rounded-xl bg-white p-4 border border-surface shadow-card
				  max-h-[90vh] overflow-y-auto"
			>
				<div class="text-lg font-semibold mb-2">Propose new date/place</div>
				<div class="grid md:grid-cols-2 gap-3">
					<div>
						<label for="re-meet-place" class="block text-sm mb-1">Meeting place</label>
						<input
							id="re-meet-place"
							class="w-full rounded border border-surface px-3 py-2"
							bind:value={reMeetPlace}
						/>
					</div>
					<div>
						<label for="re-meet-time" class="block text-sm mb-1">Meeting time</label>
						<input
							id="re-meet-time"
							type="datetime-local"
							class="w-full rounded border border-surface px-3 py-2"
							bind:value={reMeetTime}
						/>
					</div>
				</div>
				<div class="mt-4 flex justify-end gap-2">
					<button
						class="rounded px-3 py-2 border border-surface hover:bg-neutral-50"
						on:click={() => (showReoffer = false)}>Cancel</button
					>
					<button class="rounded px-3 py-2 bg-brand text-white hover:bg-brand-2" on:click={reoffer}
						>Send new offer</button
					>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Sticky CTA (mobile only) -->
{#if listing && canBuy()}
	<div
		class="md:hidden fixed bottom-0 inset-x-0 z-[80] bg-white/95 backdrop-blur border-t border-surface p-3"
	>
		<div class="max-w-6xl mx-auto flex items-center gap-3">
			<div class="font-extrabold text-brand">
				฿ {Number(listing?.price || 0).toLocaleString()}
			</div>
			<button
				class="ml-auto rounded-lg bg-brand text-white px-4 py-2 font-semibold hover:bg-brand-2"
				on:click={openBuy}>Contact / Buy</button
			>
		</div>
	</div>
{/if}

<!-- toasts -->
<div class="fixed bottom-4 left-1/2 -translate-x-1/2 z-[95] space-y-2">
	{#each toasts as t (t.id)}
		<div
			class="px-3 py-2 rounded-lg shadow-card border border-surface text-sm
	  {t.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : ''}
	  {t.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : ''}
	  {t.type === 'info' ? 'bg-white text-neutral-700' : ''}"
		>
			{t.text}
		</div>
	{/each}
</div>

<style>
	/* Hide horizontal scrollbar for thumbs on mobile (optional) */
	.no-scrollbar::-webkit-scrollbar {
		display: none;
	}
	.no-scrollbar {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
</style>

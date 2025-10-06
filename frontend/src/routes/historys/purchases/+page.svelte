<!-- src/routes/account/purchases/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { apiJson } from '$lib/api/client';

  type Item = {
    id: string;
    updatedAt: string;
    listing: { id: string; title: string; price: number; imageUrls: string[]; status: string };
    seller: { id: string; name: string };
    meetPlace: string;
    meetTime: string;
  };

  let items: Item[] = [];
  let loading = true;
  let err = '';

  onMount(load);

  async function load() {
    loading = true;
    err = '';
    try {
      const data = await apiJson<{ items: Item[] }>('/api/history/purchases');
      items = data.items ?? [];
    } catch (e: any) {
      err = e?.message ?? 'Failed to load';
    } finally {
      loading = false;
    }
  }

  const THB = (n: number) => `฿ ${Number(n).toLocaleString()}`;

  // ---- image helpers (Cloudinary-safe thumb + fallback) ----
  const DEFAULT_IMG =
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><rect width='200' height='200' fill='%23f1f1f1'/><rect x='40' y='40' width='120' height='120' rx='12' ry='12' fill='%23dedede'/></svg>";

  function ensureHttps(url: string): string {
    try {
      const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
      if (u.protocol === 'http:') u.protocol = 'https:';
      return u.toString();
    } catch {
      return url;
    }
  }
  function hasTransform(url: string): boolean {
    const after = url.split('/upload/')[1] || '';
    const first = after.split('/')[0] || '';
    return first.includes(',') || /^[a-zA-Z]_[^/]+$/.test(first);
  }
  function toMini(url?: string | null, size = 300) {
    if (!url) return DEFAULT_IMG;
    url = ensureHttps(url);
    if (!url.includes('/upload/')) return url;
    if (hasTransform(url)) return url;
    const t = `c_fill,w_${size},h_${size},q_auto,f_auto`;
    return url.replace(/\/upload\/(v\d+\/)?/i, (_m, v) => `/upload/${t}/${v ?? ''}`);
  }
  function onThumbError(e: Event) {
    const img = e.currentTarget as HTMLImageElement;
    if (img.src !== DEFAULT_IMG) img.src = DEFAULT_IMG;
  }

  // ---- status badge style ----
  function statusClass(s: string) {
    switch (s?.toUpperCase()) {
      case 'ACTIVE':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'SOLD':
        return 'border-neutral-200 bg-neutral-50 text-neutral-700';
      case 'HIDDEN':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      default:
        return 'border-neutral-200 bg-neutral-50 text-neutral-600';
    }
  }
</script>

<section class="mx-auto max-w-5xl px-4 py-6 space-y-4">
  <div class="flex items-center justify-between bg-white border border-surface p-4 rounded-xl">
    <div >
      <h1 class="text-2xl font-bold">Purchase History</h1>
      <p class="text-sm text-neutral-500">All deals you have made in the system</p>
    </div>
    <button
      class="cursor-pointer rounded-full border border-surface px-4 py-2 text-sm hover:bg-neutral-50"
      on:click={load}
      disabled={loading}
    >
      {loading ? 'Loading…' : 'Refresh'}
    </button>
  </div>

  {#if loading}
    <!-- Skeleton grid -->
    <div class="grid gap-3 sm:grid-cols-2">
      {#each Array(6) as _}
        <div class="rounded-xl border border-surface bg-white p-3 flex gap-3">
          <div class="h-20 w-20 rounded-lg bg-neutral-200 animate-pulse"></div>
          <div class="flex-1 space-y-2">
            <div class="h-4 w-3/4 bg-neutral-200 rounded animate-pulse"></div>
            <div class="h-3 w-1/2 bg-neutral-200 rounded animate-pulse"></div>
            <div class="h-3 w-2/3 bg-neutral-200 rounded animate-pulse"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if err}
    <div class="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 text-sm flex items-start justify-between gap-3">
      <span>{err}</span>
      <button class="cursor-pointer rounded border px-3 py-1 text-sm" on:click={load}>Try Again</button>
    </div>
  {:else if items.length === 0}
    <!-- Empty state -->
    <div class="rounded-xl border border-dashed border-surface bg-white p-10 text-center space-y-2">
      <div class="text-lg font-semibold">No purchase history yet</div>
      <p class="text-sm text-neutral-500">Start browsing products from the homepage</p>
      <a
        href="/"
        class="inline-flex items-center gap-2 rounded-full bg-brand text-white px-4 py-2 text-sm hover:bg-brand-2 transition"
      >
        Go to Homepage
      </a>
    </div>
  {:else}
    <!-- List -->
    <ul class="space-y-3">
      {#each items as it}
        <li class="rounded-xl border border-surface bg-white p-3 sm:p-4">
          <div class="flex gap-3">
            <a href={`/listing/${it.listing.id}`} class="shrink-0">
              <img
                src={toMini(it.listing.imageUrls?.[0])}
                alt={it.listing.title}
                class="h-20 w-20 sm:h-24 sm:w-24 object-cover rounded-lg border"
                referrerpolicy="no-referrer"
                loading="lazy"
                decoding="async"
                on:error={onThumbError}
              />
            </a>

            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap items-start gap-2">
                <a href={`/listing/${it.listing.id}`} class="font-semibold hover:underline truncate">
                  {it.listing.title}
                </a>
                <span class={"ml-auto inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] " + statusClass(it.listing.status)}>
                  {it.listing.status}
                </span>
              </div>

              <div class="mt-1 text-[15px] font-bold text-brand">{THB(it.listing.price)}</div>

              <div class="mt-1 text-sm text-neutral-600">
                Seller: <span class="font-medium">{it.seller?.name}</span>
                <span class="mx-2">•</span>
                Meet at: <span class="font-medium">{it.meetPlace}</span>
              </div>
              <div class="text-xs text-neutral-500">
                Time: {new Date(it.meetTime).toLocaleString()}
              </div>

              <div class="mt-2 flex items-center justify-between gap-2">
                <div class="text-[11px] text-neutral-400">Updated: {new Date(it.updatedAt).toLocaleString()}</div>
                <a
                  href={`/offers/${it.id}`}
                  class="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs hover:bg-neutral-50"
                >
                  View Deal Details
                </a>
              </div>
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  /* Prevent long product names from overflowing */
  a.truncate { max-width: 48ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>

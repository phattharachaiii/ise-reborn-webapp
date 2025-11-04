<!-- src/routes/offers/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { apiJson } from '$lib/api/client';
  import { goto } from '$app/navigation';

  type OfferLite = {
    id: string;
    status: 'REQUESTED' | 'ACCEPTED' | 'REJECTED' | 'REOFFER' | 'COMPLETED' | 'CANCELLED';
    meetPlace: string;
    meetTime: string;
    note?: string | null;
    rejectReason?: string | null;
    lastActor: 'BUYER' | 'SELLER';
    updatedAt: string;
    myRole: 'BUYER' | 'SELLER';
    qrToken?: string | null;
    listing: { id: string; title: string; price: number; imageUrls: string[]; status: string };
    counterpart: { id: string; name: string; avatarUrl?: string | null };
  };

  let loading = true, error = '';
  let items: OfferLite[] = [];

  type RoleTab = 'all' | 'buyer' | 'seller';
  let role: RoleTab = 'all';
  let status = '';
  let q = '';

  // ----- UI helpers -----
  const STATUS_LABEL: Record<string, string> = {
    REQUESTED: 'WAITING',
    REOFFER: 'RE-OFFER',
    ACCEPTED: 'ACCEPTED',
    COMPLETED: 'COMPLETED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED'
  };

  const statusBadge = (s: OfferLite['status']) => {
    switch (s) {
      case 'REQUESTED':
      case 'REOFFER':   return 'bg-surface-light text-text-base border-surface';
      case 'ACCEPTED':  return 'bg-green-50 text-green-700 border-green-200';
      case 'COMPLETED': return 'bg-brand/10 text-brand border-surface';
      case 'REJECTED':  return 'bg-red-50 text-red-700 border-red-200';
      case 'CANCELLED': return 'bg-neutral-100 text-neutral-600 border-surface';
      default:          return 'bg-surface-light text-text-base border-surface';
    }
  };

  const tabClass = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${
      active ? 'bg-surface-light cursor-default pointer-events-none'
             : 'cursor-pointer hover:bg-surface-light'
    }`;

  const THB = (n: number) => '฿ ' + Number(n || 0).toLocaleString();
  const formatDT = (s?: string) => (s ? new Date(s).toLocaleString() : '');

  // ----- fetch logic -----
  // ใช้ตัวกันชน reqId แทน abort race; เรียกโหลดเฉพาะ onMount/เปลี่ยนฟิลเตอร์/ค้นหา
  let reqId = 0;
  async function load() {
    loading = true; error = '';
    const my = ++reqId;

    try {
      const qs = new URLSearchParams();
      if (role !== 'all') qs.set('role', role);
      if (status) qs.set('status', status);
      if (q.trim()) qs.set('q', q.trim());
      const qsStr = qs.toString();
      const url = `/api/offers/mine${qsStr ? `?${qsStr}` : ''}`;

      const data = await apiJson<{ items: OfferLite[] }>(url);
      if (my !== reqId) return; // มีรอบใหม่กว่าแล้ว
      items = data.items ?? [];
    } catch (e: any) {
      if (my !== reqId) return;
      error = e?.message ?? 'Failed to load offers';
      items = [];
    } finally {
      if (my === reqId) loading = false;
    }
  }

  // sync query string ใน URL (ไม่ยิงโหลดอัตโนมัติ)
  function syncUrl() {
    const sp = new URLSearchParams();
    if (role !== 'all') sp.set('role', role);
    if (status) sp.set('status', status);
    if (q.trim()) sp.set('q', q.trim());
    const next = sp.toString() ? `/offers?${sp.toString()}` : '/offers';
    history.replaceState(null, '', next);
  }

  // init จาก URL แล้วโหลดครั้งเดียว
  onMount(() => {
    const sp = new URLSearchParams($page.url.search);
    const r = sp.get('role'); const s = sp.get('status'); const qq = sp.get('q');
    if (r === 'buyer' || r === 'seller' || r === 'all') role = r;
    if (s) status = s;
    if (qq) q = qq;
    load();
  });

  // handlers (เปลี่ยนฟิลเตอร์/ค้นหาแล้วค่อยโหลด)
  function setRole(next: RoleTab) {
    if (role === next) return;
    role = next;
    syncUrl();
    load();
  }
  function onStatusChange(e: Event) {
    status = (e.currentTarget as HTMLSelectElement).value;
    syncUrl();
    load();
  }
  function onSearchClick() {
    syncUrl();
    load();
  }
  function onSearchKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); onSearchClick(); }
  }

  function openOffer(id: string) { goto(`/offers/${id}`); }
  function openListing(id: string) { goto(`/listings/${id}`); }
</script>

<section class="mx-auto max-w-6xl px-4 py-6 space-y-4">
  <!-- Header -->
  <div class="flex items-center justify-between gap-3">
    <div>
      <h1 class="text-2xl font-bold">My Offers</h1>
      <p class="text-sm text-neutral-600">All offers as both buyer and seller</p>
    </div>
  </div>

  <!-- Filters -->
  <div class="rounded-xl border border-surface bg-surface-white p-3 md:p-4 space-y-3 shadow-head">
    <div class="flex flex-wrap items-center gap-2">
      <!-- role tabs -->
      <div class="inline-flex rounded-lg border border-surface p-1 bg-surface-white shadow-card/0">
        <button class={tabClass(role === 'all')}    aria-pressed={role === 'all'}    on:click={() => setRole('all')}>All</button>
        <button class={tabClass(role === 'buyer')}  aria-pressed={role === 'buyer'}  on:click={() => setRole('buyer')}>Buyer</button>
        <button class={tabClass(role === 'seller')} aria-pressed={role === 'seller'} on:click={() => setRole('seller')}>Seller</button>
      </div>

      <!-- status select -->
      <select
        class="rounded border border-surface px-3 py-1.5 text-sm bg-surface-white focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
        bind:value={status}
        on:change={onStatusChange}
        aria-label="Filter by status"
      >
        <option value="">ALL</option>
        <option value="REQUESTED">WAITING</option>
        <option value="REOFFER">RE-OFFER</option>
        <option value="ACCEPTED">ACCEPTED</option>
        <option value="COMPLETED">COMPLETED</option>
        <option value="REJECTED">REJECTED</option>
        <option value="CANCELLED">CANCELLED</option>
      </select>

      <!-- search -->
      <div class="flex-1 min-w-[160px] flex items-center gap-2">
        <input
          class="flex-1 rounded border border-surface px-3 py-1.5 text-sm bg-surface-white focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
          placeholder="Search by product/counterpart/location"
          bind:value={q}
          on:keydown={onSearchKeydown}
        />
        <button
          class="rounded border border-surface px-3 py-1.5 text-sm hover:bg-surface-light"
          on:click={onSearchClick}
        >
          Search
        </button>
      </div>
    </div>
  </div>

  <!-- List -->
  {#if loading}
    <div class="grid gap-3">
      {#each Array(6) as _}
        <div class="rounded-lg border border-surface p-3 bg-surface-white shadow-card">
          <div class="h-5 w-1/3 bg-surface-light rounded mb-2 animate-pulse"></div>
          <div class="h-4 w-1/2 bg-surface-light rounded animate-pulse"></div>
        </div>
      {/each}
    </div>
  {:else if error}
    <div class="rounded border border-red-200 bg-red-50 p-3 text-red-700 text-sm">{error}</div>
  {:else if items.length === 0}
    <div class="rounded-xl border border-dashed border-surface bg-surface-white p-8 text-center shadow-card">
      <div class="text-lg font-semibold">No offers yet</div>
      <div class="text-sm text-neutral-600">Offers will appear here when you start buying or selling</div>
    </div>
  {:else}
    <div class="space-y-3">
      {#each items as o (o.id)}
        <article class="rounded-lg border border-surface p-3 bg-surface-white flex flex-col gap-3 shadow-card">
          <!-- Top row -->
          <div class="flex items-start gap-2">
            <div class="font-semibold leading-snug line-clamp-2">{o.listing.title}</div>
            <span class={`ml-auto inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${statusBadge(o.status)}`}>
              {STATUS_LABEL[o.status] ?? o.status}
            </span>
          </div>

          <!-- Details -->
          <div class="grid sm:grid-cols-2 gap-2 text-sm">
            <div>
              <div class="text-neutral-500">Counterpart ({o.myRole === 'BUYER' ? 'Seller' : 'Buyer'})</div>
              <div class="font-medium">{o.counterpart?.name}</div>
            </div>
            <div>
              <div class="text-neutral-500">Price</div>
              <div class="font-medium text-brand">{THB(o.listing.price)}</div>
            </div>
            <div>
              <div class="text-neutral-500">Meeting place</div>
              <div class="font-medium">{o.meetPlace}</div>
            </div>
            <div>
              <div class="text-neutral-500">Date & Time</div>
              <div class="font-medium">{formatDT(o.meetTime)}</div>
            </div>
          </div>

          {#if o.note}
            <div class="text-[12px] text-neutral-600">Note: {o.note}</div>
          {/if}
          {#if o.rejectReason}
            <div class="text-[12px] text-red-600">Rejection reason: {o.rejectReason}</div>
          {/if}

          <div class="flex flex-wrap gap-2 pt-1">
            <button
              class="cursor-pointer rounded px-3 py-1.5 bg-brand border border-surface text-sm text-white font-semibold hover:bg-brand-h"
              on:click={() => openOffer(o.id)}
            >
              Enter
            </button>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</section>

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }
</style>

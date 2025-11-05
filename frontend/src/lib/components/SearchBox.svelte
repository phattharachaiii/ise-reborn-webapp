<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  let q = '';
  let inputEl: HTMLInputElement | null = null;

  // เก็บค่า search ปัจจุบัน เพื่อ sync q เฉพาะตอน URL เปลี่ยน
  let lastSearch = '';

  onMount(() => {
    q = $page.url.searchParams.get('q') || '';
    lastSearch = $page.url.search;
    const onKey = (ev: KeyboardEvent) => {
      if (
        ev.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        ev.preventDefault();
        inputEl?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // อัปเดต q เมื่อ URL (query string) เปลี่ยนเท่านั้น
  $: if ($page.url.search !== lastSearch) {
    lastSearch = $page.url.search;
    q = $page.url.searchParams.get('q') || '';
  }

  async function submit(e?: Event) {
    e?.preventDefault();
    const qq = q.trim();
    const target = qq
      ? `/search?q=${encodeURIComponent(qq)}&_ts=${Date.now()}`
      : `/search?_ts=${Date.now()}`;
    await goto(target, { invalidateAll: true });
  }

  async function clearAndRefresh() {
    q = '';
    await goto('/search?_ts=' + Date.now(), { invalidateAll: true });
    inputEl?.focus();
  }
</script>

<form role="search" class="w-full" on:submit|preventDefault={submit}>
  <div class="relative">
    <input
      bind:this={inputEl}
      type="search"
      class="w-full rounded-lg border border-surface bg-white px-3 py-2 pr-16 outline-none focus:ring-2 focus:ring-[var(--color-brand-orange)]/30"
      placeholder="Search items… (press / to focus)"
      bind:value={q}
      autocomplete="off"
      on:keydown={(e) => { if (e.key === 'Escape') { clearAndRefresh(); } }}
    />
    <div class="absolute right-1.5 top-1.5 flex gap-1">
      {#if q}
        <button
          type="button"
          class="px-2 py-1 text-xs rounded border hover:bg-neutral-50 cursor-pointer"
          on:click={clearAndRefresh}
          aria-label="Clear">Clear</button>
      {/if}
      <button
        type="submit"
        class="px-3 py-1.5 text-sm rounded bg-brand text-white hover:bg-brand-2 cursor-pointer"
        aria-label="Search">Search</button>
    </div>
  </div>
</form>

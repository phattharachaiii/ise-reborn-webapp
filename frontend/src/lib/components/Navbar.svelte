<script lang="ts">
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { onMount, onDestroy } from 'svelte';
	import { auth, openAuth, clearAuth } from '$lib/stores/auth';
	import { withAvatarBuster } from '$lib/utils/avatar';
	import NotificationsBell from './NotificationsBell.svelte';
	import SearchBox from '$lib/components/SearchBox.svelte';
	$: user = $auth.user;
	$: pathname = $page.url.pathname;
	$: isPost = pathname.startsWith('/post');

	let avatarBroken = false;
	function onAvatarError() {
		avatarBroken = true;
	}

	let openMenu = false;
	let menuEl: HTMLDivElement | null = null;
	function toggleMenu() {
		openMenu = !openMenu;
	}
	function closeMenu() {
		openMenu = false;
	}
	function handleDocClick(e: MouseEvent) {
		if (openMenu && menuEl && !menuEl.contains(e.target as Node)) closeMenu();
	}
	function handleDocKey(e: KeyboardEvent) {
		if (e.key === 'Escape') closeMenu();
	}
	onMount(() => {
		if (!browser) return;
		document.addEventListener('click', handleDocClick, true);
		document.addEventListener('keydown', handleDocKey, true);
	});
	onDestroy(() => {
		if (!browser) return;
		document.removeEventListener('click', handleDocClick, true);
		document.removeEventListener('keydown', handleDocKey, true);
	});

	function goLogin() {
		openAuth('login');
	}
	function goRegister() {
		openAuth('register');
	}

	//  Call logout API + clear store/LS
	async function handleLogout() {
		try {
			await fetch((import.meta as any).env.PUBLIC_BACKEND_ORIGIN + '/api/auth/logout', {
				method: 'POST',
				credentials: 'include'
			});
		} catch {
			/* ignore */
		}
		clearAuth();
	}
</script>

<header class="bg-surface-white shadow-head border-b border-surface sticky top-0 z-[80]">
	<div class="mx-auto px-4 py-3 flex items-center justify-between gap-3">
		<!-- Left: Logo -->
		<a href="/" class="text-2xl ml-4 md:text-3xl font-bold text-brand shrink-0">REBORN</a>

		<!-- Center: Search (hidden on /post) -->
		{#if !isPost}
			<div class="flex-1 max-w-xl hidden md:block">
				<SearchBox />
			</div>
		{/if}

		<!-- Right: Actions -->
		<div class="flex items-center gap-4 mr-4 md:mr-4">
			{#if isPost}
				{#if user}
					<a
						href="/mylists"
						class="inline-flex items-center justify-center h-10 px-4 rounded-full text-sm font-medium border border-[color:var(--color-brand-orange)] text-brand hover:bg-orange-50"
						>My Items</a
					>
					<NotificationsBell />

					<!-- Profile dropdown -->
					<div class="relative" bind:this={menuEl}>
						<button
							type="button"
							aria-label="Profile menu"
							aria-haspopup="menu"
							aria-expanded={openMenu}
							on:click={toggleMenu}
							class="relative grid h-10 w-10 place-items-center rounded-full border hover:bg-neutral-50
					 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 cursor-pointer overflow-hidden"
						>
							{#if browser && user?.avatarUrl && !avatarBroken}
								<img
									src={withAvatarBuster(
										user.avatarUrl,
										user?.avatarUpdatedAt ?? user?.updatedAt ?? Date.now()
									)}
									alt={user?.name ?? 'avatar'}
									class="h-full w-full rounded-full object-cover"
									loading="lazy"
									referrerpolicy="no-referrer"
									on:error={onAvatarError}
								/>
							{:else}
								<div
									class="h-full w-full rounded-full grid place-items-center text-xs font-semibold text-neutral-700 bg-white-200"
								>
									{(user?.name ?? 'U')[0]?.toUpperCase()}
								</div>
							{/if}
						</button>

						{#if openMenu}
							<div
								role="menu"
								tabindex="-1"
								class="absolute right-0 mt-2 w-48 rounded-lg border bg-white shadow-lg p-1 text-sm"
							>
								<a
									href="/settings/profile"
									role="menuitem"
									class="block rounded px-3 py-2 hover:bg-neutral-100"
									on:click={() => (openMenu = false)}
								>
									My Profile
								</a>
								<a
									href="/mylists"
									role="menuitem"
									class="block rounded px-3 py-2 hover:bg-neutral-100"
									on:click={() => (openMenu = false)}
								>
									My Items
								</a>

								<hr class="my-1 border-neutral-200" />

								<a
									href="/historys/purchases"
									role="menuitem"
									class="block rounded px-3 py-2 hover:bg-neutral-100"
									on:click={() => (openMenu = false)}
								>
									Purchase History
								</a>
								<a
									href="/historys/sales"
									role="menuitem"
									class="block rounded px-3 py-2 hover:bg-neutral-100"
									on:click={() => (openMenu = false)}
								>
									Sales History
								</a>
								<a
									href="/offers"
									role="menuitem"
									class="block rounded px-3 py-2 hover:bg-neutral-100"
									on:click={() => (openMenu = false)}
								>
									View All Offers
								</a>
								{#if user?.role === 'ADMIN'}
									<a
										href="/admin/users"
										role="menuitem"
										class="block rounded px-3 py-2 hover:bg-neutral-100"
										on:click={() => (openMenu = false)}
									>
										Admin (User Management)
									</a>
								{/if}
								<hr class="my-1 border-neutral-200" />

								<hr class="my-1 border-neutral-200" />

								<button
									type="button"
									role="menuitem"
									class="w-full text-left rounded px-3 py-2 hover:bg-neutral-100 cursor-pointer"
									on:click={() => {
										openMenu = false;
										handleLogout();
									}}
								>
									Log Out
								</button>
							</div>
						{/if}
					</div>
				{:else}
					<!-- Not logged in (on /post page) -->
					<button
						type="button"
						on:click={goLogin}
						class="inline-flex items-center justify-center h-10 px-4 rounded-full text-sm font-medium border border-[color:var(--color-brand-orange)] bg-transparent text-brand hover:bg-orange-50 transition cursor-pointer"
					>
						Log In
					</button>
					<button
						type="button"
						on:click={goRegister}
						class="inline-flex items-center justify-center h-10 px-4 rounded-full text-sm font-medium border border-[color:var(--color-brand-orange)] bg-brand text-white hover:bg-brand-2 transition cursor-pointer"
					>
						Register
					</button>
				{/if}
			{:else if user}
				<!-- General mode + logged in -->
				<div class="flex gap-6">
					<NotificationsBell />
					<div class="relative" bind:this={menuEl}>
						<button
							type="button"
							aria-label="Profile menu"
							aria-haspopup="menu"
							aria-expanded={openMenu}
							on:click={toggleMenu}
							class="relative grid h-10 w-10 place-items-center rounded-full border hover:bg-neutral-50
					 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 cursor-pointer overflow-hidden"
						>
							{#if browser && user?.avatarUrl && !avatarBroken}
								<img
									src={withAvatarBuster(
										user.avatarUrl,
										user?.avatarUpdatedAt ?? user?.updatedAt ?? Date.now()
									)}
									alt={user?.name ?? 'avatar'}
									class="h-full w-full rounded-full object-cover"
									loading="lazy"
									referrerpolicy="no-referrer"
									on:error={onAvatarError}
								/>
							{:else}
								<div
									class="h-full w-full rounded-full grid place-items-center text-xs font-semibold text-neutral-700 bg-whitet"
								>
									{(user?.name ?? 'U')[0]?.toUpperCase()}
								</div>
							{/if}
						</button>

						{#if openMenu}
							<div
								role="menu"
								tabindex="-1"
								class="absolute right-0 top-full mt-2 w-48 rounded-lg border bg-white shadow-lg p-1 text-sm z-50"
							>
								<div class="px-3 py-2 text-[12px] text-neutral-500">
									Hello, <span class="font-medium">{user?.name || 'User'}</span>
								</div>
								<div class="px-3 py-2 text-[12px] text-neutral-500">
									{user?.email || '—'}
								</div>
								<hr class="my-1 border-neutral-200" />

								<a
									href="/settings/profile"
									role="menuitem"
									class="block rounded px-3 py-2 hover:bg-neutral-100"
									on:click={() => (openMenu = false)}
								>
									My Profile
								</a>
								<a
									href="/mylists"
									role="menuitem"
									class="block rounded px-3 py-2 hover:bg-neutral-100"
									on:click={() => (openMenu = false)}
								>
									My Items
								</a>

								<hr class="my-1 border-neutral-200" />

								<a
									href="/historys/purchases"
									role="menuitem"
									class="block rounded px-3 py-2 hover:bg-neutral-100"
									on:click={() => (openMenu = false)}
								>
									Purchase History
								</a>
								<a
									href="/historys/sales"
									role="menuitem"
									class="block rounded px-3 py-2 hover:bg-neutral-100"
									on:click={() => (openMenu = false)}
								>
									Sales History
								</a>
								<a
									href="/offers"
									role="menuitem"
									class="block rounded px-3 py-2 hover:bg-neutral-100"
									on:click={() => (openMenu = false)}
								>
									View All Offers
								</a>
								{#if user?.role === 'ADMIN'}
									<a
										href="/admin/users"
										role="menuitem"
										class="block rounded px-3 py-2 hover:bg-neutral-100"
										on:click={() => (openMenu = false)}
									>
										Admin (User Management)
									</a>
								{/if}
								<hr class="my-1 border-neutral-200" />

								<hr class="my-1 border-neutral-200" />

								<button
									type="button"
									role="menuitem"
									class="w-full text-left rounded px-3 py-2 hover:bg-neutral-100 cursor-pointer"
									on:click={() => {
										openMenu = false;
										handleLogout();
									}}
								>
									Log Out
								</button>
							</div>
						{/if}
					</div>
				</div>
			{:else}
				<!-- ✅ General mode + not logged in -->
				<button
					type="button"
					on:click={goLogin}
					class="inline-flex items-center justify-center h-10 px-4 rounded-full text-sm font-medium border border-[color:var(--color-brand-orange)] bg-transparent text-brand hover:bg-orange-50 transition cursor-pointer"
				>
					Log In
				</button>
				<button
					type="button"
					on:click={goRegister}
					class="inline-flex items-center justify-center h-10 px-4 rounded-full text-sm font-medium border border-[color:var(--color-brand-orange)] bg-brand text-white hover:bg-brand-2 transition cursor-pointer"
				>
					Register
				</button>
			{/if}
		</div>
	</div>
</header>

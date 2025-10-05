<!-- src/routes/+layout.svelte -->
<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import AuthModal from '$lib/components/AuthModal.svelte';
	import { refreshMe } from '$lib/stores/auth';
	import Toaster from '$lib/components/Toaster.svelte';
	// ดึง user สด ๆ จาก backend ทุกครั้งที่เปิด/รีเฟรชแอป
	onMount(() => {
		refreshMe();
	});
</script>

<div class="min-h-dvh flex flex-col ">
	<Navbar />
	<main class="flex-1 ">
		<slot />
	</main>
	<footer class="border-t border-surface bg-surface-white text-sm text-neutral-500">
		<div class="mx-auto max-w-6xl px-4 py-6">© {new Date().getFullYear()} REBORN</div>
	</footer>

	<AuthModal />
	<Toaster />
</div>

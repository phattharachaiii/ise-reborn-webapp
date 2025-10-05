<script lang="ts">
	export let open = false;
	export let title = '';
	export let onClose: () => void = () => {};
	const close = () => onClose?.();

	function handleBackdropClick(e: MouseEvent) {
		if (e.currentTarget === e.target) close();
	}

	function handleBackdropKey(e: KeyboardEvent) {
		// ปิดด้วย Esc เสมอ
		if (e.key === 'Escape') {
			e.stopPropagation();
			close();
		}
		// ถ้าโฟกัสอยู่ที่ backdrop แล้วกด Enter/Space ให้ปิด (จำลองคลิก)
		if ((e.key === 'Enter' || e.key === ' ') && e.currentTarget === e.target) {
			e.preventDefault();
			close();
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 grid place-items-center bg-black/60"
		on:click={handleBackdropClick}
		on:keydown={handleBackdropKey}
		role="button"
		tabindex="0"
		aria-label="ปิดโมดัล (กด Esc เพื่อปิด)"
	>
		<div class="w-[90%] max-w-lg rounded-lg bg-white p-6 shadow-lg">
			<div class="flex items-center justify-between border-b border-surface pb-3 mb-4">
				<h2 class="text-lg font-semibold">{title}</h2>
				<button class="text-2xl leading-none -mt-1" on:click={close} aria-label="close">×</button>
			</div>
			<slot></slot>
		</div>
	</div>
{/if}

<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import { page } from '$app/stores';
	import { derived } from 'svelte/store';

	const products = {
		p4: {
			title: 'หนังสือ Fundamental of Physics',
			price: 450,
			image:
				'https://images.unsplash.com/photo-1544947950-fa07a98d237f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800'
		}
	} as const;

	const id = derived(page, ($p) => $p.params.id as keyof typeof products);

	let showBuyModal = false;
	let showSellerBanner = false;
	let presetLocation = 'โรงอาหารกลาง';
	let customLocation = '';

	const openBuy = () => (showBuyModal = true);
	const closeBuy = () => (showBuyModal = false);
	const sendRequest = () => {
		alert('ส่งคำขอสำเร็จ! 🎉\\nรอผู้ขายตอบรับภายใน 24 ชั่วโมง');
		showSellerBanner = true;
		closeBuy();
	};
</script>

<div class="mx-auto max-w-6xl px-4 py-8">
	<div class="bg-white rounded-xl p-6 shadow-card border border-surface grid md:grid-cols-2 gap-8">
		<div>
			<img src={products[$id]?.image} alt={products[$id]?.title} class="w-full rounded-lg" />
		</div>
		<div>
			<h1 class="text-3xl font-bold">{products[$id]?.title}</h1>
			<div class="text-2xl font-extrabold text-brand my-4">
				฿ {products[$id]?.price?.toLocaleString()}
			</div>
			<div class="flex items-center gap-4 bg-surface-light rounded-lg p-4">
				<div class="size-12 rounded-full bg-neutral-200 grid place-items-center">👤</div>
				<div>
					<div class="font-semibold">สมชาย ใจดี</div>
					<div class="text-sm text-neutral-500">คณะวิศวกรรมศาสตร์</div>
				</div>
			</div>
			<div class="mt-6">
				<p class="font-semibold mb-1">รายละเอียด:</p>
				<p class="text-neutral-700">
					หนังสือเรียนวิชาฟิสิกส์ 1 สภาพ 95% ไม่มีรอยขีดเขียน ห่อปกพลาสติกแล้วเรียบร้อยครับ
				</p>
			</div>
			<button
				class="mt-6 w-full rounded-lg bg-brand text-white py-3 text-lg font-medium hover:bg-brand-2 transition"
				on:click={openBuy}>กดซื้อเลย</button
			>

			{#if showSellerBanner}
				<div
					class="mt-6 p-4 rounded-lg border border-[color:var(--color-brand-orange)] bg-orange-50"
				>
					<h4 class="font-semibold">📬 คุณมี 1 คำขอซื้อใหม่!</h4>
					<p class="mt-1 text-sm">
						<strong>ผู้ซื้อ:</strong> สมหญิง รักเรียน<br /><strong>สถานที่ที่เสนอ:</strong> โรงอาหารกลาง
					</p>
					<p class="italic text-sm text-neutral-600">กรุณาตอบรับภายใน 24 ชั่วโมง</p>
					<div class="flex flex-wrap gap-2 mt-3">
						<button class="flex-1 min-w-24 rounded bg-green-600 text-white px-4 py-2"
							>✔ ยอมรับ</button
						>
						<button class="flex-1 min-w-24 rounded bg-red-600 text-white px-4 py-2"
							>✖ ปฏิเสธ</button
						>
						<button class="flex-1 min-w-24 rounded bg-neutral-600 text-white px-4 py-2"
							>🔄 เสนอที่อื่น</button
						>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<Modal bind:open={showBuyModal} title="ยืนยันการซื้อและนัดสถานที่" onClose={closeBuy}>
	<div class="space-y-4">
		<div>
			<label class="block text-sm font-medium mb-1">เลือกสถานที่นัดรับ</label>
			<select
				bind:value={presetLocation}
				class="w-full rounded border border-surface px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[color:oklch(65%_0.2_60)]/30"
			>
				<option value="โรงอาหารกลาง">โรงอาหารกลาง</option>
				<option value="ใต้ตึกคณะวิศวะ">ใต้ตึกคณะวิศวะ</option>
				<option value="ห้องสมุด">ห้องสมุด</option>
			</select>
		</div>
		<div>
			<label class="block text-sm font-medium mb-1">หรือเสนอสถานที่อื่น</label>
			<input
				bind:value={customLocation}
				placeholder="เช่น หน้า 7-Eleven ตึก A"
				class="w-full rounded border border-surface px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[color:oklch(65%_0.2_60)]/30"
			/>
		</div>
		<div class="flex gap-2">
			<button class="rounded bg-neutral-300 text-neutral-800 px-4 py-2" on:click={closeBuy}
				>ยกเลิก</button
			>
			<button class="flex-1 rounded bg-brand text-white px-4 py-2" on:click={sendRequest}
				>ส่งคำขอ</button
			>
		</div>
	</div>
</Modal>

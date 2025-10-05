<!-- src/routes/settings/profile/+page.svelte -->
<script lang="ts">
	import { api, apiJson } from '$lib/api/client';
	import { auth, openAuth, patchUserInStore } from '$lib/stores/auth';
	import { onMount, onDestroy } from 'svelte';
	import { withAvatarBuster } from '$lib/utils/avatar';
	import { toast } from '$lib/stores/toast';
	import { CameraPhotoSolid } from 'flowbite-svelte-icons';

	let email = '';
	let name = '';
	let bio = '';
	let avatarUrl = '';
	let loading = true;
	let saving = false;
	let uploading = false;
	let error = '';

	let avatarVersion: number | string = 0;
	let localPreviewUrl: string | null = null;

	const MAX_MB = 5;

	function normalizeVersion(ver: number | string | undefined): number | string {
		if (ver == null) return 0;
		if (typeof ver === 'number') return ver;
		const parsed = Date.parse(String(ver));
		return Number.isFinite(parsed) ? parsed : Date.now();
	}

	async function load() {
		error = '';
		loading = true;
		try {
			// ✅ ถ้าไม่มี token ไม่ต้องยิง /api/me เดี๋ยวได้ 401 แล้วเด้ง modal ซ้ำ
			if (!$auth.token) {
				openAuth('login');
				return;
			}

			const data = await apiJson<{
				user: {
					id: string;
					name: string;
					email: string;
					bio?: string;
					avatarUrl?: string;
					updatedAt?: string | number;
					avatarUpdatedAt?: string | number;
				};
			}>('/api/me');

			name = data.user.name;
			email = data.user.email || '';
			bio = data.user.bio || '';
			avatarUrl = data.user.avatarUrl || '';
			avatarVersion = normalizeVersion(data.user.avatarUpdatedAt ?? data.user.updatedAt ?? 0);
		} catch (e: any) {
			if (e?.status === 401) {
				openAuth('login'); // 401 จริง ๆ ค่อยเปิด
			} else {
				error = e?.message || 'โหลดข้อมูลไม่สำเร็จ';
			}
		} finally {
			loading = false;
		}
	}
	onMount(load);

	onDestroy(() => {
		if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
	});

	async function saveProfile() {
		if (!name.trim()) {
			toast.error('บันทึกไม่สำเร็จ', 'กรุณากรอกชื่อ');
			return;
		}
		saving = true;
		try {
			const res = await apiJson<{
				user: { name: string; bio?: string; avatarUrl?: string; updatedAt?: string | number };
			}>('/api/me', {
				method: 'PATCH',
				body: JSON.stringify({ name: name.trim(), bio: bio.trim() })
			});

			// ✅ อัปเดต store ทันทีให้ navbar/เมนูเปลี่ยน
			patchUserInStore({
				name: res.user.name,
				bio: res.user.bio,
				avatarUrl: res.user.avatarUrl,
				updatedAt: String(res.user.updatedAt ?? '')
			});

			toast.success('บันทึกสำเร็จ', 'อัปเดตโปรไฟล์เรียบร้อยแล้ว');
		} catch (e: any) {
			toast.error('บันทึกไม่สำเร็จ', e?.message || 'เกิดข้อผิดพลาด');
		} finally {
			saving = false;
		}
	}

	async function changeAvatar(file: File) {
		if (!file) return;

		const isImage = file.type.startsWith('image/');
		if (!isImage) {
			toast.error('รูปภาพไม่ถูกต้อง', 'กรุณาเลือกรูปภาพเท่านั้น');
			return;
		}
		if (file.size > MAX_MB * 1024 * 1024) {
			toast.error('ไฟล์ใหญ่เกินกำหนด', `ไฟล์ควรมีขนาดไม่เกิน ${MAX_MB}MB`);
			return;
		}

		if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
		localPreviewUrl = URL.createObjectURL(file);

		uploading = true;
		try {
			// 1) ขอ config สำหรับอัปโหลด
			const sigRes = await apiJson<{
				cloudName: string;
				apiKey: string | null;
				timestamp: number | null;
				signature: string | null;
				uploadPreset: string;
				folder?: string;
			}>('/api/uploads/sign', { method: 'POST' });

			// 2) เตรียมฟอร์ม
			const form = new FormData();
			form.append('file', file);
			form.append('upload_preset', sigRes.uploadPreset);
			if (sigRes.folder) form.append('folder', sigRes.folder);

			// ถ้าเป็น signed จะมี timestamp + signature + api_key
			const isSigned = Boolean(sigRes.signature);
			if (isSigned) {
				form.append('api_key', String(sigRes.apiKey));
				form.append('timestamp', String(sigRes.timestamp));
				form.append('signature', String(sigRes.signature));
			}

			// 3) อัปโหลดไปที่ Cloudinary
			const r = await fetch(`https://api.cloudinary.com/v1_1/${sigRes.cloudName}/image/upload`, {
				method: 'POST',
				body: form
			});
			const data = await r.json();
			if (!r.ok) throw new Error(data?.error?.message || 'Upload failed');

			// 4) เซฟ URL ลงระบบเรา
			const saved = await apiJson<{ user: { avatarUrl: string; updatedAt?: number | string } }>(
				'/api/me/avatar',
				{
					method: 'POST',
					body: JSON.stringify({ avatarUrl: data.secure_url })
				}
			);

			avatarUrl = saved.user.avatarUrl || data.secure_url;
			avatarVersion = normalizeVersion(saved.user.updatedAt ?? Date.now());
			// อัปเดต navbar: ใช้ฟังก์ชันใน store ที่คุณมี (ถ้าไม่มีใช้ patchUserInStore)
			// updateAvatar(avatarUrl, avatarVersion);
			// หรือ:
			// patchUserInStore({ avatarUrl });

			if (localPreviewUrl) {
				URL.revokeObjectURL(localPreviewUrl);
				localPreviewUrl = null;
			}
			toast.success('เปลี่ยนรูปสำเร็จ');
		} catch (e: any) {
			if (localPreviewUrl) {
				URL.revokeObjectURL(localPreviewUrl);
				localPreviewUrl = null;
			}
			toast.error('อัปโหลดรูปไม่สำเร็จ', e?.message || 'ลองใหม่อีกครั้ง');
		} finally {
			uploading = false;
		}
	}
</script>

<section class="max-w-4xl mx-auto my-12 px-4 py-6 space-y-5">
	<h1 class="text-2xl font-bold">แก้ไขโปรไฟล์</h1>

	{#if loading}
		<div class="rounded-lg border border-surface p-4 bg-surface-white">กำลังโหลด…</div>
	{:else}
		{#if error}
			<div class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
				{error}
			</div>
		{/if}

		<div
			class="rounded-2xl border border-surface bg-surface-white shadow-card p-4 sm:p-5 space-y-5"
		>
			<div class="flex items-center gap-4">
				{#if localPreviewUrl}
					<img
						src={localPreviewUrl}
						alt="avatar preview"
						class="w-16 h-16 rounded-full object-cover border"
					/>
				{:else if avatarUrl}
					<img
						src={withAvatarBuster(avatarUrl, avatarVersion)}
						alt="avatar"
						class="w-16 h-16 rounded-full object-cover border"
					/>
				{:else}
					<div
						class="w-16 h-16 rounded-full grid place-items-center bg-orange-100 text-brand font-bold border"
						aria-label="avatar placeholder"
					>
						{(name || 'U')[0]?.toUpperCase()}
					</div>
				{/if}

				<label class="text-sm cursor-pointer">
					<input
						type="file"
						class="hidden"
						accept="image/*"
						on:change={(e: Event) => {
							const input = e.currentTarget as HTMLInputElement;
							const file = input?.files?.[0];
							changeAvatar(file as File);
							if (input) input.value = '';
						}}
					/>
					<span
						class="inline-flex items-center gap-2 rounded-full border border-surface px-3 py-1.5 bg-white hover:bg-neutral-50 transition"
					>
						<CameraPhotoSolid class="w-4 h-4" />
						{uploading ? 'กำลังอัปโหลด…' : 'เปลี่ยนรูป'}
					</span>
				</label>
			</div>

			<div class="space-y-4">
				<div class="space-y-3">
					<p class="text-sm text-neutral-500">
						บัญชีนี้ผูกกับอีเมล: <span class="font-medium">{email}</span>
					</p>
					<label class="block text-sm mb-1" for="profile-name">ชื่อ</label>
					<input
						id="profile-name"
						class="w-full rounded-lg border border-surface px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-200"
						bind:value={name}
					/>
				</div>

				<div>
					<label class="block text-sm mb-1" for="profile-bio">คำบรรยายตัวเอง</label>
					<textarea
						id="profile-bio"
						class="w-full h-28 resize-none rounded-lg border border-surface px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-200"
						placeholder="แนะนำตัวสั้น ๆ ความสนใจ หรือสิ่งที่ชอบซื้อ-ขาย"
						bind:value={bio}
					/>
				</div>
			</div>

			<div class="flex items-center gap-3 pt-1">
				<button
					class="inline-flex items-center justify-center rounded-full bg-brand text-white px-5 py-2 disabled:opacity-60"
					on:click={saveProfile}
					disabled={saving}
				>
					{#if saving}
						<span
							class="mr-2 inline-block h-4 w-4 rounded-full border-2 border-white/60 border-t-white animate-spin"
						></span>
					{/if}
					{saving ? 'Saving…' : 'Save'}
				</button>
			</div>
		</div>
	{/if}
</section>

<style>
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.animate-spin {
		animation: spin 1s linear infinite;
	}
</style>

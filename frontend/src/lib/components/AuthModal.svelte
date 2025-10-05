<!-- src/lib/components/AuthModal.svelte -->
<script lang="ts">
	import { tick } from 'svelte';
	import { auth as authStore, openAuth, closeAuth, setAuth } from '$lib/stores/auth';
	import { apiJson } from '$lib/api/client';

	const auth = authStore;

	// form states
	let email = '';
	let name = '';
	let password = '';
	let confirm = '';

	let loading = false;
	let errorMsg = '';

	// ✅ ประกาศก่อน แล้ว reactive ทีหลัง (ห้ามใส่ type ใน $:)
	let open = false;
	let mode: 'login' | 'register' = 'login';
	$: open = $auth.openAuth;
	$: mode = $auth.mode as 'login' | 'register';

	function resetFields() {
		email = '';
		name = '';
		password = '';
		confirm = '';
		errorMsg = '';
	}
	function switchMode(next: 'login' | 'register') {
		resetFields();
		openAuth(next);
	}
	function getErrMsg(e: any) {
		if (e && typeof e === 'object') return e.message || 'เกิดข้อผิดพลาด';
		return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้';
	}

	// password policy (client hint; server ต้องตรวจซ้ำ)
	const pwRules = {
		len: (s: string) => s.length >= 8,
		digit: (s: string) => /[0-9]/.test(s),
		upper: (s: string) => /[A-Z]/.test(s),
		special: (s: string) => /[^A-Za-z0-9]/.test(s),
		nospace: (s: string) => !/\s/.test(s)
	};
	$: pwOk =
		pwRules.len(password) &&
		pwRules.digit(password) &&
		pwRules.upper(password) &&
		pwRules.special(password) &&
		pwRules.nospace(password);
	$: samePw = password.length > 0 && password === confirm;

	async function submitLogin() {
		errorMsg = '';
		loading = true;
		try {
			const data = await apiJson<{ user: any; token: string }>('/api/auth/login', {
				method: 'POST',
				body: JSON.stringify({ email: email.trim(), password: password.trim() })
			});
			setAuth(data.user, data.token);
			closeAuth();
			resetFields();
		} catch (e) {
			errorMsg = getErrMsg(e);
			console.error('login error:', e);
		} finally {
			loading = false;
		}
	}

	async function submitRegister() {
		errorMsg = '';
		if (!email.trim()) {
			errorMsg = 'กรอกอีเมลก่อน';
			return;
		}
		if (!pwOk) {
			errorMsg = 'รหัสผ่านยังไม่ตรงตามเงื่อนไข';
			return;
		}
		if (!samePw) {
			errorMsg = 'รหัสผ่านยืนยันไม่ตรงกัน';
			return;
		}

		loading = true;
		try {
			const data = await apiJson<{ user: any }>('/api/auth/register', {
				method: 'POST',
				body: JSON.stringify({
					email: email.trim(),
					name: name.trim() || undefined,
					password: password.trim(),
					passwordConfirm: confirm.trim()
				})
			});
			alert(`สมัครสำเร็จ! อีเมลของคุณคือ: ${data.user.email}`);
			switchMode('login');
			await tick();
		} catch (e) {
			console.error('register error:', e);
			errorMsg = getErrMsg(e);
		} finally {
			loading = false;
		}
	}

	let firstInput: HTMLInputElement | null = null;
	$: if (open) tick().then(() => firstInput?.focus());
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 grid place-items-center bg-black/60"
		on:click={() => {
			closeAuth();
			resetFields();
		}}
	>
		<div
			class="w-[90%] max-w-md rounded-xl bg-white p-6 shadow-lg overflow-auto max-h-[85vh]"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			on:click|stopPropagation
		>
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-xl font-bold">{mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}</h3>
				<button
					class="text-2xl -mt-2 cursor-pointer hover:text-red-600 transition"
					on:click={() => {
						closeAuth();
						resetFields();
					}}
					aria-label="close">&times;</button
				>
			</div>

			{#if errorMsg}
				<div class="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
					{errorMsg}
				</div>
			{/if}

			{#if mode === 'login'}
				<form on:submit|preventDefault={submitLogin} class="space-y-4">
					<div>
						<label class="block mb-1" for="login-email">อีเมล</label>
						<input
							id="login-email"
							type="email"
							bind:this={firstInput}
							bind:value={email}
							placeholder="StudentId@kmitl.ac.th"
							class="w-full rounded border px-3 py-2"
							autocomplete="username"
							required
						/>
					</div>
					<div>
						<label class="block mb-1" for="login-password">รหัสผ่าน</label>
						<input
							id="login-password"
							type="password"
							bind:value={password}
							class="w-full rounded border px-3 py-2"
							autocomplete="current-password"
							required
						/>
					</div>
					<button
						class="cursor-pointer w-full rounded bg-brand text-white py-2 hover:bg-brand-2 disabled:opacity-60"
						disabled={loading}
					>
						{loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
					</button>
					<p class="text-center text-sm">
						ยังไม่มีบัญชี?
						<a class="text-brand" href="#" on:click|preventDefault={() => switchMode('register')}
							>สมัครสมาชิกที่นี่</a
						>
					</p>
					<p class="text-[11px] text-neutral-500 text-center">
						(ระบบอาจจำกัดโดเมนอีเมลที่อนุญาต เช่น <code>kmitl.ac.th</code> — ถ้าไม่ผ่าน ระบบจะแจ้งเตือน)
					</p>
				</form>
			{:else}
				<form on:submit|preventDefault={submitRegister} class="space-y-4">
					<div>
						<label class="block mb-1" for="register-email">อีเมลมหาวิทยาลัย</label>
						<input
							id="register-email"
							type="email"
							bind:this={firstInput}
							bind:value={email}
							placeholder="StudentId@kmitl.ac.th"
							class="w-full rounded border px-3 py-2"
							autocomplete="email"
							required
						/>
						<p class="mt-1 text-[11px] text-neutral-500">
							ใช้อีเมลนักศึกษาหรือบุคลากร (โดเมนที่อนุญาตถูกกำหนดที่ฝั่งระบบ)
						</p>
					</div>

					<div>
						<label class="block mb-1" for="register-name">ชื่อที่แสดง (ไม่บังคับ)</label>
						<input
							id="register-name"
							bind:value={name}
							placeholder="เว้นว่างได้"
							class="w-full rounded border px-3 py-2"
							autocomplete="nickname"
						/>
					</div>

					<div>
						<label class="block mb-1" for="register-password">สร้างรหัสผ่าน</label>
						<input
							id="register-password"
							type="password"
							bind:value={password}
							class="w-full rounded border px-3 py-2"
							autocomplete="new-password"
							required
						/>
						<ul class="mt-2 space-y-1 text-[12px]">
							<li class={pwRules.len(password) ? 'text-green-700' : 'text-neutral-500'}>
								อย่างน้อย 8 ตัวอักษร
							</li>
							<li class={pwRules.digit(password) ? 'text-green-700' : 'text-neutral-500'}>
								ตัวเลข ≥ 1 ตัว
							</li>
							<li class={pwRules.upper(password) ? 'text-green-700' : 'text-neutral-500'}>
								ตัวพิมพ์ใหญ่ ≥ 1 ตัว
							</li>
							<li class={pwRules.special(password) ? 'text-green-700' : 'text-neutral-500'}>
								อักขระพิเศษ ≥ 1 ตัว
							</li>
							<li class={pwRules.nospace(password) ? 'text-green-700' : 'text-neutral-500'}>
								ห้ามมีช่องว่าง
							</li>
						</ul>
					</div>

					<div>
						<label class="block mb-1" for="register-confirm">ยืนยันรหัสผ่าน</label>
						<input
							id="register-confirm"
							type="password"
							bind:value={confirm}
							class="w-full rounded border px-3 py-2"
							autocomplete="new-password"
							required
						/>
						{#if confirm.length > 0}
							<div class="mt-1 text-[12px] {samePw ? 'text-green-700' : 'text-red-700'}">
								{samePw ? 'รหัสผ่านตรงกัน' : 'รหัสผ่านไม่ตรงกัน'}
							</div>
						{/if}
					</div>

					<button
						class="cursor-pointer w-full rounded bg-brand text-white py-2 hover:bg-brand-2 disabled:opacity-60"
						disabled={loading}
					>
						{loading ? 'กำลังสมัครสมาชิก...' : 'สมัครสมาชิก'}
					</button>
					<p class="text-center text-sm">
						มีบัญชีอยู่แล้ว?
						<a class="text-brand" href="#" on:click|preventDefault={() => switchMode('login')}
							>เข้าสู่ระบบที่นี่</a
						>
					</p>
				</form>
			{/if}
		</div>
	</div>
{/if}

<style>
	.shadow-lg {
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
	}
</style>

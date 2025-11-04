<!-- src/lib/components/AuthModal.svelte -->
<script lang="ts">
	import { tick } from 'svelte';
	import { auth as authStore, openAuth, closeAuth, setAuth } from '$lib/stores/auth';
	import { apiJson } from '$lib/api/client';
	import { toast } from '$lib/stores/toast';
	const auth = authStore;

	// form states
	let email = '';
	let name = '';
	let password = '';
	let confirm = '';

	let loading = false;
	let errorMsg = '';

	// ✅ Declare first, then reactive (do not add type in $:)
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
		if (e && typeof e === 'object') return e.message || 'An error occurred';
		return 'Cannot connect to server';
	}

	// password policy (client hint; server must also check)
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
			errorMsg = 'Enter your email';
			return;
		}
		if (!pwOk) {
			errorMsg = 'Password does not meet requirements';
			return;
		}
		if (!samePw) {
			errorMsg = 'Passwords do not match';
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
			toast.success('Registered successfully!', `Your email is: ${data.user.email}`);
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

	let dialogEl: HTMLDivElement | null = null;
	function handleGlobalKeys(e: KeyboardEvent) {
		if (!open) return;

		// ปิดด้วย ESC
		if (e.key === 'Escape') {
			e.preventDefault();
			closeAuth();
			resetFields();
			return;
		}

		// ลูกศรขึ้น/ลง เปลี่ยนโฟกัสภายในโมดัล
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			const focusables = dialogEl?.querySelectorAll<HTMLElement>(
				// input / button / ลิงก์ ที่ยัง active
				'input:not([type="hidden"]):not([disabled]), button:not([disabled]), a[href]'
			);
			if (!focusables || focusables.length === 0) return;

			const current = document.activeElement as HTMLElement | null;
			let idx = Array.from(focusables).findIndex((el) => el === current);

			// ถ้ายังไม่มีโฟกัสในโมดัล ให้ไปที่ตัวแรก
			if (idx === -1) {
				(focusables[0] as HTMLElement).focus();
				e.preventDefault();
				return;
			}

			const dir = e.key === 'ArrowDown' ? 1 : -1;
			idx = (idx + dir + focusables.length) % focusables.length;
			(focusables[idx] as HTMLElement).focus();
			e.preventDefault();
		}
	}
</script>

<svelte:window on:keydown={handleGlobalKeys} />
{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50 grid place-items-center bg-black/60" role="presentation">
		<div
			class="w-[90%] max-w-md rounded-xl bg-white p-6 shadow-lg overflow-auto max-h-[85vh]"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			bind:this={dialogEl}
			on:click|stopPropagation
		>
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-xl font-bold">{mode === 'login' ? 'Login' : 'Register'}</h3>
				<button
					class="text-sm -mt-2 cursor-pointer px-2 py-1 text-sm font-semibold text-gray-600 hover:text-white
         bg-gray-100 hover:bg-red-500
         rounded-full shadow-sm transition-all duration-200
         hover:scale-105 active:scale-95"
					on:click={() => {
						closeAuth();
						resetFields();
					}}
					aria-label="close">✕</button
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
						<label class="block mb-1" for="login-email">Email</label>
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
						<label class="block mb-1" for="login-password">Password</label>
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
						{loading ? 'Logging in...' : 'Login'}
					</button>
					<p class="text-center text-sm">
						Don't have an account?
						<a class="text-brand" href="#" on:click|preventDefault={() => switchMode('register')}
							>Register here</a
						>
					</p>
					<p class="text-[11px] text-neutral-500 text-center">
						(The system may restrict allowed email domains, e.g., <code>kmitl.ac.th</code> — if not accepted,
						you will be notified.)
					</p>
				</form>
			{:else}
				<form on:submit|preventDefault={submitRegister} class="space-y-4">
					<div>
						<label class="block mb-1" for="register-email">University Email</label>
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
							Use your student or staff email (allowed domains are set by the system).
						</p>
					</div>

					<div>
						<label class="block mb-1" for="register-name">Display Name (optional)</label>
						<input
							id="register-name"
							bind:value={name}
							placeholder="Leave blank if not applicable"
							class="w-full rounded border px-3 py-2"
							autocomplete="nickname"
						/>
					</div>

					<div>
						<label class="block mb-1" for="register-password">Create Password</label>
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
								At least 8 characters
							</li>
							<li class={pwRules.digit(password) ? 'text-green-700' : 'text-neutral-500'}>
								At least 1 digit
							</li>
							<li class={pwRules.upper(password) ? 'text-green-700' : 'text-neutral-500'}>
								At least 1 uppercase letter
							</li>
							<li class={pwRules.special(password) ? 'text-green-700' : 'text-neutral-500'}>
								At least 1 special character
							</li>
							<li class={pwRules.nospace(password) ? 'text-green-700' : 'text-neutral-500'}>
								No spaces allowed
							</li>
						</ul>
					</div>

					<div>
						<label class="block mb-1" for="register-confirm">Confirm Password</label>
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
								{samePw ? 'Passwords match' : 'Passwords do not match'}
							</div>
						{/if}
					</div>

					<button
						class="cursor-pointer w-full rounded bg-brand text-white py-2 hover:bg-brand-2 disabled:opacity-60"
						disabled={loading}
					>
						{loading ? 'Registering...' : 'Register'}
					</button>
					<p class="text-center text-sm">
						Already have an account?
						<a class="text-brand" href="#" on:click|preventDefault={() => switchMode('login')}
							>Login here</a
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

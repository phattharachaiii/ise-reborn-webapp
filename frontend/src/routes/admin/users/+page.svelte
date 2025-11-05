<!-- frontend/src/routes/admin/users/+page.svelte -->
<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { api } from '$lib/api/client';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';

	type Report = {
		id: string;
		createdAt: string;
		reason: string;
		details?: string | null;
		evidenceImageUrls?: string[];
		status: 'PENDING' | 'RESOLVED';
		resolution?: 'UNBAN' | 'TEMPSUSPEND' | 'SUSPEND' | null;
		resolutionNote?: string | null;
		resolvedAt?: string | null; // 👈 เพิ่มบรรทัดนี้
		author: { id: string; name?: string | null; email?: string | null; avatarUrl?: string | null };
		targetUser: {
			id: string;
			name?: string | null;
			email?: string | null;
			avatarUrl?: string | null;
			accountStatus?: string | null;
		};
		logs?: Array<{
			id: string;
			action: 'RESOLVE' | 'CHANGE';
			prevResolution?: 'UNBAN' | 'TEMPSUSPEND' | 'SUSPEND' | null;
			nextResolution?: 'UNBAN' | 'TEMPSUSPEND' | 'SUSPEND' | null;
			reason?: string | null;
			createdAt: string;
			actor: { id: string; name?: string | null };
		}>;
	};

	let loading = true;
	let err = '';
	let tab: 'PENDING' | 'RESOLVED' = 'PENDING';
	let pending: Report[] = [];
	let resolved: Report[] = [];

	// modal state
	let actReport: Report | null = null;
	let newResolution: 'UNBAN' | 'TEMPSUSPEND' | 'SUSPEND' = 'UNBAN';
	let note = ''; // เหตุผลครั้งแรก
	let changeReason = ''; // เหตุผลเปลี่ยนคำตัดสิน
	let working = false;
	let toastMsg = '';

	function toast(t: string) {
		toastMsg = t;
		setTimeout(() => (toastMsg = ''), 2000);
	}

	async function loadReports() {
		loading = true;
		err = '';
		try {
			const me = get(auth).user;
			if (!me || me.role !== 'ADMIN') {
				err = 'FORBIDDEN';
				return;
			}
			// ดึงทั้งสองสถานะ
			const [resP, resR] = await Promise.all([
				api('/api/reports?status=PENDING'),
				api('/api/reports?status=RESOLVED')
			]);
			const jP = await resP.json();
			const jR = await resR.json();
			if (!resP.ok) throw new Error(jP?.message || 'Failed to load pending');
			if (!resR.ok) throw new Error(jR?.message || 'Failed to load resolved');

			pending = jP.items || [];
			resolved = jR.items || [];
		} catch (e: any) {
			err = e?.message || 'Error';
		} finally {
			loading = false;
		}
	}

	onMount(loadReports);

	// เปิด modal “ตัดสิน” (ครั้งแรก)
	function openResolveModal(r: Report) {
		actReport = r;
		newResolution = 'TEMPSUSPEND';
		note = '';
		changeReason = '';
	}

	// เปิด modal “เปลี่ยนคำตัดสิน”
	function openChangeModal(r: Report) {
		actReport = r;
		newResolution = (r.resolution as any) || 'TEMPSUSPEND';
		changeReason = '';
		note = '';
	}

	async function submitResolve() {
		if (!actReport) return;
		if (!note.trim()) {
			alert('Please provide a reason for this decision.');
			return;
		}
		working = true;
		try {
			const res = await api(`/api/reports/${actReport.id}`, {
				method: 'PATCH',
				body: JSON.stringify({ resolution: newResolution, note })
			});
			const j = await res.json();
			if (!res.ok) throw new Error(j?.message || 'Failed');
			toast('Decision applied');
			actReport = null;
			await loadReports();
			tab = 'PENDING'; // กลับไปดูที่ยังเหลือ
		} catch (e: any) {
			alert(e?.message || 'Error');
		} finally {
			working = false;
		}
	}

	async function submitChange() {
		if (!actReport) return;
		if (!changeReason.trim()) {
			alert('Please provide a reason to change decision.');
			return;
		}
		working = true;
		try {
			const res = await api(`/api/reports/${actReport.id}`, {
				method: 'PATCH',
				body: JSON.stringify({ resolution: newResolution, changeReason })
			});
			const j = await res.json();
			if (!res.ok) throw new Error(j?.message || 'Failed');
			toast('Decision changed');
			actReport = null;
			await loadReports();
			tab = 'RESOLVED'; // กลับไปดูกลุ่มที่ทำแล้ว
		} catch (e: any) {
			alert(e?.message || 'Error');
		} finally {
			working = false;
		}
	}
</script>

<section class="mx-auto max-w-7xl px-4 py-8">
	<h1 class="text-2xl font-bold">Admin — User Reports</h1>

	{#if loading}
		<div class="mt-4">Loading...</div>
	{:else if err}
		<div class="mt-4 text-red-600">{err}</div>
	{:else}
		<!-- Tabs -->
		<div class="mt-4 flex gap-2">
			<button
				class="px-3 py-1.5 rounded border cursor-pointer {tab === 'PENDING'
					? 'bg-brand text-white'
					: 'hover:bg-neutral-300'}"
				on:click={() => (tab = 'PENDING')}
			>
				Pending ({pending.length})
			</button>
			<button
				class="px-3 py-1.5 rounded border cursor-pointer  {tab === 'RESOLVED'
					? 'bg-brand text-white'
					: 'hover:bg-neutral-300'}"
				on:click={() => (tab = 'RESOLVED')}
			>
				Resolved ({resolved.length})
			</button>
		</div>

		<!-- List -->
		{#if tab === 'PENDING'}
			<div class="mt-4 overflow-auto">
				<table class="min-w-full text-sm">
					<thead>
						<tr class="text-left border-b">
							<th class="p-2">When</th>
							<th class="p-2">Reporter</th>
							<th class="p-2">Target</th>
							<th class="p-2">Reason</th>
							<th class="p-2">Evidence</th>
							<th class="p-2">Action</th>
						</tr>
					</thead>
					<tbody>
						{#each pending as r}
							<tr class="border-b align-top">
								<td class="p-2 whitespace-nowrap">
									{(r.resolvedAt ?? r.createdAt)
										? new Date(r.resolvedAt ?? r.createdAt).toLocaleString()
										: ''}
								</td>
								<td class="p-2">
									<div class="flex items-center gap-2">
										<img
											src={r.author?.avatarUrl || 'https://placehold.co/24'}
											alt=""
											class="w-6 h-6 rounded-full"
										/>
										<div class="leading-tight">
											<div class="font-medium">{r.author?.name ?? r.author?.id}</div>
											<div class="text-[11px] text-neutral-500">{r.author?.email}</div>
										</div>
									</div>
								</td>
								<td class="p-2">
									<div class="leading-tight">
										<div class="font-medium">
											<a href={'/profile/' + r.targetUser?.id} class="text-brand hover:underline">
												{r.targetUser?.name ?? r.targetUser?.id}
											</a>
										</div>
										<div class="text-[11px]">Status: {r.targetUser?.accountStatus}</div>
									</div>
								</td>
								<td class="p-2 max-w-72 break-words">
									<div class="font-medium">{r.reason}</div>
									{#if r.details}<div class="text-[12px] text-neutral-600 mt-1">
											{r.details}
										</div>{/if}
								</td>
								<td class="p-2">
									<div class="flex flex-wrap gap-1">
										{#each r.evidenceImageUrls || [] as img}
											<a href={img} target="_blank" rel="noreferrer">
												<img src={img} alt="evi" class="w-12 h-12 object-cover rounded border" />
											</a>
										{/each}
									</div>
								</td>
								<td class="p-2">
									<button
										class="px-3 py-1 rounded bg-brand text-white hover:brand-2  cursor-pointer"
										on:click={() => openResolveModal(r)}
									>
										Take action
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<div class="mt-4 overflow-auto">
				<table class="min-w-full text-sm">
					<thead>
						<tr class="text-left border-b">
							<th class="p-2">Resolved at</th>
							<th class="p-2">Target</th>
							<th class="p-2">Decision</th>
							<th class="p-2">Note</th>
							<th class="p-2">Logs (latest)</th>
							<th class="p-2">Change</th>
						</tr>
					</thead>
					<tbody>
						{#each resolved as r}
							<tr class="border-b align-top">
								<td class="p-2 whitespace-nowrap"
									>{new Date(r.resolvedAt || r.createdAt).toLocaleString?.() ?? ''}</td
								>
								<td class="p-2">
									<div class="leading-tight">
										<div class="font-medium">
											<a href={'/profile/' + r.targetUser?.id} class="text-brand hover:underline">
												{r.targetUser?.name ?? r.targetUser?.id}
											</a>
										</div>
										<div class="text-[11px]">User status: {r.targetUser?.accountStatus}</div>
									</div>
								</td>
								<td class="p-2">
									<span class="inline-flex items-center rounded-full border px-2 py-0.5">
										{r.resolution}
									</span>
								</td>
								<td class="p-2 max-w-80 break-words">{r.resolutionNote || '-'}</td>
								<td class="p-2">
									<div class="space-y-1 max-w-96">
										{#each r.logs || [] as lg, idx (lg.id)}
											<div class="text-[12px] text-neutral-700">
												<span class="font-medium">{lg.action}</span>
												{#if lg.prevResolution}
													<span> {lg.prevResolution} → </span>
												{/if}
												{#if lg.nextResolution}
													<span> {lg.nextResolution}</span>
												{/if}
												<span class="text-neutral-500">
													· {new Date(lg.createdAt).toLocaleString()}</span
												>
												{#if lg.reason}<div class="text-neutral-600">— {lg.reason}</div>{/if}
											</div>
										{/each}
										{#if !r.logs || r.logs.length === 0}
											<div class="text-[12px] text-neutral-500">No logs</div>
										{/if}
									</div>
								</td>
								<td class="p-2">
									<button
										class="px-3 py-1 rounded border hover:bg-neutral-50 cursor-pointer hover:bg-brand/5"
										on:click={() => openChangeModal(r)}
									>
										Change decision
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
</section>

<!-- Modal: Resolve -->
{#if actReport && actReport.status === 'PENDING'}
	<div class="fixed inset-0 z-[95] bg-black/30 overflow-y-auto">
		<div class="min-h-full flex items-center justify-center p-4">
			<div class="w-[min(92vw,520px)] rounded-xl bg-white p-4 border">
				<div class="text-lg font-semibold">Take action</div>
				<div class="mt-3 space-y-3">
					<div>
						<label for="decision" class="block text-sm mb-1">Decision</label>
						<select id="decision" class="w-full rounded border px-3 py-2" bind:value={newResolution}>
							<option value="UNBAN">Unban</option>
							<option value="TEMPSUSPEND">Temp Suspend</option>
							<option value="SUSPEND">Suspend</option>
						</select>
					</div>
					<div>
						<label for="reason" class="block text-sm mb-1">Reason (required)</label>
						<textarea
							id="reason"
							class="w-full rounded border px-3 py-2 min-h-24"
							bind:value={note}
							placeholder="Why do you decide this?"
						></textarea>
					</div>
				</div>
				<div class="mt-4 flex justify-end gap-2">
					<button
						class="rounded px-3 py-2 border hover:bg-neutral-50 cursor-pointer "
						on:click={() => (actReport = null)}
						disabled={working}>Cancel</button
					>
					<button
						class="rounded px-3 py-2 bg-neutral-900 text-white hover:opacity-90 cursor-pointer "
						on:click={submitResolve}
						disabled={working}>Apply</button
					>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Modal: Change decision -->
{#if actReport && actReport.status === 'RESOLVED'}
	<div class="fixed inset-0 z-[95] bg-black/30 overflow-y-auto">
		<div class="min-h-full flex items-center justify-center p-4">
			<div class="w-[min(92vw,520px)] rounded-xl bg-white p-4 border">
				<div class="text-lg font-semibold">Change decision</div>
				<div class="mt-3 space-y-3">
					<div>
						<label for="new-decision" class="block text-sm mb-1">New decision</label>
						<select id="new-decision" class="w-full rounded border px-3 py-2" bind:value={newResolution}>
							<option value="UNBAN">Unban</option>
							<option value="TEMPSUSPEND">Temp Suspend</option>
							<option value="SUSPEND">Suspend</option>
						</select>
					</div>
					<div>
						<label for="change-reason" class="block text-sm mb-1">Reason to change (required)</label>
						<textarea
							id="change-reason"
							class="w-full rounded border px-3 py-2 min-h-24"
							bind:value={changeReason}
							placeholder="Why do you change the previous decision?"
						></textarea>
					</div>
				</div>
				<div class="mt-4 flex justify-end gap-2">
					<button
						class="rounded px-3 py-2 border hover:bg-neutral-200 cursor-pointer "
						on:click={() => (actReport = null)}
						disabled={working}>Cancel</button
					>
					<button
						class="rounded px-3 py-2 bg-brand text-white hover:brand-2 cursor-pointer "
						on:click={submitChange}
						disabled={working}>Save</button
					>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- toasts -->
{#if toastMsg}
	<div class="fixed bottom-4 left-1/2 -translate-x-1/2 z-[96]">
		<div class="px-3 py-2 rounded-lg shadow-card border text-sm bg-white">{toastMsg}</div>
	</div>
{/if}

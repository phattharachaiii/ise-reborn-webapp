// src/lib/stores/notifications.ts
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Noti = {
    id: string; type: string; title: string; message?: string;
    offerId?: string; listingId?: string; isRead: boolean; createdAt: string;
};
export const notis = writable<Noti[]>([]);
export const unreadCount = writable(0);

let es: EventSource | null = null;

export async function fetchNotis() {
    const r = await fetch('/api/notifications?unread=0', { credentials: 'include' });
    const data = await r.json();
    notis.set(data.items || []);
    unreadCount.set((data.items || []).filter((n: Noti) => !n.isRead).length);
}

export async function markRead(ids: string[]) {
    if (!ids.length) return;
    await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
    });
    fetchNotis();
}

export function startNotiStream() {
    if (!browser) return;
    if (es) es.close();
    es = new EventSource('/api/notifications/stream');
    es.onmessage = (ev) => {
        // console.log('SSE:', ev.data);
        fetchNotis(); // ง่ายสุด: มี event -> ดึงใหม่
    };
}

export function stopNotiStream() {
    if (es) es.close();
    es = null;
}

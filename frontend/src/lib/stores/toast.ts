// src/lib/stores/toast.ts
import { writable } from 'svelte/store';

export type ToastKind = 'success' | 'error' | 'info';
export type ToastItem = {
    id: string;
    kind: ToastKind;
    title?: string;
    message?: string;
    duration?: number; // ms
};

function makeId() {
    return Math.random().toString(36).slice(2, 9);
}

function createToastStore() {
    const { subscribe, update } = writable<ToastItem[]>([]);

    function push(kind: ToastKind, title?: string, message?: string, duration = 3000) {
        const id = makeId();
        const item: ToastItem = { id, kind, title, message, duration };
        update((arr) => [...arr, item]);
        if (duration > 0) {
            setTimeout(() => dismiss(id), duration);
        }
        return id;
    }
    function dismiss(id: string) {
        update((arr) => arr.filter((t) => t.id !== id));
    }

    return {
        subscribe,
        push,
        dismiss,
        success: (title?: string, message?: string, duration?: number) =>
            push('success', title, message, duration),
        error: (title?: string, message?: string, duration?: number) =>
            push('error', title, message, duration),
        info: (title?: string, message?: string, duration?: number) =>
            push('info', title, message, duration)
    };
}

export const toast = createToastStore();

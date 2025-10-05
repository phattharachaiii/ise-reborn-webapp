import { writable } from 'svelte/store';

export type User = {
    id: string;
    name: string;
    avatarUrl?: string; // URL ล่าสุดจาก backend หรือ storage
};

function createUserStore() {
    const { subscribe, set, update } = writable<User | null>(null);

    return {
        subscribe,
        setUser: (u: User | null) => set(u),
        updateAvatarUrl: (url: string) =>
            update((u) => (u ? { ...u, avatarUrl: url } : u))
    };
}

export const user = createUserStore();

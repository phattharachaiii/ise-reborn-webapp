// src/lib/stores/auth.ts
import { browser } from '$app/environment';
import { writable, get, type Writable } from 'svelte/store';
import { apiJson } from '$lib/api/client';

/** ------- Types ------- */
export type Role = 'USER' | 'ADMIN';

export type UserLite = {
  id: string;
  email: string;
  studentId?: string | null;
  name: string;
  bio?: string | null;
  avatarUrl?: string | null;
  /** ไว้ bust cache ถ้ามีเก็บฝั่งหลังบ้าน */
  avatarUpdatedAt?: string | number | null;
  role?: Role;
  updatedAt?: string | number;
};

type AuthMode = 'login' | 'register';
type AuthStatus = 'LOGGED_OUT' | 'LOGGING_IN' | 'LOGGED_IN';

export type AuthState = {
  user: UserLite | null;
  token: string | null;
  /** modal */
  openAuth: boolean;
  mode: AuthMode;
  /** สำหรับ component ที่ดูสถานะ (เช่น NotificationsBell) */
  status: AuthStatus;
};

const STORAGE_KEY = 'auth_v1';

/** ------- Helpers: storage ------- */
function loadFromStorage(): Pick<AuthState, 'user' | 'token' | 'status'> {
  if (!browser) return { user: null, token: null, status: 'LOGGED_OUT' };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { user: null, token: null, status: 'LOGGED_OUT' };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { user: null, token: null, status: 'LOGGED_OUT' };
    return {
      user: parsed.user ?? null,
      token: parsed.token ?? null,
      status: parsed.status ?? (parsed.user && parsed.token ? 'LOGGED_IN' : 'LOGGED_OUT')
    };
  } catch {
    return { user: null, token: null, status: 'LOGGED_OUT' };
  }
}

function saveToStorage(user: UserLite | null, token: string | null, status: AuthStatus) {
  if (!browser) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token, status }));
  } catch {
    // ignore
  }
}

/** ------- Initial state ------- */
function init(): AuthState {
  const { user, token, status } = loadFromStorage();
  return {
    user,
    token,
    openAuth: false,
    mode: 'login',
    status: status ?? (user && token ? 'LOGGED_IN' : 'LOGGED_OUT')
  };
}

/** ------- Store ------- */
export const auth: Writable<AuthState> = writable<AuthState>(init());

/** persist when changes (ไม่แก้ store กลับ เลยไม่เกิด loop) */
auth.subscribe((s) => {
  saveToStorage(s.user, s.token, s.status);
});

/** ------- Public API (functions) ------- */

/** เปิด modal auth (login/register) */
export function openAuth(mode: AuthMode = 'login') {
  auth.update((s) => ({ ...s, openAuth: true, mode }));
}

/** ปิด modal auth */
export function closeAuth() {
  auth.update((s) => ({ ...s, openAuth: false }));
}

/** ตั้งสถานะระหว่าง process login (สำหรับ UI ที่อยากรู้) */
export function setLoggingIn() {
  auth.update((s) => ({ ...s, status: 'LOGGING_IN' }));
}

/** เซ็ต user + token หลัง login สำเร็จ */
export function setAuth(user: UserLite, token: string) {
  auth.set({
    user,
    token,
    openAuth: false,
    mode: 'login',
    status: 'LOGGED_IN'
  });
}

/** ล้างสถานะทั้งหมด (logout) */
export function clearAuth() {
  auth.set({
    user: null,
    token: null,
    openAuth: false,
    mode: 'login',
    status: 'LOGGED_OUT'
  });
}

/** ดึงข้อมูลผู้ใช้ปัจจุบันจาก /api/me แล้วอัปเดต store (เรียกใน onMount/refresh flow) */
export async function refreshMe() {
  const { token } = get(auth);
  if (!token) {
    // ยังไม่ได้ล็อกอิน
    auth.update((s) => ({ ...s, status: 'LOGGED_OUT' }));
    return null;
  }

  try {
    // ใช้ apiJson เพื่อให้แน่ใจว่าแนบ Bearer + credentials: 'include'
    const data = await apiJson<{ user: UserLite }>('/api/me', { method: 'GET' });
    if (data?.user) {
      auth.update((s) => ({ ...s, user: data.user, status: 'LOGGED_IN' }));
      return data.user;
    }
  } catch (e: any) {
    // ถ้า 401 ให้ล้าง session
    if (typeof e?.message === 'string' && /401|UNAUTHORIZED/i.test(e.message)) {
      clearAuth();
      return null;
    }
    // network error → ไม่ล้าง session เพื่อไม่รบกวน UI
  }
  return null;
}

/** ดึงโทเค็นปัจจุบัน—เผื่อ client fetch ใช้เฉพาะกิจ */
export function getToken() {
  return get(auth).token;
}

/** อัปเดตเฉพาะฟิลด์ user ใน store (ใช้หลัง PATCH /api/me) */
export function setUser(patch: Partial<UserLite>) {
  auth.update((s) => (s.user ? { ...s, user: { ...s.user, ...patch } } : s));
}

/** อัปเดตรูป avatar + เวอร์ชัน (bust cache) */
export function updateAvatar(avatarUrl: string, version?: number | string) {
  auth.update((s) =>
    s.user
      ? { ...s, user: { ...s.user, avatarUrl, avatarUpdatedAt: version ?? Date.now() } }
      : s
  );
}

/** alias ที่หน้าอื่นอาจเรียกอยู่ (กรณีคุณใช้ชื่อเดิม) */
export const patchUserInStore = setUser;

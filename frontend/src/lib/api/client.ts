// $lib/api/client.ts
import { get } from 'svelte/store';
import { auth } from '$lib/stores/auth';

const API_BASE = import.meta.env.PUBLIC_BACKEND_ORIGIN ?? 'http://localhost:3000';

function apiUrl(path: string) {
  if (!path) return API_BASE;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/')) return `${API_BASE}${path}`;
  return `${API_BASE}/${path}`;
}

function shouldSetJsonContentType(init?: RequestInit) {
  const body = init?.body as any;
  if (!body) return false;
  if (typeof FormData !== 'undefined' && body instanceof FormData) return false;
  if (typeof Blob !== 'undefined' && body instanceof Blob) return false;
  if (body instanceof ArrayBuffer) return false;
  return true;
}

export async function api(path: string, init: RequestInit = {}) {
  const token = get(auth).token;

  const headers = new Headers(init.headers || {});
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (shouldSetJsonContentType(init) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // DEBUG ชั่วคราว
  // console.log('[api] ->', apiUrl(path), 'Authorization?', headers.get('Authorization'));

  return fetch(apiUrl(path), {
    credentials: 'include',
    mode: 'cors',
    ...init,
    headers
  });
}

export async function apiJson<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await api(path, init).catch((err) => {
    console.error('[apiJson] network error:', apiUrl(path), err);
    throw new Error('Failed to fetch');
  });

  let data: any = null;
  try {
    const ct = res.headers.get('content-type') || '';
    data = ct.includes('application/json') ? await res.json() : await res.text();
  } catch { }

  if (!res.ok) {
    const message =
      (data && (data.message || data.error)) ||
      (typeof data === 'string' && data) ||
      `HTTP ${res.status}`;
    console.error('[apiJson] error:', res.status, apiUrl(path), message);
    throw new Error(message);
  }

  return (data ?? {}) as T;
}

export function sseUrl(path: string) {
  return new URL(path, API_BASE).toString();
}

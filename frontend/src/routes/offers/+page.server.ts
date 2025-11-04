import type { PageServerLoad } from './$types';
import { PUBLIC_BACKEND_ORIGIN } from '$env/static/public';

export const load: PageServerLoad = async ({ fetch, cookies, url, locals }) => {
  const role = url.searchParams.get('role') ?? 'all';

  // 1) ถ้าใช้คุกกี้ session กับ BE: forward cookie ทั้งก้อนไปเลย
  const cookieHeader = cookies.getAll().map(c => `${c.name}=${c.value}`).join('; ');

  // 2) ถ้าใช้ Bearer token: เก็บไว้ใน cookie/locals (เลือกอย่างใดอย่างหนึ่ง)
  const token = cookies.get('token') ?? (locals as any).token ?? '';

  const res = await fetch(`${PUBLIC_BACKEND_ORIGIN}/api/offers/mine?role=${encodeURIComponent(role)}`, {
    headers: {
      'content-type': 'application/json',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    }
  });

  if (!res.ok) {
    // ส่งสถานะไปให้หน้า UI จัดการได้ (เช่นโชว์ empty/error state)
    return { items: [], error: `fetch_failed_${res.status}` };
  }

  // BE คืน { items: [...] }
  return await res.json();
};

// ปิด cache/edge ให้ dynamic เสมอ เหมาะกับเพจที่มี auth
export const prerender = false;
export const csr = true;   // client ใช้งานต่อได้ตามปกติ
export const ssr = true;   // หัวใจของวิธี B
export const trailingSlash = 'never';

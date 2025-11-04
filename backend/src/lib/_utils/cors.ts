// utils/cors.ts
import { NextResponse } from 'next/server';

const STATIC_ALLOW = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'https://ise-reborn-webapp-ga1p.vercel.app',
]);

function isAllowedOrigin(origin: string) {
  if (STATIC_ALLOW.has(origin)) return true;
  try {
    const { host } = new URL(origin);
    // allow เฉพาะ preview ของโปรเจกต์นี้บน vercel
    return host.endsWith('.vercel.app') && host.startsWith('ise-reborn-webapp-ga1p');
  } catch { return false; }
}

export function withCORS(res: NextResponse, req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const allow = isAllowedOrigin(origin)
    ? origin
    : 'https://ise-reborn-webapp-ga1p.vercel.app'; // fallback ที่ปลอดภัย

  res.headers.set('Access-Control-Allow-Origin', allow);
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.headers.set('Access-Control-Max-Age', '600');
  // สำคัญ: เพิ่ม Vary: Origin (ตอนนี้ response ของคุณยังไม่มี)
  res.headers.append('Vary', 'Origin');
  return res;
}

export function preflight(req: Request) {
  return withCORS(new NextResponse(null, { status: 204 }), req);
}

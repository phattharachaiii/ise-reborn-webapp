// app/api/me/avatar/route.ts   ← แยกเป็นเส้นทางเฉพาะก็ได้ (หรือใช้ไฟล์เดิมของคุณ)
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PUBLIC_FRONTEND_ORIGIN = process.env.PUBLIC_FRONTEND_ORIGIN || 'http://localhost:5173';

function withCORS(res: NextResponse, methods = ['POST']) {
  res.headers.set('Access-Control-Allow-Origin', PUBLIC_FRONTEND_ORIGIN);
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.headers.set('Access-Control-Allow-Methods', [...methods, 'OPTIONS'].join(','));
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Vary', 'Origin');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function OPTIONS() {
  return withCORS(new NextResponse(null, { status: 204 }), ['POST']);
}

export async function POST(req: Request) {
  try {
    const me = await getUserFromRequest(req).catch(() => null);
    if (!me) return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }));

    const body = await req.json().catch(() => ({} as any));
    const raw = String(body?.avatarUrl ?? '').trim();
    if (!raw) {
      return withCORS(NextResponse.json({ message: 'AVATAR_URL_REQUIRED' }, { status: 400 }));
    }

    // --- Validate URL + restrict host (กันผู้ใช้ยัด URL แปลก ๆ) ---
    let url: URL;
    try { url = new URL(raw); } catch {
      return withCORS(NextResponse.json({ message: 'INVALID_URL' }, { status: 400 }));
    }
    const allowHosts = new Set([
      'res.cloudinary.com',                 // Cloudinary delivery
      'images.unsplash.com',                // (ถ้าจะอนุญาต)
      // เพิ่มโดเมนอื่นที่ไว้ใจได้
    ]);
    if (!allowHosts.has(url.hostname)) {
      return withCORS(NextResponse.json({ message: 'HOST_NOT_ALLOWED' }, { status: 400 }));
    }

    // (ถ้าต้อง normalize query ที่เป็นแค่ cache-buster ออก)
    // url.search = '';

    const user = await prisma.user.update({
      where: { id: me.id },
      data: {
        avatarUrl: url.toString(),     
      },
      select: {
        id: true,
        avatarUrl: true,
        updatedAt: true
      },
    });

    return withCORS(NextResponse.json({ user }, { status: 200 }));
  } catch (err) {
    console.error('[ME/AVATAR POST]', err);
    return withCORS(NextResponse.json({ message: 'INTERNAL_ERROR' }, { status: 500 }));
  }
}

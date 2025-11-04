// app/api/me/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';                // ← ให้ชัวร์ว่า path นี้ตรงกับโปรเจกต์คุณจริง
import { getUserFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';               // กัน route ถูกแคช
export const revalidate = 0;                          // กัน SSG cache อีกชั้น

const PUBLIC_FRONTEND_ORIGIN = process.env.PUBLIC_FRONTEND_ORIGIN || 'http://localhost:5173';

function withCORS(res: NextResponse, methods = ['GET', 'PATCH']) {
  res.headers.set('Access-Control-Allow-Origin', PUBLIC_FRONTEND_ORIGIN);
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Access-Control-Allow-Methods', [...methods, 'OPTIONS'].join(','));
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.headers.set('Vary', 'Origin');                  // ให้ proxy แคชตาม origin
  res.headers.set('Cache-Control', 'no-store');       // ห้ามแคชข้อมูลส่วนตัว
  return res;
}

export async function OPTIONS() {
  return withCORS(new NextResponse(null, { status: 204 }), ['GET', 'PATCH']);
}

export async function GET(req: Request) {
  try {
    const me = await getUserFromRequest(req).catch(() => null);
    if (!me) {
      return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }));
    }

    const user = await prisma.user.findUnique({
      where: { id: me.id },
      select: {
        id: true,
        email: true,
        studentId: true,
        name: true,
        bio: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return withCORS(NextResponse.json({ message: 'NOT_FOUND' }, { status: 404 }));
    }
    return withCORS(NextResponse.json({ user }, { status: 200 }));
  } catch (err) {
    console.error('[ME GET]', err);
    return withCORS(NextResponse.json({ message: 'INTERNAL_ERROR' }, { status: 500 }));
  }
}

export async function PATCH(req: Request) {
  try {
    const me = await getUserFromRequest(req).catch(() => null);
    if (!me) {
      return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }));
    }

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? '').trim();
    const bio  = String(body?.bio  ?? '').trim();

    if (!name) {
      return withCORS(NextResponse.json({ message: 'NAME_REQUIRED' }, { status: 400 }));
    }

    const user = await prisma.user.update({
      where: { id: me.id },
      data: { name, bio },
      select: {
        id: true,
        email: true,
        studentId: true,
        name: true,
        bio: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return withCORS(NextResponse.json({ user }, { status: 200 }));
  } catch (err) {
    console.error('[ME PATCH]', err);
    return withCORS(NextResponse.json({ message: 'INTERNAL_ERROR' }, { status: 500 }));
  }
}

// app/api/me/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

const FE_ORIGIN = process.env.FE_ORIGIN || 'http://localhost:5173';
const withCORS = (res: NextResponse) => {
    res.headers.set('Access-Control-Allow-Origin', FE_ORIGIN);
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.headers.set('Access-Control-Allow-Methods', 'GET,PATCH,OPTIONS');
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    return res;
};

export async function OPTIONS() {
    return withCORS(new NextResponse(null, { status: 204 }));
}

export async function GET(req: Request) {
    const me = await getUserFromRequest(req).catch(() => null);
    if (!me) return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }));

    const user = await prisma.user.findUnique({
        where: { id: me.id },
        select: {
            id: true, email: true, studentId: true,
            name: true, bio: true, avatarUrl: true, role: true,
            updatedAt: true,
        }
    });
    if (!user) return withCORS(NextResponse.json({ message: 'NOT_FOUND' }, { status: 404 }));
    return withCORS(NextResponse.json({ user }));
}

export async function PATCH(req: Request) {
    const me = await getUserFromRequest(req).catch(() => null);
    if (!me) return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }));

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? '').trim();
    const bio = String(body?.bio ?? '').trim();
    if (!name) return withCORS(NextResponse.json({ message: 'NAME_REQUIRED' }, { status: 400 }));

    const user = await prisma.user.update({
        where: { id: me.id },
        data: { name, bio },
        select: {
            id: true, email: true, studentId: true,
            name: true, bio: true, avatarUrl: true, role: true,
            updatedAt: true,
        }
    });

    return withCORS(NextResponse.json({ user }));
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

const FE_ORIGIN = process.env.FE_ORIGIN || 'http://localhost:5173';
const withCORS = (res: NextResponse) => {
    res.headers.set('Access-Control-Allow-Origin', FE_ORIGIN);
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    return res;
};

export async function OPTIONS() {
    return withCORS(new NextResponse(null, { status: 204 }));
}

export async function POST(req: Request) {
    const me = await getUserFromRequest(req).catch(() => null);
    if (!me) return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }));

    const body = await req.json().catch(() => ({} as any));
    const avatarUrl = String(body?.avatarUrl || '').trim();
    if (!avatarUrl) {
        return withCORS(NextResponse.json({ message: 'AVATAR_URL_REQUIRED' }, { status: 400 }));
    }

    const user = await prisma.user.update({
        where: { id: me.id },
        data: { avatarUrl },
        select: { id: true, avatarUrl: true, updatedAt: true },
    });

    return withCORS(NextResponse.json({ user }));
}

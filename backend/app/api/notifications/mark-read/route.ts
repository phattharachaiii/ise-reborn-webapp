// app/api/notifications/mark-read/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

const PUBLIC_FRONTEND_ORIGIN = process.env.PUBLIC_FRONTEND_ORIGIN || 'http://localhost:5173';
function withCORS(res: NextResponse) {
    res.headers.set('Access-Control-Allow-Origin', PUBLIC_FRONTEND_ORIGIN);
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.headers.set('Access-Control-Allow-Methods', 'PATCH,OPTIONS');
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    return res;
}
export async function OPTIONS() { return withCORS(new NextResponse(null, { status: 204 })); }

export async function PATCH(req: Request) {
    const me = await getUserFromRequest(req).catch(() => null);
    if (!me) return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }));

    const { ids } = await req.json().catch(() => ({ ids: [] as string[] }));
    if (!Array.isArray(ids) || ids.length === 0) {
        return withCORS(NextResponse.json({ ok: true })); // เงียบ ๆ ก็ได้
    }
    await prisma.notification.updateMany({
        where: { id: { in: ids }, userId: me.id },
        data: { isRead: true }
    });
    return withCORS(NextResponse.json({ ok: true }));
}

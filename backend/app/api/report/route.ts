import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

const FE_ORIGIN = process.env.FE_ORIGIN || 'http://localhost:5173';
const withCORS = (res: NextResponse) => {
    res.headers.set('Access-Control-Allow-Origin', FE_ORIGIN);
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    return res;
};

export async function OPTIONS() {
    return withCORS(new NextResponse(null, { status: 204 }));
}

/** GET /api/reports (admin only) */
export async function GET(req: Request) {
    const me = await getUserFromRequest(req).catch(() => null);
    if (!me || me.role !== 'ADMIN') {
        return withCORS(NextResponse.json({ message: 'FORBIDDEN' }, { status: 403 }));
    }
    const reports = await prisma.report.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            reporter: { select: { id: true, name: true, email: true } },
            targetUser: { select: { id: true, name: true, email: true } },
            listing: { select: { id: true, title: true } }
        }
    });
    return withCORS(NextResponse.json({ reports }));
}

/** POST /api/reports  (user) */
export async function POST(req: Request) {
    const me = await getUserFromRequest(req).catch(() => null);
    if (!me) return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }));

    const body = await req.json().catch(() => null);
    if (!body) return withCORS(NextResponse.json({ message: 'BAD_JSON' }, { status: 400 }));

    const { targetUserId, listingId, reason } = body as {
        targetUserId?: string; listingId?: string; reason?: string;
    };
    if (!reason || reason.trim().length < 5) {
        return withCORS(NextResponse.json({ message: 'REASON_TOO_SHORT' }, { status: 400 }));
    }

    const report = await prisma.report.create({
        data: {
            reporterId: me.id,
            targetUserId: targetUserId || null,
            listingId: listingId || null,
            reason: reason.trim(),
        }
    });

    return withCORS(NextResponse.json({ report }, { status: 201 }));
}

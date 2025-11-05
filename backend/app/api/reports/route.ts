// backend/app/api/reports/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

const FE_ORIGIN = process.env.FE_ORIGIN || 'http://localhost:5173';

const withCORS = (res: NextResponse, allow: string[] = ['GET', 'POST', 'OPTIONS']) => {
    res.headers.set('Access-Control-Allow-Origin', FE_ORIGIN);
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.headers.set('Access-Control-Allow-Methods', allow.join(','));
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    return res;
};

export function OPTIONS() {
    return withCORS(NextResponse.json({ ok: true }));
}

// GET /api/reports  (ADMIN only)
export async function GET(req: NextRequest) {
    const me = await getUserFromRequest(req).catch(() => null);
    if (!me || me.role !== 'ADMIN') {
        return withCORS(NextResponse.json({ message: 'FORBIDDEN' }, { status: 403 }));
    }

    const url = new URL(req.url);
    const take = Math.min(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 200);

    const items = await prisma.report.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        include: {
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            targetUser: {
                select: { id: true, name: true, email: true, avatarUrl: true, accountStatus: true }
            },
        },
    });

    return withCORS(NextResponse.json({ items }));
}

// POST /api/reports
// body: { targetUserId: string; reason: string; details?: string; evidenceImageUrls?: string[] }
export async function POST(req: NextRequest) {
    const me = await getUserFromRequest(req).catch(() => null);
    if (!me) return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }));

    const body = await req.json().catch(() => null);
    if (!body) return withCORS(NextResponse.json({ message: 'BAD_JSON' }, { status: 400 }));

    const targetUserId = String(body.targetUserId || '').trim();
    const reason = String(body.reason || '').trim();
    const details = body.details ? String(body.details) : undefined;
    const evidenceImageUrls: string[] = Array.isArray(body.evidenceImageUrls) ? body.evidenceImageUrls.filter(Boolean) : [];

    if (!targetUserId || !reason) {
        return withCORS(NextResponse.json({ message: 'MISSING_FIELDS' }, { status: 400 }));
    }
    if (targetUserId === me.id) {
        return withCORS(NextResponse.json({ message: 'CANNOT_REPORT_SELF' }, { status: 400 }));
    }

    const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
    if (!target) return withCORS(NextResponse.json({ message: 'USER_NOT_FOUND' }, { status: 404 }));

    const data: any = { authorId: me.id, targetUserId, reason, details };
    if (evidenceImageUrls.length) data.evidenceImageUrls = evidenceImageUrls;

    try {
        const report = await prisma.report.create({
            data,
            select: {
                id: true, reason: true, details: true, createdAt: true,
                evidenceImageUrls: true,
                author: { select: { id: true, name: true } },
                targetUser: { select: { id: true, name: true } },
                status: true, resolution: true,
            }
        });
        return withCORS(NextResponse.json({ report }, { status: 201 }), ['POST', 'OPTIONS']);
    } catch (e: any) {
        if (String(e?.message || '').includes('Unknown arg `evidenceImageUrls`')) {
            return withCORS(NextResponse.json({ message: 'SERVER_SCHEMA_MISMATCH_RUN_MIGRATE' }, { status: 500 }));
        }
        console.error('REPORT_CREATE_ERROR', e);
        return withCORS(NextResponse.json({ message: 'SERVER_ERROR' }, { status: 500 }));
    }
}

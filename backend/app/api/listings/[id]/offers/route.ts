// app/api/listings/[id]/offers/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import type { OfferStatus } from '@prisma/client';

const FE_ORIGIN = process.env.FE_ORIGIN || 'http://localhost:5173';
const withCORS = (res: NextResponse) => {
    res.headers.set('Access-Control-Allow-Origin', FE_ORIGIN);
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.headers.set('Access-Control-Allow-Credentials', 'true'); // ✅ สำคัญ
    return res;
};

type RouteContext = { params: Promise<{ id: string }> };

export async function OPTIONS() {
    // 204 preflight
    return withCORS(new NextResponse(null, { status: 204 }));
}

export async function GET(req: Request, { params }: RouteContext) {
    try {
        const me = await getUserFromRequest(req).catch(() => null);
        if (!me) return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }));

        const { id } = await params;

        const listing = await prisma.listing.findUnique({ where: { id } });
        if (!listing) return withCORS(NextResponse.json({ message: 'NOT_FOUND' }, { status: 404 }));
        if (listing.sellerId !== me.id && me.role !== 'ADMIN') {
            return withCORS(NextResponse.json({ message: 'FORBIDDEN' }, { status: 403 }));
        }

        // --- query params ---
        const url = new URL(req.url);
        const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10), 1), 100);
        const cursor = url.searchParams.get('cursor') || undefined;
        const s = (url.searchParams.get('status') || '').toUpperCase();
        const statusFilter = (['REQUESTED', 'ACCEPTED', 'REJECTED', 'REOFFER', 'COMPLETED'] as OfferStatus[])
            .includes(s as OfferStatus) ? (s as OfferStatus) : undefined;

        const where: any = { listingId: id };
        if (statusFilter) where.status = statusFilter;

        const rows = await prisma.offer.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            select: {
                id: true, status: true, meetPlace: true, meetTime: true,
                note: true, rejectReason: true, lastActor: true, qrToken: true,
                createdAt: true, updatedAt: true,
                buyer: { select: { id: true, name: true, avatarUrl: true } },
            }
        });

        let nextCursor: string | null = null;
        if (rows.length > limit) nextCursor = rows[rows.length - 1].id;

        return withCORS(NextResponse.json({ offers: rows.slice(0, limit), nextCursor }));
    } catch (e: any) {
        // กัน server throw ทำให้เบราว์เซอร์เห็นเป็น "Failed to fetch"
        return withCORS(NextResponse.json({ message: 'INTERNAL_ERROR', detail: String(e?.message ?? e) }, { status: 500 }));
    }
}

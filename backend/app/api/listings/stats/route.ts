// app/api/listings/stats/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { ListingStatus } from '@prisma/client';

export const runtime = 'nodejs';

const FE_ORIGIN = process.env.FE_ORIGIN || 'http://localhost:5173';
function withCORS(res: NextResponse, methods: string[] = ['GET']) {
    res.headers.set('Access-Control-Allow-Origin', FE_ORIGIN);
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.headers.set('Access-Control-Allow-Methods', [...methods, 'OPTIONS'].join(','));
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    res.headers.set('Cache-Control', 'no-store');
    res.headers.set('Vary', 'Origin');
    return res;
}

export async function OPTIONS() {
    return withCORS(new NextResponse(null, { status: 204 }), ['GET']);
}

export async function GET(req: Request) {
    const url = new URL(req.url);
    const mine = /^(1|true)$/i.test(url.searchParams.get('mine') || '');

    const me = await getUserFromRequest(req).catch(() => null);
    if (mine && !me) {
        return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }));
    }

    const whereBase: any = mine && me ? { sellerId: me.id } : {};

    const [all, active, sold] = await Promise.all([
        prisma.listing.count({ where: whereBase }),
        prisma.listing.count({ where: { ...whereBase, status: ListingStatus.ACTIVE } }),
        prisma.listing.count({ where: { ...whereBase, status: ListingStatus.SOLD } })
    ]);

    return withCORS(NextResponse.json({ all, active, sold }));
}

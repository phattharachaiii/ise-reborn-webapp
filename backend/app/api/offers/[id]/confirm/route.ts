// app/api/offers/[id]/confirm/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PUBLIC_FRONTEND_ORIGIN = process.env.PUBLIC_FRONTEND_ORIGIN || 'http://localhost:5173';

function withCORS(res: NextResponse, methods: string[] = ['POST']) {
    res.headers.set('Access-Control-Allow-Origin', PUBLIC_FRONTEND_ORIGIN);
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    res.headers.set('Access-Control-Allow-Methods', [...methods, 'OPTIONS'].join(','));
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.headers.set('Vary', 'Origin');
    res.headers.set('Cache-Control', 'no-store');
    return res;
}

export async function OPTIONS() {
    return withCORS(new NextResponse(null, { status: 204 }));
}

// app/api/offers/[id]/confirm/route.ts

// ...import ต่าง ๆ เหมือนเดิม...

export async function POST(req: Request, context: any) {
    // ดึง id จาก params แบบ cast ภายใน
    const { id } = (context as { params: { id: string } }).params;

    const me = await getUserFromRequest(req).catch(() => null);
    if (!me) return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }));

    const body = await req.json().catch(() => ({} as any));
    const token = String((body as any)?.token || '').trim();
    if (!token) return withCORS(NextResponse.json({ message: 'MISSING_TOKEN' }, { status: 400 }));

    const offer = await prisma.offer.findUnique({
        where: { id },
        include: { listing: true }
    });
    if (!offer) return withCORS(NextResponse.json({ message: 'NOT_FOUND' }, { status: 404 }));

    if (offer.buyerId !== me.id) return withCORS(NextResponse.json({ message: 'FORBIDDEN' }, { status: 403 }));
    if (offer.status !== 'ACCEPTED') return withCORS(NextResponse.json({ message: 'INVALID_STATE' }, { status: 400 }));
    if (offer.qrToken !== token) return withCORS(NextResponse.json({ message: 'INVALID_TOKEN' }, { status: 400 }));

    const updated = await prisma.$transaction(async (tx) => {
        const uOffer = await tx.offer.update({
            where: { id: offer.id },
            data: { status: 'COMPLETED', qrScannedAt: new Date() }
        });
        await tx.listing.update({
            where: { id: offer.listingId },
            data: { status: 'SOLD' }
        });
        return uOffer;
    });

    await prisma.notification.create({
        data: {
            userId: offer.sellerId,
            type: 'OFFER_COMPLETED',
            offerId: offer.id,
            listingId: offer.listingId,
            title: 'ออเดอร์สำเร็จ',
            message: `${offer.listing.title} ถูกปิดการขายแล้ว`
        }
    });

    await prisma.$executeRawUnsafe(
        `SELECT pg_notify('noti', json_build_object('userId','${offer.sellerId}','event','OFFER_COMPLETED')::text)`
    );

    return withCORS(NextResponse.json({ offer: updated }));
}


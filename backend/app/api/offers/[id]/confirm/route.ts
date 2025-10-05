// app/api/offers/[id]/confirm/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

const FE_ORIGIN = process.env.FE_ORIGIN || 'http://localhost:5173';
const withCORS = (res: NextResponse) => { /* ... */ return res; };

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
    const me = await getUserFromRequest(req).catch(() => null);
    if (!me) return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }));

    const body = await req.json().catch(() => ({}));
    const { token } = body as { token?: string };
    if (!token) return withCORS(NextResponse.json({ message: 'MISSING_TOKEN' }, { status: 400 }));

    const offer = await prisma.offer.findUnique({ where: { id: params.id }, include: { listing: true } });
    if (!offer) return withCORS(NextResponse.json({ message: 'NOT_FOUND' }, { status: 404 }));

    // ต้องเป็นผู้ซื้อ และอยู่สถานะ ACCEPTED
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
            title: `ออเดอร์สำเร็จ`,
            message: `${offer.listing.title} ถูกปิดการขายแล้ว`
        }
    });
    await prisma.$executeRawUnsafe(`SELECT pg_notify('noti', json_build_object('userId','${offer.sellerId}','event','OFFER_COMPLETED')::text)`);

    return withCORS(NextResponse.json({ offer: updated }));
}

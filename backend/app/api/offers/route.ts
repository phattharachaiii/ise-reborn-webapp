import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { NotificationType } from '@prisma/client';

const FE_ORIGIN = process.env.FE_ORIGIN || 'http://localhost:5173';
const withCORS = (res: NextResponse) => {
    res.headers.set('Access-Control-Allow-Origin', FE_ORIGIN);
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.headers.set('Access-Control-Allow-Credentials', 'true')
    return res;
};

export async function OPTIONS() { return withCORS(NextResponse.json({ ok: true })); }

export async function POST(req: Request) {
    const me = await getUserFromRequest(req).catch(() => null);
    if (!me) return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }));

    const body = await req.json().catch(() => ({}));
    const { listingId, meetPlace, meetTime, note } = body as {
        listingId?: string; meetPlace?: string; meetTime?: string; note?: string;
    };

    if (!listingId || !meetPlace || !meetTime) {
        return withCORS(NextResponse.json({ message: 'MISSING_FIELDS' }, { status: 400 }));
    }

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) return withCORS(NextResponse.json({ message: 'NOT_FOUND' }, { status: 404 }));
    if (listing.sellerId === me.id) {
        return withCORS(NextResponse.json({ message: 'CANNOT_BUY_OWN' }, { status: 400 }));
    }

    const offer = await prisma.offer.create({
        data: {
            listingId,
            buyerId: me.id,
            sellerId: listing.sellerId,
            status: 'REQUESTED',
            meetPlace: String(meetPlace),
            meetTime: new Date(meetTime),
            note: note ?? null,
            lastActor: 'BUYER'
        }
    });

    // 🔔 Noti -> ผู้ขาย
    await prisma.notification.create({
        data: {
            userId: listing.sellerId,
            type: NotificationType.OFFER_REQUESTED, // หรือ OFFER_CREATED ถ้า schema คุณใช้ชื่อนี้
            offerId: offer.id,
            listingId: listing.id,
            title: 'มีคำขอซื้อใหม่',
            message: `${listing.title} นัด: ${offer.meetPlace} @ ${offer.meetTime.toLocaleString()}`
        }
    });
    // broadcast (Postgres LISTEN chan "noti")
    await prisma.$executeRawUnsafe(
        `SELECT pg_notify('noti', json_build_object('userId','${listing.sellerId}','event','OFFER_REQUESTED','offerId','${offer.id}','listingId','${listing.id}')::text)`
    );

    return withCORS(NextResponse.json({ offerId: offer.id }, { status: 201 }));
}

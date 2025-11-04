import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

const PUBLIC_FRONTEND_ORIGIN = process.env.PUBLIC_FRONTEND_ORIGIN || 'http://localhost:5173';
const withCORS = (res: NextResponse) => {
    res.headers.set('Access-Control-Allow-Origin', PUBLIC_FRONTEND_ORIGIN);
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    return res;
};

export async function OPTIONS() {
    return withCORS(new NextResponse(null, { status: 204 }));
}

// body: { token: string } หรือ { url: "reborn://offer/xxx?t=TOKEN" }
export async function POST(req: Request) {
    try {
        const me = await getUserFromRequest(req).catch(() => null);
        if (!me) return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }));

        const body = await req.json().catch(() => null);
        if (!body) return withCORS(NextResponse.json({ message: 'BAD_JSON' }, { status: 400 }));

        let token: string | null = null;
        if (body.token) token = String(body.token).trim();
        if (!token && body.url) {
            try {
                const u = new URL(String(body.url));
                token = u.searchParams.get('t');
            } catch { }
        }
        if (!token) return withCORS(NextResponse.json({ message: 'TOKEN_REQUIRED' }, { status: 400 }));

        const offer = await prisma.offer.findUnique({
            where: { qrToken: token },
            include: { listing: { select: { id: true, sellerId: true, status: true } } }
        });
        if (!offer) return withCORS(NextResponse.json({ message: 'INVALID_TOKEN' }, { status: 404 }));

        const isBuyer = me.id === offer.buyerId;
        const isAdmin = me.role === 'ADMIN';
        if (!isBuyer && !isAdmin) {
            return withCORS(NextResponse.json({ message: 'FORBIDDEN' }, { status: 403 }));
        }

        if (offer.status !== 'ACCEPTED') {
            return withCORS(NextResponse.json({ message: 'OFFER_NOT_ACCEPTED' }, { status: 409 }));
        }

        // ปิดดีล: Offer = COMPLETED, Listing = SOLD
        const [updatedOffer, _updatedListing, _notiSeller, _notiBuyer] = await prisma.$transaction([
            prisma.offer.update({
                where: { id: offer.id },
                data: { status: 'COMPLETED', qrScannedAt: new Date() }
            }),
            prisma.listing.update({
                where: { id: offer.listingId },
                data: { status: 'SOLD' }
            }),
            prisma.notification.create({
                data: {
                    userId: offer.sellerId,
                    type: 'OFFER_COMPLETED',
                    offerId: offer.id,
                    listingId: offer.listingId,
                    title: 'ดีลสำเร็จ',
                    message: 'ผู้ซื้อยืนยันหน้างานแล้ว'
                }
            }),
            prisma.notification.create({
                data: {
                    userId: offer.buyerId,
                    type: 'OFFER_COMPLETED',
                    offerId: offer.id,
                    listingId: offer.listingId,
                    title: 'ดีลสำเร็จ',
                    message: 'ขอบคุณที่ใช้บริการ'
                }
            }),
        ]);

        return withCORS(NextResponse.json({ offer: updatedOffer }));
    } catch (e: any) {
        return withCORS(NextResponse.json({ message: e?.message || 'COMPLETE_FAILED' }, { status: 500 }));
    }
}

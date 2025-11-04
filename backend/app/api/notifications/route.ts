// app/api/notifications/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

const PUBLIC_FRONTEND_ORIGIN = process.env.PUBLIC_FRONTEND_ORIGIN || 'http://localhost:5173';

function withCORS(res: NextResponse) {
    res.headers.set('Access-Control-Allow-Origin', PUBLIC_FRONTEND_ORIGIN);
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS'); // ✓ ถ้ามี mark-read แยก endpoint ค่อยเพิ่ม PATCH ที่ไฟล์นั้น
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    return res;
}

export async function OPTIONS() {
    // 204 + header ชุดเดียวกับของจริง
    return withCORS(new NextResponse(null, { status: 204 }));
}

type Audience = 'BUYER' | 'SELLER';
type NotificationOut = {
    id: string;
    title: string;
    message?: string | null;
    listingId?: string | null;
    offerId?: string | null;
    createdAt: Date;
    isRead: boolean;
    audience?: Audience;
};

export async function GET(req: Request) {
    const me = await getUserFromRequest(req).catch(() => null);
    if (!me) {
        return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }));
    }

    const url = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '10', 10), 1), 50);

    // side=buyer|seller (ถ้าไม่ส่ง ถือว่า all แล้วไปแยกให้ฝั่ง FE)
    const sideParam = (url.searchParams.get('side') || 'all').toLowerCase();
    const filterSide: 'buyer' | 'seller' | 'all' =
        sideParam === 'buyer' || sideParam === 'seller' ? sideParam : 'all';

    // ดึง noti ล่าสุดของผู้ใช้ (ยังไม่ฟิลเตอร์ buyer/seller ใน DB — จะคำนวณในขั้นตอน map)
    const [rawItems, unreadTotal] = await Promise.all([
        prisma.notification.findMany({
            where: { userId: me.id },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
                id: true,
                title: true,
                message: true,
                listingId: true,
                offerId: true, // ← สำคัญ เพื่อให้ FE ลิงก์ไป /offers/[id] ได้
                createdAt: true,
                isRead: true
            }
        }),
        prisma.notification.count({ where: { userId: me.id, isRead: false } })
    ]);

    // เตรียมแผนที่ offerId -> { buyerId, sellerId, listingId }
    const offerIds = rawItems.map(i => i.offerId).filter(Boolean) as string[];
    let offerMap: Record<string, { buyerId: string; sellerId: string; listingId: string }> = {};
    if (offerIds.length > 0) {
        const offers = await prisma.offer.findMany({
            where: { id: { in: offerIds } },
            select: { id: true, buyerId: true, sellerId: true, listingId: true }
        });
        offerMap = Object.fromEntries(
            offers.map(o => [o.id, { buyerId: o.buyerId, sellerId: o.sellerId, listingId: o.listingId }])
        );
    }

    // เตรียมแผนที่ listingId -> { sellerId } (รองรับ noti ที่ผูก listing โดยตรงและไม่มี offer)
    const listingIdsDirect = rawItems.map(i => i.listingId).filter(Boolean) as string[];
    // รวม listingId ที่ได้มาจาก offerMap ด้วย (ป้องกันกรณี noti ไม่มี listingId แต่ offer มี)
    const listingIdsFromOffers = Object.values(offerMap).map(o => o.listingId);
    const allListingIds = Array.from(new Set([...listingIdsDirect, ...listingIdsFromOffers]));
    let listingMap: Record<string, { sellerId: string }> = {};
    if (allListingIds.length > 0) {
        const listings = await prisma.listing.findMany({
            where: { id: { in: allListingIds } },
            select: { id: true, sellerId: true }
        });
        listingMap = Object.fromEntries(listings.map(l => [l.id, { sellerId: l.sellerId }]));
    }

    // สร้าง items ส่งออก: เติม listingId จาก offer ถ้าหาย, และคำนวณ audience จาก offer/listing
    const computed: NotificationOut[] = rawItems.map((n) => {
        // เติม listingId จาก offer หาก noti ไม่มี listingId
        const listingId = n.listingId ?? (n.offerId ? offerMap[n.offerId!]?.listingId : undefined) ?? null;

        let audience: Audience | undefined;
        if (n.offerId && offerMap[n.offerId]) {
            // ถ้าเป็น noti ของดีล ให้ดูว่าเราเป็น buyer หรือ seller ในดีลนี้
            audience = offerMap[n.offerId].buyerId === me.id ? 'BUYER' : 'SELLER';
        } else if (listingId && listingMap[listingId]) {
            // ถ้าเป็น noti ของ listing โดยตรง → ถือเป็นแจ้งฝั่งผู้ขายของ listing นั้น
            if (listingMap[listingId].sellerId === me.id) audience = 'SELLER';
        }

        return {
            id: n.id,
            title: n.title,
            message: n.message ?? null,
            offerId: n.offerId ?? null,               // <— บังคับ null
            listingId: listingId ?? null,             // <— บังคับ null
            createdAt: n.createdAt,
            isRead: n.isRead,
            audience
        };
    });

    // ฟิลเตอร์ตาม ?side=...
    const items =
        filterSide === 'all'
            ? computed
            : computed.filter((it) => it.audience === (filterSide === 'buyer' ? 'BUYER' : 'SELLER'));

    return withCORS(NextResponse.json({ items, unread: unreadTotal }, { status: 200 }));
}

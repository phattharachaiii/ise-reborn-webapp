import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { withCORS, preflight } from '@lib/_utils/cors';
export const runtime = 'nodejs';

const FE_ALLOW = process.env.FE_ORIGIN || 'http://localhost:5173';

export async function OPTIONS(req: Request) {
    return preflight(req);
}

/**
 * GET /api/offers/mine?role=buyer|seller|all&status=...&q=...
 * - role: ค่าปริยาย all (ดึงทั้งที่เป็นผู้ซื้อและผู้ขาย)
 * - status: OPTIONAL (REQUESTED|REOFFER|ACCEPTED|COMPLETED|REJECTED|CANCELLED)
 * - q: OPTIONAL (ค้นหาจากชื่อสินค้า, ชื่อคู่สนทนา, สถานที่)
 */
export async function GET(req: Request) {
    const me = await getUserFromRequest(req).catch(() => null);
    if (!me) return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }), req);

    const url = new URL(req.url);
    const role = (url.searchParams.get('role') || 'all').toLowerCase();
    const status = url.searchParams.get('status') || '';
    const q = (url.searchParams.get('q') || '').trim();

    const whereCommon: any = {};
    if (status) whereCommon.status = status.toUpperCase();

    // สร้างเงื่อนไขการค้นหา 'q' แยกไว้
    const whereForQ: any = {};
    if (q) {
        whereForQ.OR = [
            { listing: { title: { contains: q, mode: 'insensitive' } } },
            { meetPlace: { contains: q, mode: 'insensitive' } },
            { buyer: { name: { contains: q, mode: 'insensitive' } } },
            { seller: { name: { contains: q, mode: 'insensitive' } } },
        ];
    }

    let items = [];

    // สร้าง Option ที่ใช้ร่วมกันสำหรับทุก Query
    const findOptions = {
        include: {
            listing: { select: { id: true, title: true, price: true, imageUrls: true, status: true } },
            buyer: { select: { id: true, name: true, avatarUrl: true } },
            seller: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { updatedAt: 'desc' } as const
    };

    if (role === 'buyer') {
        // Query เร็ว (ยิง Index เดียว)
        items = await prisma.offer.findMany({
            where: { ...whereCommon, ...whereForQ, buyerId: me.id },
            ...findOptions,
        });
    } else if (role === 'seller') {
        // Query เร็ว (ยิง Index เดียว)
        items = await prisma.offer.findMany({
            where: { ...whereCommon, ...whereForQ, sellerId: me.id },
            ...findOptions,
        });
    } else {
        // แก้ปัญหา Query 'OR' (role === 'all') โดยการรัน 2 Query ที่เร็วกว่า

        // 1. รัน 2 query ที่เร็ว (ยิงเข้า Index ตรงๆ) พร้อมกัน
        const buyerOffers = prisma.offer.findMany({
            where: { ...whereCommon, ...whereForQ, buyerId: me.id },
            ...findOptions,
        });
        const sellerOffers = prisma.offer.findMany({
            where: { ...whereCommon, ...whereForQ, sellerId: me.id },
            ...findOptions,
        });

        // 2. รอให้เสร็จพร้อมกัน
        const [buyerItems, sellerItems] = await Promise.all([buyerOffers, sellerOffers]);

        // 3. รวมผลลัพธ์ใน JS และ Sort ใหม่อีกครั้ง
        items = [...buyerItems, ...sellerItems];
        items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }

    // ใส่ role ฝั่งเราลงไปเพื่อใช้บน FE
    const mapped = items.map((o) => ({
        ...o,
        myRole: o.buyerId === me.id ? 'BUYER' : 'SELLER',
        counterpart: o.buyerId === me.id ? o.seller : o.buyer,
    }));

    return withCORS(NextResponse.json({ items: mapped }), req);
}
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

const FE_ORIGIN = process.env.FE_ORIGIN || 'http://localhost:5173';
const withCORS = (res: NextResponse) => {
    res.headers.set('Access-Control-Allow-Origin', FE_ORIGIN);
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    return res;
};
export async function OPTIONS() {
    return withCORS(new NextResponse(null, { status: 204 }));
}

/**
 * GET /api/offers/mine?role=buyer|seller|all&status=...&q=...
 * - role: ค่าปริยาย all (ดึงทั้งที่เป็นผู้ซื้อและผู้ขาย)
 * - status: OPTIONAL (REQUESTED|REOFFER|ACCEPTED|COMPLETED|REJECTED|CANCELLED)
 * - q: OPTIONAL (ค้นหาจากชื่อสินค้า, ชื่อคู่สนทนา, สถานที่)
 */
export async function GET(req: Request) {
    const me = await getUserFromRequest(req).catch(() => null);
    if (!me) return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }));

    const url = new URL(req.url);
    const role = (url.searchParams.get('role') || 'all').toLowerCase(); // buyer|seller|all
    const status = url.searchParams.get('status') || '';
    const q = (url.searchParams.get('q') || '').trim();

    const whereCommon: any = {};
    if (status) whereCommon.status = status.toUpperCase();

    // ค้นหาแบบหลวม ๆ
    if (q) {
        whereCommon.OR = [
            { listing: { title: { contains: q, mode: 'insensitive' } } },
            { meetPlace: { contains: q, mode: 'insensitive' } },
            { buyer: { name: { contains: q, mode: 'insensitive' } } },
            { seller: { name: { contains: q, mode: 'insensitive' } } },
        ];
    }

    let where: any;
    if (role === 'buyer') where = { ...whereCommon, buyerId: me.id };
    else if (role === 'seller') where = { ...whereCommon, sellerId: me.id };
    else where = { ...whereCommon, OR: [{ buyerId: me.id }, { sellerId: me.id }] };

    const items = await prisma.offer.findMany({
        where,
        include: {
            listing: { select: { id: true, title: true, price: true, imageUrls: true, status: true } },
            buyer: { select: { id: true, name: true, avatarUrl: true } },
            seller: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 100, // ปรับตามใจ
    });

    // ใส่ role ฝั่งเราลงไปเพื่อใช้บน FE
    const mapped = items.map((o) => ({
        ...o,
        myRole: o.buyerId === me.id ? 'BUYER' : 'SELLER',
        counterpart: o.buyerId === me.id ? o.seller : o.buyer,
    }));

    return withCORS(NextResponse.json({ items: mapped }));
}

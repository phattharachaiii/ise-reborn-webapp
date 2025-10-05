import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { Category, Condition, ListingStatus } from '@prisma/client';

const FE_ORIGIN = process.env.FE_ORIGIN || 'http://localhost:5173';

function withCORS(res: NextResponse) {
    res.headers.set('Access-Control-Allow-Origin', FE_ORIGIN);
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.headers.set('Access-Control-Allow-Methods', 'GET,PATCH,DELETE,OPTIONS');
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    return res;
}

export async function OPTIONS() {
    return withCORS(new NextResponse(null, { status: 204 }));
}

type Ctx = { params: Promise<{ id: string }> };

/* ---------- GET /api/listings/[id] ---------- */
export async function GET(req: Request, { params }: Ctx) {
    const { id } = await params;
    const me = await getUserFromRequest(req).catch(() => null);

    const listing = await prisma.listing.findUnique({
        where: { id },
        include: {
            seller: { select: { id: true, name: true, avatarUrl: true } }
        }
    });
    if (!listing) {
        return withCORS(NextResponse.json({ message: 'NOT_FOUND' }, { status: 404 }));
    }

    // ควบคุมการมองเห็น meetPlace:
    // - เจ้าของหรือแอดมิน เห็นแน่นอน
    // - ผู้ใช้ที่ล็อกอินทั่วไป “เห็น” (ผู้ซื้อเท่านั้น) — ผู้เยี่ยมชมที่ไม่ล็อกอิน ไม่เห็น
    let meetPlace: string | null = listing.meetPlace ?? null;
    const isOwner = !!(me && me.id === listing.sellerId);
    const isAdmin = me?.role === 'ADMIN';
    const isLoggedInBuyer = !!(me && !isOwner); // อนุมานว่าเป็นผู้ซื้อที่ล็อกอิน
    if (!isOwner && !isAdmin && !isLoggedInBuyer) {
        meetPlace = null;
    }

    return withCORS(NextResponse.json({
        listing: {
            ...listing,
            meetPlace,
        }
    }));
}

/* ---------- PATCH /api/listings/[id] ---------- */
export async function PATCH(req: Request, { params }: Ctx) {
    const { id } = await params;

    const me = await getUserFromRequest(req).catch(() => null);
    if (!me) return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }));

    const found = await prisma.listing.findUnique({ where: { id } });
    if (!found) {
        return withCORS(NextResponse.json({ message: 'NOT_FOUND' }, { status: 404 }));
    }
    if (found.sellerId !== me.id && me.role !== 'ADMIN') {
        return withCORS(NextResponse.json({ message: 'FORBIDDEN' }, { status: 403 }));
    }

    const body = await req.json().catch(() => ({} as any));
    const data: any = {};

    if (body.title !== undefined) {
        const t = String(body.title).trim();
        if (!t) return withCORS(NextResponse.json({ message: 'TITLE_REQUIRED' }, { status: 400 }));
        data.title = t;
    }
    if (body.description !== undefined) data.description = String(body.description);
    if (body.price !== undefined) {
        const p = Number(body.price);
        if (!Number.isFinite(p) || p <= 0) {
            return withCORS(NextResponse.json({ message: 'INVALID_PRICE' }, { status: 400 }));
        }
        data.price = p;
    }
    if (body.condition !== undefined) {
        const c = String(body.condition).toUpperCase();
        if (!Object.values(Condition).includes(c as Condition)) {
            return withCORS(NextResponse.json({ message: 'INVALID_CONDITION' }, { status: 400 }));
        }
        data.condition = c as Condition;
    }
    if (body.category !== undefined) {
        const cat = String(body.category).toUpperCase();
        if (!Object.values(Category).includes(cat as Category)) {
            return withCORS(NextResponse.json({ message: 'INVALID_CATEGORY' }, { status: 400 }));
        }
        data.category = cat as Category;
    }
    if (body.status !== undefined) {
        const st = String(body.status).toUpperCase();
        if (!Object.values(ListingStatus).includes(st as ListingStatus)) {
            return withCORS(NextResponse.json({ message: 'INVALID_STATUS' }, { status: 400 }));
        }
        data.status = st as ListingStatus;
    }
    if (body.meetPlace !== undefined) {
        data.meetPlace = String(body.meetPlace || '').trim() || null;
    }

    const listing = await prisma.listing.update({
        where: { id },
        data,
        include: { seller: { select: { id: true, name: true, avatarUrl: true } } }
    });

    return withCORS(NextResponse.json({ listing }));
}

/* ---------- DELETE /api/listings/[id] ---------- */
export async function DELETE(req: Request, { params }: Ctx) {
    const { id } = await params;

    const me = await getUserFromRequest(req).catch(() => null);
    if (!me) return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }));

    const found = await prisma.listing.findUnique({ where: { id } });
    if (!found) {
        return withCORS(NextResponse.json({ message: 'NOT_FOUND' }, { status: 404 }));
    }
    if (found.sellerId !== me.id && me.role !== 'ADMIN') {
        return withCORS(NextResponse.json({ message: 'FORBIDDEN' }, { status: 403 }));
    }

    await prisma.listing.delete({ where: { id } });
    return withCORS(NextResponse.json({ ok: true }));
}

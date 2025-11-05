// backend/app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const FE_ORIGIN = process.env.FE_ORIGIN || 'http://localhost:5173';

const withCORS = (res: NextResponse, allow: string[] = ['GET', 'OPTIONS']) => {
    res.headers.set('Access-Control-Allow-Origin', FE_ORIGIN);
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.headers.set('Access-Control-Allow-Methods', allow.join(','));
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    return res;
};

type Ctx = { params: Promise<{ id: string }> };

export function OPTIONS() {
    return withCORS(NextResponse.json({ ok: true }));
}

export async function GET(req: NextRequest, ctx: Ctx) {
    const id = (await ctx.params).id;

    const user = await prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            avatarUrl: true,
            bio: true,
            accountStatus: true,
            createdAt: true,
        },
    });

    if (!user) {
        return withCORS(NextResponse.json({ message: 'USER_NOT_FOUND' }, { status: 404 }));
    }

    const counts = await prisma.listing.aggregate({
        _count: { _all: true },
        where: { sellerId: id, status: { not: 'SOLD' } },
    });

    return withCORS(
        NextResponse.json({ user, stats: { activeListings: counts._count._all } })
    );
}

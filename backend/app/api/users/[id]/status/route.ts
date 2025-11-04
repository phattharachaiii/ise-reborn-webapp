import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { AccountStatus } from '@prisma/client';

const PUBLIC_FRONTEND_ORIGIN = process.env.PUBLIC_FRONTEND_ORIGIN || 'http://localhost:5173';
const withCORS = (res: NextResponse) => {
    res.headers.set('Access-Control-Allow-Origin', PUBLIC_FRONTEND_ORIGIN);
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.headers.set('Access-Control-Allow-Methods', 'PATCH,OPTIONS');
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    return res;
};

type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS() {
    return withCORS(new NextResponse(null, { status: 204 }));
}

export async function PATCH(req: Request, { params }: Ctx) {
    const { id } = await params;
    const me = await getUserFromRequest(req).catch(() => null);
    if (!me || me.role !== 'ADMIN') {
        return withCORS(NextResponse.json({ message: 'FORBIDDEN' }, { status: 403 }));
    }

    const body = await req.json().catch(() => null);
    if (!body) return withCORS(NextResponse.json({ message: 'BAD_JSON' }, { status: 400 }));

    const status = String(body.status || '').toUpperCase();
    if (!Object.values(AccountStatus).includes(status as AccountStatus)) {
        return withCORS(NextResponse.json({ message: 'INVALID_ACCOUNT_STATUS' }, { status: 400 }));
    }

    const user = await prisma.user.update({
        where: { id },
        data: { accountStatus: status as AccountStatus },
        select: { id: true, name: true, email: true, accountStatus: true }
    });

    return withCORS(NextResponse.json({ user }));
}

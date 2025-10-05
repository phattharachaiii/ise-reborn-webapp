import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

const FE_ORIGIN = process.env.FE_ORIGIN || 'http://localhost:5173';
const withCORS = (res: NextResponse) => {
    res.headers.set('Access-Control-Allow-Origin', FE_ORIGIN);
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
    const allowed = ['OPEN', 'REVIEWING', 'RESOLVED', 'REJECTED'];
    if (!allowed.includes(status)) {
        return withCORS(NextResponse.json({ message: 'INVALID_STATUS' }, { status: 400 }));
    }

    const report = await prisma.report.update({
        where: { id },
        data: { status },
    });

    return withCORS(NextResponse.json({ report }));
}

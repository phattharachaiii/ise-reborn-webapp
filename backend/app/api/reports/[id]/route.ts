import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

// --- CORS helper (ถ้าคุณเรียกข้ามพอร์ต) ---
const FE_ORIGIN = process.env.FE_ORIGIN || 'http://localhost:5173';
function withCORS(res: NextResponse, allow: string[] = ['GET', 'PATCH', 'OPTIONS']) {
    res.headers.set('Access-Control-Allow-Origin', FE_ORIGIN);
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.headers.set('Access-Control-Allow-Methods', allow.join(','));
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    return res;
}

export function OPTIONS() {
    return withCORS(NextResponse.json({ ok: true }));
}

// map resolution -> account status
const resolutionToAccountStatus: Record<'UNBAN' | 'TEMPSUSPEND' | 'SUSPEND', 'ACTIVE' | 'TEMPSUSPEND' | 'SUSPENDED'> = {
    UNBAN: 'ACTIVE',
    TEMPSUSPEND: 'TEMPSUSPEND',
    SUSPEND: 'SUSPENDED',
};

// GET /api/reports/[id]
export async function GET(
    _req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const me = await getUserFromRequest(_req as any).catch(() => null);
        if (!me || me.role !== 'ADMIN') {
            return withCORS(NextResponse.json({ message: 'FORBIDDEN' }, { status: 403 }));
        }

        const rep = await prisma.report.findUnique({
            where: { id: params.id },
            include: {
                author: { select: { id: true, name: true, email: true, avatarUrl: true } },
                targetUser: { select: { id: true, name: true, email: true, avatarUrl: true, accountStatus: true } },
                logs: {
                    orderBy: { createdAt: 'desc' },
                    include: { actor: { select: { id: true, name: true } } },
                },
                resolvedBy: { select: { id: true, name: true } },
            },
        });

        if (!rep) {
            return withCORS(NextResponse.json({ message: 'NOT_FOUND' }, { status: 404 }));
        }

        return withCORS(NextResponse.json({ report: rep }));
    } catch (e: any) {
        return withCORS(NextResponse.json({ message: e?.message || 'Server error' }, { status: 500 }));
    }
}

// PATCH /api/reports/[id]
// body:
// - ตัดสินครั้งแรก: { resolution: 'UNBAN'|'TEMPSUSPEND'|'SUSPEND', note: string }
// - เปลี่ยนคำตัดสิน: { resolution: 'UNBAN'|'TEMPSUSPEND'|'SUSPEND', changeReason: string }
export async function PATCH(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const me = await getUserFromRequest(req as any).catch(() => null);
        if (!me || me.role !== 'ADMIN') {
            return withCORS(NextResponse.json({ message: 'FORBIDDEN' }, { status: 403 }));
        }

        const body = await req.json().catch(() => ({}));
        const { resolution, note, changeReason } = body as {
            resolution?: 'UNBAN' | 'TEMPSUSPEND' | 'SUSPEND';
            note?: string;
            changeReason?: string;
        };

        if (!resolution || !['UNBAN', 'TEMPSUSPEND', 'SUSPEND'].includes(resolution)) {
            return withCORS(NextResponse.json({ message: 'INVALID_RESOLUTION' }, { status: 400 }));
        }

        const rep = await prisma.report.findUnique({
            where: { id: params.id },
            include: { targetUser: true },
        });
        if (!rep) {
            return withCORS(NextResponse.json({ message: 'NOT_FOUND' }, { status: 404 }));
        }

        const now = new Date();

        // ตัดสินครั้งแรก
        if (rep.status === 'PENDING') {
            if (!note || !note.trim()) {
                return withCORS(NextResponse.json({ message: 'NOTE_REQUIRED' }, { status: 400 }));
            }

            const updated = await prisma.$transaction(async (tx) => {
                // อัปเดตสถานะ user
                await tx.user.update({
                    where: { id: rep.targetUserId },
                    data: { accountStatus: resolutionToAccountStatus[resolution] },
                });

                // อัปเดตรายงาน
                const r = await tx.report.update({
                    where: { id: rep.id },
                    data: {
                        status: 'RESOLVED',
                        resolution,
                        resolutionNote: note,
                        resolvedById: me.id,
                        resolvedAt: now,
                    },
                    include: {
                        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
                        targetUser: { select: { id: true, name: true, email: true, avatarUrl: true, accountStatus: true } },
                        logs: {
                            orderBy: { createdAt: 'desc' },
                            include: { actor: { select: { id: true, name: true } } },
                        },
                        resolvedBy: { select: { id: true, name: true } },
                    },
                });

                // log
                await tx.reportLog.create({
                    data: {
                        reportId: rep.id,
                        action: 'RESOLVE',
                        prevResolution: null,
                        nextResolution: resolution,
                        reason: note,
                        actorId: me.id,
                    },
                });

                return r;
            });

            return withCORS(NextResponse.json({ report: updated }));
        }

        // เปลี่ยนคำตัดสิน
        if (!changeReason || !changeReason.trim()) {
            return withCORS(NextResponse.json({ message: 'CHANGE_REASON_REQUIRED' }, { status: 400 }));
        }

        const prev = rep.resolution ?? null;

        const updated = await prisma.$transaction(async (tx) => {
            // อัปเดตสถานะ user
            await tx.user.update({
                where: { id: rep.targetUserId },
                data: { accountStatus: resolutionToAccountStatus[resolution] },
            });

            // อัปเดตรายงาน (ยังคง RESOLVED)
            const r = await tx.report.update({
                where: { id: rep.id },
                data: {
                    resolution,
                    resolutionNote: changeReason,
                    resolvedById: me.id,
                    resolvedAt: now,
                },
                include: {
                    author: { select: { id: true, name: true, email: true, avatarUrl: true } },
                    targetUser: { select: { id: true, name: true, email: true, avatarUrl: true, accountStatus: true } },
                    logs: {
                        orderBy: { createdAt: 'desc' },
                        include: { actor: { select: { id: true, name: true } } },
                    },
                    resolvedBy: { select: { id: true, name: true } },
                },
            });

            // log
            await tx.reportLog.create({
                data: {
                    reportId: rep.id,
                    action: 'CHANGE',
                    prevResolution: prev,
                    nextResolution: resolution,
                    reason: changeReason,
                    actorId: me.id,
                },
            });

            return r;
        });

        return withCORS(NextResponse.json({ report: updated }));
    } catch (e: any) {
        return withCORS(NextResponse.json({ message: e?.message || 'Server error' }, { status: 500 }));
    }
}

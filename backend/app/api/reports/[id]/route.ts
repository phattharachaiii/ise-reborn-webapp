// backend/app/api/reports/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import type { ReportResolution, ReportStatus, AccountStatus } from '@prisma/client';

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

// --- helpers ---
const RES_STRS = ['UNBAN', 'TEMPSUSPEND', 'SUSPEND'] as const;

function parseResolution(v: unknown): ReportResolution | null {
    if (typeof v !== 'string') return null;
    const up = v.toUpperCase();
    return (RES_STRS as readonly string[]).includes(up)
        ? (up as ReportResolution)
        : null;
}

const mapResToUserStatus = (r: ReportResolution): AccountStatus =>
    r === 'UNBAN' ? 'ACTIVE' : r === 'TEMPSUSPEND' ? 'TEMPSUSPEND' : 'SUSPENDED';

// --- GET /api/reports/[id] ---
export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
    const me = await getUserFromRequest(_req).catch(() => null);
    if (!me || me.role !== 'ADMIN') {
        return withCORS(NextResponse.json({ message: 'FORBIDDEN' }, { status: 403 }));
    }

    const { id } = ctx.params;

    const report = await prisma.report.findUnique({
        where: { id },
        include: {
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            targetUser: { select: { id: true, name: true, email: true, avatarUrl: true, accountStatus: true } },
            logs: {
                orderBy: { createdAt: 'desc' },
                include: { actor: { select: { id: true, name: true } } }
            }
        }
    });

    if (!report) {
        return withCORS(NextResponse.json({ message: 'NOT_FOUND' }, { status: 404 }));
    }

    return withCORS(NextResponse.json({ report }));
}

// --- PATCH /api/reports/[id] ---
// First decision: { resolution: 'UNBAN'|'TEMPSUSPEND'|'SUSPEND', note: string }
// Change decision: { resolution: 'UNBAN'|'TEMPSUSPEND'|'SUSPEND', changeReason: string }
export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
    const me = await getUserFromRequest(req).catch(() => null);
    if (!me || me.role !== 'ADMIN') {
        return withCORS(NextResponse.json({ message: 'FORBIDDEN' }, { status: 403 }));
    }

    const { id } = ctx.params;

    const body = await req.json().catch(() => null);
    if (!body) {
        return withCORS(NextResponse.json({ message: 'BAD_JSON' }, { status: 400 }));
    }

    const newRes = parseResolution(body?.resolution);
    if (!newRes) {
        return withCORS(NextResponse.json({ message: 'INVALID_RESOLUTION' }, { status: 400 }));
    }

    const note: string | undefined = typeof body?.note === 'string' ? body.note : undefined;
    const changeReason: string | undefined = typeof body?.changeReason === 'string' ? body.changeReason : undefined;

    const report = await prisma.report.findUnique({
        where: { id },
        include: { targetUser: { select: { id: true, accountStatus: true } } }
    });

    if (!report) {
        return withCORS(NextResponse.json({ message: 'NOT_FOUND' }, { status: 404 }));
    }

    // First resolution (PENDING -> RESOLVED) requires note
    if (report.status === 'PENDING') {
        if (!note?.trim()) {
            return withCORS(NextResponse.json({ message: 'NOTE_REQUIRED' }, { status: 400 }));
        }

        const userStatus = mapResToUserStatus(newRes);

        const [updatedReport] = await prisma.$transaction([
            prisma.report.update({
                where: { id },
                data: {
                    status: 'RESOLVED' as ReportStatus,
                    resolution: newRes,
                    resolutionNote: note,
                    resolvedById: me.id,
                    resolvedAt: new Date(),
                    logs: {
                        create: {
                            actorId: me.id,
                            action: 'RESOLVE',
                            // prevResolution omitted on first decision
                            nextResolution: newRes,
                            reason: note
                        }
                    }
                },
                include: {
                    author: { select: { id: true, name: true } },
                    targetUser: { select: { id: true, name: true, accountStatus: true } },
                    logs: { orderBy: { createdAt: 'desc' }, include: { actor: { select: { id: true, name: true } } } }
                }
            }),
            prisma.user.update({
                where: { id: report.targetUserId },
                data: { accountStatus: userStatus },
                select: { id: true, accountStatus: true }
            })
        ]);

        return withCORS(NextResponse.json({ report: updatedReport }));
    }

    // Change decision (RESOLVED -> RESOLVED)
    const prev: ReportResolution | undefined = report.resolution ?? undefined;
    if (!changeReason?.trim()) {
        return withCORS(NextResponse.json({ message: 'CHANGE_REASON_REQUIRED' }, { status: 400 }));
    }
    if (prev === newRes) {
        return withCORS(NextResponse.json({ message: 'SAME_RESOLUTION' }, { status: 400 }));
    }

    const userStatus = mapResToUserStatus(newRes);

    const [changedReport] = await prisma.$transaction([
        prisma.report.update({
            where: { id },
            data: {
                resolution: newRes,
                resolutionNote: changeReason,
                resolvedById: me.id,
                resolvedAt: new Date(),
                logs: {
                    create: {
                        actorId: me.id,
                        action: 'CHANGE',
                        prevResolution: prev,
                        nextResolution: newRes,
                        reason: changeReason
                    }
                }
            },
            include: {
                author: { select: { id: true, name: true } },
                targetUser: { select: { id: true, name: true, accountStatus: true } },
                logs: { orderBy: { createdAt: 'desc' }, include: { actor: { select: { id: true, name: true } } } }
            }
        }),
        prisma.user.update({
            where: { id: report.targetUserId },
            data: { accountStatus: userStatus },
            select: { id: true, accountStatus: true }
        })
    ]);

    return withCORS(NextResponse.json({ report: changedReport }));
}

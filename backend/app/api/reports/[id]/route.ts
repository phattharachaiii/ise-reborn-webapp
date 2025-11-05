// Run Prisma on Node runtime
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

/** ----- CORS ----- */
const FE_ORIGIN = process.env.FE_ORIGIN || 'http://localhost:5173';
function withCORS(res: NextResponse): Response {
  res.headers.set('Access-Control-Allow-Origin', FE_ORIGIN);
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.headers.set('Access-Control-Allow-Methods', 'GET,PATCH,OPTIONS');
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  return res;
}

export async function OPTIONS(_req: Request): Promise<Response> {
  return withCORS(NextResponse.json({ ok: true }));
}

/** ----- Types & helpers ----- */
type Resolution = 'UNBAN' | 'TEMPSUSPEND' | 'SUSPEND';
type AccountStatus = 'ACTIVE' | 'TEMPSUSPEND' | 'SUSPENDED';

const resolutionToAccountStatus: Record<Resolution, AccountStatus> = {
  UNBAN: 'ACTIVE',
  TEMPSUSPEND: 'TEMPSUSPEND',
  SUSPEND: 'SUSPENDED',
};

function badRequest(message: string) {
  return withCORS(NextResponse.json({ message }, { status: 400 }));
}
function forbidden() {
  return withCORS(NextResponse.json({ message: 'FORBIDDEN' }, { status: 403 }));
}
function notFound() {
  return withCORS(NextResponse.json({ message: 'NOT_FOUND' }, { status: 404 }));
}
function serverError(e: any) {
  return withCORS(NextResponse.json({ message: e?.message || 'Server error' }, { status: 500 }));
}

/** ====== GET /api/reports/[id] ====== */
export async function GET(req: Request, ctx: any): Promise<Response> {
  try {
    const { id } = (ctx?.params ?? {}) as { id: string };

    const me = await getUserFromRequest(req as any).catch(() => null);
    if (!me || me.role !== 'ADMIN') return forbidden();

    const rep = await prisma.report.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        targetUser: {
          select: { id: true, name: true, email: true, avatarUrl: true, accountStatus: true },
        },
        logs: {
          orderBy: { createdAt: 'desc' },
          include: { actor: { select: { id: true, name: true } } },
        },
        resolvedBy: { select: { id: true, name: true } },
      },
    });

    if (!rep) return notFound();
    return withCORS(NextResponse.json({ report: rep }));
  } catch (e: any) {
    return serverError(e);
  }
}

/** ====== PATCH /api/reports/[id]
 *  Body:
 *   - First decision: { resolution: 'UNBAN'|'TEMPSUSPEND'|'SUSPEND', note: string }
 *   - Change decision: { resolution: 'UNBAN'|'TEMPSUSPEND'|'SUSPEND', changeReason: string }
 *  Effect:
 *   - Update Report + create ReportLog
 *   - Update User.accountStatus following resolution
 */
export async function PATCH(req: Request, ctx: any): Promise<Response> {
  try {
    const { id } = (ctx?.params ?? {}) as { id: string };

    const me = await getUserFromRequest(req as any).catch(() => null);
    if (!me || me.role !== 'ADMIN') return forbidden();

    const body = await req.json().catch(() => ({}));
    const { resolution, note, changeReason } = body as {
      resolution?: Resolution;
      note?: string;
      changeReason?: string;
    };

    if (!resolution || !['UNBAN', 'TEMPSUSPEND', 'SUSPEND'].includes(resolution)) {
      return badRequest('INVALID_RESOLUTION');
    }

    const rep = await prisma.report.findUnique({
      where: { id },
      include: { targetUser: true },
    });
    if (!rep) return notFound();

    const now = new Date();

    // First decision (PENDING -> RESOLVED)
    if (rep.status === 'PENDING') {
      if (!note || !note.trim()) return badRequest('NOTE_REQUIRED');

      const updated = await prisma.$transaction(async (tx) => {
        // Update target user status
        await tx.user.update({
          where: { id: rep.targetUserId },
          data: { accountStatus: resolutionToAccountStatus[resolution] },
        });

        // Update report
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
            author: { select: { id: true, name: true, email: true, avatarUrl: true} },
            targetUser: {
              select: { id: true, name: true, email: true, avatarUrl: true, accountStatus: true },
            },
            logs: {
              orderBy: { createdAt: 'desc' },
              include: { actor: { select: { id: true, name: true } } },
            },
            resolvedBy: { select: { id: true, name: true } },
          },
        });

        // Log
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

    // Change decision (still RESOLVED)
    if (!changeReason || !changeReason.trim()) {
      return badRequest('CHANGE_REASON_REQUIRED');
    }

    const prev = rep.resolution ?? null;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: rep.targetUserId },
        data: { accountStatus: resolutionToAccountStatus[resolution] },
      });

      const r = await tx.report.update({
        where: { id: rep.id },
        data: {
          resolution,
          resolutionNote: changeReason,
          resolvedById: me.id,
          resolvedAt: now,
        },
        include: {
          author: { select: { id: true, name: true, email: true, avatarUrl: true} },
          targetUser: {
            select: { id: true, name: true, email: true, avatarUrl: true, accountStatus: true },
          },
          logs: {
            orderBy: { createdAt: 'desc' },
            include: { actor: { select: { id: true, name: true } } },
          },
          resolvedBy: { select: { id: true, name: true } },
        },
      });

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
    return serverError(e);
  }
}

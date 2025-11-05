// Force Node runtime (Prisma ต้องใช้ Node)
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

// ---- Simple CORS helper (ถ้าข้ามพอร์ต) ----
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

// map resolution -> account status
type Resolution = 'UNBAN' | 'TEMPSUSPEND' | 'SUSPEND';
type AccountStatus = 'ACTIVE' | 'TEMPSUSPEND' | 'SUSPENDED';

const resolutionToAccountStatus: Record<Resolution, AccountStatus> = {
  UNBAN: 'ACTIVE',
  TEMPSUSPEND: 'TEMPSUSPEND',
  SUSPEND: 'SUSPENDED',
};

// GET /api/reports/[id]
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  try {
    const me = await getUserFromRequest(req as any).catch(() => null);
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
): Promise<Response> {
  try {
    const me = await getUserFromRequest(req as any).catch(() => null);
    if (!me || me.role !== 'ADMIN') {
      return withCORS(NextResponse.json({ message: 'FORBIDDEN' }, { status: 403 }));
    }

    const body = await req.json().catch(() => ({}));
    const { resolution, note, changeReason } = body as {
      resolution?: Resolution;
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

        // สร้าง log
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
          author: { select: { id: true, name: true, email: true, avatarUrl: true } },
          targetUser: { select: { id: true, name: true, email: true, avatarUrl: true, accountStatus: true } },
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
    return withCORS(NextResponse.json({ message: e?.message || 'Server error' }, { status: 500 }));
  }
}

// app/api/offers/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import {
  OfferActor,
  OfferStatus,
  ListingStatus,
  NotificationType
} from '@prisma/client';

export const runtime = 'nodejs';

const FE_ORIGIN = process.env.FE_ORIGIN || 'http://localhost:5173';
const withCORS = (res: NextResponse) => {
  res.headers.set('Access-Control-Allow-Origin', FE_ORIGIN);
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.headers.set('Access-Control-Allow-Methods', 'GET,PATCH,OPTIONS');
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('Vary', 'Origin');
  return res;
};

export async function OPTIONS() {
  return withCORS(new NextResponse(null, { status: 204 }));
}

type Ctx = { params: Promise<{ id: string }> };

/* ===================== GET ===================== */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;

  const me = await getUserFromRequest(req).catch(() => null);
  if (!me) return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }));

  const offer = await prisma.offer.findUnique({
    where: { id },
    include: {
      listing: {
        select: { id: true, title: true, price: true, imageUrls: true, sellerId: true, status: true }
      },
      seller: { select: { id: true, name: true } },
      buyer: { select: { id: true, name: true } }
    }
  });

  if (!offer) return withCORS(NextResponse.json({ message: 'OFFER_NOT_FOUND' }, { status: 404 }));

  const isBuyer = me.id === offer.buyerId;
  const isSeller = me.id === offer.sellerId;
  const isAdmin = me.role === 'ADMIN';
  if (!isBuyer && !isSeller && !isAdmin) {
    return withCORS(NextResponse.json({ message: 'FORBIDDEN' }, { status: 403 }));
  }

  const yourTurn =
    (offer.lastActor === 'BUYER' && (isSeller || isAdmin)) ||
    (offer.lastActor === 'SELLER' && (isBuyer || isAdmin));

  const isNegotiating = offer.status === OfferStatus.REQUESTED || offer.status === OfferStatus.REOFFER;

  const meta = {
    isBuyer,
    isSeller,
    isAdmin,
    yourTurn,
    canAccept:
      isNegotiating &&
      ((isSeller && offer.lastActor === 'BUYER') || (isBuyer && offer.lastActor === 'SELLER') || isAdmin),
    canReject: isNegotiating && (yourTurn || isAdmin),
    canReoffer: isNegotiating && (yourTurn || isAdmin),
    // ปิดดีลได้หลังสแกนเสร็จ
    canClose: (isSeller || isAdmin) && offer.status === OfferStatus.COMPLETED,
    // ยกเลิก (เปิดขายต่อ) ถ้ายังไม่ completed
    canCancel: (isSeller || isAdmin) && offer.status !== OfferStatus.COMPLETED
  };

  return withCORS(NextResponse.json({ offer, meta }));
}

/* ========== PATCH: REOFFER / ACCEPT / REJECT / SCAN / CLOSE / CANCEL ========== */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const me = await getUserFromRequest(req).catch(() => null);
  if (!me) return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }));

  const body = await req.json().catch(() => ({}));
  const rawAction = String(body?.action || '');
  const action = normalizeAction(rawAction);

  const offer = await prisma.offer.findUnique({
    where: { id },
    include: { listing: { select: { id: true, title: true, sellerId: true, status: true } } }
  });
  if (!offer) return withCORS(NextResponse.json({ message: 'OFFER_NOT_FOUND' }, { status: 404 }));

  const isBuyer = me.id === offer.buyerId;
  const isSeller = me.id === offer.sellerId;
  const isAdmin = me.role === 'ADMIN';
  if (!isBuyer && !isSeller && !isAdmin) {
    return withCORS(NextResponse.json({ message: 'FORBIDDEN' }, { status: 403 }));
  }

  const targetUserId = isSeller ? offer.buyerId : offer.sellerId;

  const yourTurn =
    (offer.lastActor === OfferActor.BUYER && isSeller) ||
    (offer.lastActor === OfferActor.SELLER && isBuyer) ||
    isAdmin;

  const isNegotiating =
    offer.status === OfferStatus.REQUESTED || offer.status === OfferStatus.REOFFER;

  // ----- REOFFER -----
  if (action === 'REOFFER') {
    if (!yourTurn) return withCORS(NextResponse.json({ message: 'NOT_YOUR_TURN' }, { status: 403 }));

    const meetPlace = String(body?.meetPlace || '').trim();
    const meetTimeISO = String(body?.meetTime || '').trim(); // คาดว่าเป็น ISO string
    if (!meetPlace || !meetTimeISO) {
      return withCORS(NextResponse.json({ message: 'MEET_INFO_REQUIRED' }, { status: 400 }));
    }

    const meetAt = new Date(meetTimeISO);
    if (isNaN(meetAt.getTime())) {
      return withCORS(NextResponse.json({ message: 'MEET_TIME_INVALID' }, { status: 400 }));
    }

    // ✅ บังคับต้องเป็นเวลาอนาคตอย่างน้อย +5 นาที
    const MIN_DELTA_MS = 5 * 60 * 1000;
    if (meetAt.getTime() < Date.now() + MIN_DELTA_MS) {
      return withCORS(
        NextResponse.json(
          { message: 'MEET_TIME_IN_PAST', hint: 'เลือกเวลาที่มากกว่าเวลาปัจจุบันอย่างน้อย 5 นาที' },
          { status: 400 }
        )
      );
    }

    const lastActor: OfferActor = isSeller ? OfferActor.SELLER : OfferActor.BUYER;

    const [updated] = await prisma.$transaction([
      prisma.offer.update({
        where: { id: offer.id },
        data: {
          status: OfferStatus.REOFFER,
          meetPlace,
          meetTime: meetAt,
          lastActor,
          qrToken: null,
          qrScannedAt: null
        }
      }),
      prisma.notification.create({
        data: {
          userId: targetUserId,
          type: NotificationType.OFFER_REOFFER,
          offerId: offer.id,
          listingId: offer.listingId,
          title: 'มีการเสนอวัน–สถานที่ใหม่',
          message: `${isSeller ? 'ผู้ขาย' : 'ผู้ซื้อ'} เสนอ: ${meetPlace} @ ${meetAt.toLocaleString()}`
        }
      })
    ]);

    return withCORS(NextResponse.json({ offer: updated }));
  }


  // ----- ACCEPT → เจน QR + ตั้ง Listing = PENDING -----
  if (action === 'ACCEPT') {
    if (!yourTurn) return withCORS(NextResponse.json({ message: 'NOT_YOUR_TURN' }, { status: 403 }));

    const token = await generateUniqueQrToken();

    const [updated] = await prisma.$transaction([
      prisma.offer.update({
        where: { id: offer.id },
        data: {
          status: OfferStatus.ACCEPTED,
          lastActor: isSeller ? OfferActor.SELLER : OfferActor.BUYER,
          qrToken: token,
          qrScannedAt: null
        }
      }),
      prisma.listing.update({
        where: { id: offer.listingId },
        data: { status: ListingStatus.PENDING } // ⬅️ Pending ตั้งแต่เจน QR
      }),
      prisma.notification.create({
        data: {
          userId: targetUserId,
          type: NotificationType.OFFER_ACCEPTED,
          offerId: offer.id,
          listingId: offer.listingId,
          title: isSeller ? 'ผู้ขายยอมรับคำขอ' : 'ผู้ซื้อยอมรับข้อเสนอ',
          message: isSeller
            ? 'ผู้ขายยอมรับดีลแล้ว พร้อมให้สแกน QR ในวันนัด'
            : 'ผู้ซื้อยอมรับดีลแล้ว โปรดแสดง QR ในวันนัด'
        }
      })
    ]);

    return withCORS(NextResponse.json({ offer: updated }));
  }

  // ----- REJECT → คืน Listing = ACTIVE -----
  if (action === 'REJECT') {
    if (!yourTurn) return withCORS(NextResponse.json({ message: 'NOT_YOUR_TURN' }, { status: 403 }));

    const reason = String(body?.reason || '').slice(0, 300) || null;
    const lastActor: OfferActor = isSeller ? OfferActor.SELLER : OfferActor.BUYER;

    const [updated] = await prisma.$transaction([
      prisma.offer.update({
        where: { id: offer.id },
        data: {
          status: OfferStatus.REJECTED,
          lastActor,
          rejectReason: reason,
          qrToken: null,
          qrScannedAt: null
        }
      }),
      prisma.listing.update({
        where: { id: offer.listingId },
        data: { status: ListingStatus.ACTIVE }
      }),
      prisma.notification.create({
        data: {
          userId: targetUserId,
          type: NotificationType.OFFER_REJECTED,
          offerId: offer.id,
          listingId: offer.listingId,
          title: 'ข้อเสนอถูกปฏิเสธ',
          message: reason ? `เหตุผล: ${reason}` : null
        }
      })
    ]);

    return withCORS(NextResponse.json({ offer: updated }));
  }

  // ----- SCAN (ผู้ซื้อสแกน) → Offer = COMPLETED และ Listing = SOLD -----
  if (action === 'SCAN') {
    const tokenRaw = String(body?.token ?? body?.code ?? '').trim();
    if (!tokenRaw) {
      return withCORS(NextResponse.json({ message: 'TOKEN_REQUIRED' }, { status: 400 }));
    }

    const token = extractToken(tokenRaw);
    if (!token) return withCORS(NextResponse.json({ message: 'TOKEN_INVALID' }, { status: 400 }));

    if (!offer.qrToken) return withCORS(NextResponse.json({ message: 'QR_NOT_ISSUED' }, { status: 400 }));
    if (token !== offer.qrToken) {
      return withCORS(NextResponse.json({ message: 'TOKEN_MISMATCH' }, { status: 400 }));
    }

    const [updatedOffer, updatedListing] = await prisma.$transaction([
      prisma.offer.update({
        where: { id: offer.id },
        data: {
          status: OfferStatus.COMPLETED,
          qrScannedAt: new Date()
        }
      }),
      prisma.listing.update({
        where: { id: offer.listingId },
        data: { status: ListingStatus.SOLD } // ⬅️ เปลี่ยนเป็น SOLD ทันทีหลังสแกน
      }),
      prisma.notification.create({
        data: {
          userId: targetUserId,
          type: NotificationType.OFFER_COMPLETED,
          offerId: offer.id,
          listingId: offer.listingId,
          title: 'ยืนยันหน้างานแล้ว',
          message: 'ผู้ซื้อสแกน QR สำเร็จ — ประกาศถูกทำเป็นขายแล้ว'
        }
      })
    ]);

    return withCORS(NextResponse.json({ offer: updatedOffer, listing: updatedListing }));
  }

  // ----- CLOSE (ปิดดีลจริง) → Listing = SOLD (กันซ้ำถ้าขายแล้ว) -----
  if (action === 'CLOSE') {
    if (!(isSeller || isAdmin)) {
      return withCORS(NextResponse.json({ message: 'ONLY_SELLER_OR_ADMIN' }, { status: 403 }));
    }

    // ถ้าขายแล้วจากการสแกนไปก่อนหน้า ไม่ต้องปิดซ้ำ
    if (offer.listing.status === ListingStatus.SOLD) {
      return withCORS(NextResponse.json({ message: 'ALREADY_SOLD' }, { status: 409 }));
    }

    const updatedListing = await prisma.listing.update({
      where: { id: offer.listingId },
      data: { status: ListingStatus.SOLD }
    });

    return withCORS(NextResponse.json({ ok: true, listing: updatedListing }));
  }



  return withCORS(
    NextResponse.json({
      message: 'UNKNOWN_ACTION',
      received: rawAction,
      normalized: action,
      supported: ['REOFFER', 'ACCEPT', 'REJECT', 'SCAN', 'CLOSE', 'CANCEL']
    }, { status: 400 })
  );
}

/* ===================== helpers ===================== */
function normalizeAction(s: string) {
  const t = s.replace(/[\s-]+/g, '_').toUpperCase();
  const map: Record<string, string> = {
    REOFFER: 'REOFFER',
    ACCEPT: 'ACCEPT',
    REJECT: 'REJECT',
    SCAN: 'SCAN',
    SCAN_QR: 'SCAN',
    VERIFY: 'SCAN',
    CONFIRM: 'SCAN',
    CLOSE: 'CLOSE',
    CANCEL: 'CANCEL'
  };
  return map[t] || '';
}

/** รองรับทั้งโค้ดล้วน และ URL ที่มี ?t= หรือ ?token= */
function extractToken(raw: string): string | null {
  const s = raw.trim();
  if (/^https?:\/\//i.test(s) || /^[a-z]+:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      return u.searchParams.get('t') || u.searchParams.get('token') || null;
    } catch {
      return null;
    }
  }
  return s || null;
}

/** ป้องกันชน unique ของ qrToken แบบเบา ๆ */
async function generateUniqueQrToken(retry = 5): Promise<string> {
  while (retry-- > 0) {
    const token = Math.random().toString(36).slice(2);
    const exists = await prisma.offer.findFirst({ where: { qrToken: token }, select: { id: true } });
    if (!exists) return token;
  }
  // ถ้ายังชน ให้แน่นอนด้วย nanoid/uuid ก็ได้ (นี่เลือก fallback แบบง่าย)
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

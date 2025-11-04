// app/api/listings/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { Category, Condition, ListingStatus } from '@prisma/client';
import { addDays } from 'date-fns';

// ✅ ใช้ util เดียวกับที่คุณมีอยู่
import {
  withImageUrlsList,
  withImageUrls,
  normArray,
} from '@/lib/_utils/images';

export const runtime = 'nodejs';

// ===== CORS / Config =====
const FE_ORIGIN = process.env.FE_ORIGIN || 'http://localhost:5173';
const BOOST_DAYS = parseInt(process.env.BOOST_DAYS || '7', 10);
const MAX_ACTIVE_BOOSTS_PER_USER = parseInt(process.env.MAX_ACTIVE_BOOSTS_PER_USER || '10', 10);

function withCORS(res: NextResponse, req?: Request, methods: string[] = ['GET', 'POST', 'OPTIONS']) {
  // allow single FE origin
  res.headers.set('Access-Control-Allow-Origin', FE_ORIGIN);
  res.headers.set('Vary', 'Origin');

  // allow cookies if needed
  res.headers.set('Access-Control-Allow-Credentials', 'true');

  // methods + headers
  res.headers.set('Access-Control-Allow-Methods', [...methods, 'OPTIONS'].join(','));
  const reqHdr = req?.headers.get('access-control-request-headers');
  res.headers.set('Access-Control-Allow-Headers', reqHdr || 'Content-Type, Authorization, X-Requested-With');

  // reduce repeated preflight
  res.headers.set('Access-Control-Max-Age', '86400');

  // always fresh for API
  res.headers.set('Cache-Control', 'no-store');

  return res;
}

export async function OPTIONS(req: Request) {
  return withCORS(new NextResponse(null, { status: 204 }), req);
}

/* ----------------------------------------------------------------
   GET /api/listings
   query:
     - query: string (ค้นหาจาก title/description)
     - category: Category
     - status: ACTIVE|SOLD|HIDDEN|... (ถ้าไม่ส่ง → default: ไม่เอา SOLD)
     - mine: '1'|'true' (ต้องล็อกอิน)
     - excludeMine: '1' (ตัดประกาศของตัวเองออก ถ้ามี me)
     - limit: number (default 24, max 60)
     - cursor: id (pagination)
------------------------------------------------------------------*/
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('query') || '').trim();
  const catRaw = (url.searchParams.get('category') || '').trim().toUpperCase();
  const statusParam = (url.searchParams.get('status') || '').trim().toUpperCase();
  const mine = /^(1|true)$/i.test(url.searchParams.get('mine') || '');
  const excludeMine = url.searchParams.get('excludeMine') === '1';
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '24', 10) || 24, 1), 60);
  const cursor = url.searchParams.get('cursor') || undefined;

  const me = await getUserFromRequest(req).catch(() => null);

  // ---- where base ----
  // ถ้าไม่ส่ง status → default: not SOLD (ให้ SOLD หลบจากหน้าแรก/ feed)
  let statusWhere: any = undefined;
  if (statusParam && statusParam in ListingStatus) {
    statusWhere = statusParam as ListingStatus;
  } else {
    statusWhere = { not: 'SOLD' as ListingStatus };
  }

  const where: any = {};
  if (statusWhere) where.status = statusWhere;

  if (mine) {
    if (!me) return withCORS(NextResponse.json({ items: [], nextCursor: null }, { status: 200 }), req);
    where.sellerId = me.id;
  } else if (excludeMine && me) {
    where.sellerId = { not: me.id };
  }

  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ];
  }

  if (catRaw && Object.values(Category).includes(catRaw as Category)) {
    where.category = catRaw as Category;
  }

  const findArgs: any = {
    where,
    orderBy: [{ boostedUntil: 'desc' }, { createdAt: 'desc' }],
    take: limit + 1, // +1 เพื่อตรวจว่ามีหน้าถัดไปไหม
    select: {
      id: true,
      title: true,
      price: true,
      status: true,
      imageUrls: true,     // เก็บเป็น string[]
      category: true,
      boostedUntil: true,
      seller: { select: { id: true, name: true, avatarUrl: true } },
    },
  };

  if (cursor) {
    findArgs.cursor = { id: cursor };
    findArgs.skip = 1;
  }

  const rows = await prisma.listing.findMany(findArgs);

  // normalize images
  const normalized = withImageUrlsList(rows);

  const hasNext = normalized.length > limit;
  const items = hasNext ? normalized.slice(0, limit) : normalized;
  const nextCursor = hasNext ? normalized[normalized.length - 1].id : null;

  return withCORS(NextResponse.json({ items, nextCursor }), req);
}

/* ----------------------------------------------------------------
   POST /api/listings
   body: {
     title, description, price,
     condition, category,
     images?: string[] | string,
     imageUrls?: string[] | string,
     boost?: boolean
   }
   ต้องล็อกอิน
------------------------------------------------------------------*/
export async function POST(req: Request) {
  try {
    const me = await getUserFromRequest(req).catch(() => null);
    if (!me) {
      return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }), req);
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return withCORS(NextResponse.json({ message: 'BAD_JSON' }, { status: 400 }), req);
    }

    const {
      title,
      description,
      price,
      condition,
      images = [],
      imageUrls = [],
      category = 'OTHERS',
      boost = false,
    } = body as {
      title?: string;
      description?: string;
      price?: number;
      condition?: string;
      images?: string[] | string;
      imageUrls?: string[] | string;
      category?: string;
      boost?: boolean;
    };

    if (!title || !description || !price || price <= 0 || !condition) {
      return withCORS(NextResponse.json({ message: 'MISSING_FIELDS' }, { status: 400 }), req);
    }

    const condUp = String(condition).toUpperCase();
    if (!Object.values(Condition).includes(condUp as Condition)) {
      return withCORS(NextResponse.json({ message: 'INVALID_CONDITION' }, { status: 400 }), req);
    }

    const catUp = String(category).toUpperCase();
    if (!Object.values(Category).includes(catUp as Category)) {
      return withCORS(NextResponse.json({ message: 'INVALID_CATEGORY' }, { status: 400 }), req);
    }

    // รวมรูปจากทั้งสองคีย์ แล้วกรองซ้ำ/ว่าง ให้ได้ string[]
    const imgs = Array.from(new Set([...normArray(images), ...normArray(imageUrls)]));

    // จัดการ boost (มีลิมิตจำนวนที่ยังไม่หมดอายุ)
    let boostedUntil: Date | null = null;
    let boostedAt: Date | null = null;
    if (boost) {
      const activeBoosts = await prisma.listing.count({
        where: { sellerId: me.id, boostedUntil: { gt: new Date() } },
      });
      if (activeBoosts >= MAX_ACTIVE_BOOSTS_PER_USER) {
        return withCORS(NextResponse.json({ message: 'BOOST_LIMIT_REACHED' }, { status: 400 }), req);
      }
      boostedAt = new Date();
      boostedUntil = addDays(boostedAt, BOOST_DAYS);
    }

    const listing = await prisma.listing.create({
      data: {
        sellerId: me.id,
        title,
        description,
        price,
        condition: condUp as Condition,
        status: 'ACTIVE',
        imageUrls: imgs,
        category: catUp as Category,
        boostedAt,
        boostedUntil,
      },
      include: { seller: { select: { id: true, name: true, avatarUrl: true } } },
    });

    return withCORS(NextResponse.json({ listing: withImageUrls(listing) }, { status: 201 }), req);
  } catch (e: any) {
    return withCORS(NextResponse.json({ message: e?.message || 'CREATE_FAILED' }, { status: 500 }), req);
  }
}

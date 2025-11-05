import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

const FE_ORIGIN = process.env.FE_ORIGIN || 'http://localhost:5173';

function withCORS(res: NextResponse, allow: string[] = ['GET', 'OPTIONS']) {
  res.headers.set('Access-Control-Allow-Origin', FE_ORIGIN);
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.headers.set('Access-Control-Allow-Methods', allow.join(','));
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  return res;
}

export function OPTIONS() {
  return withCORS(NextResponse.json({ ok: true }));
}

/** ----- Thai-friendly helpers ----- */
const ZWSP = /[\u200B\u200C\u200D\uFEFF]/g;
const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
const ARABIC_DIGITS = '0123456789';

function thaiDigitsToAscii(s: string) {
  return s.replace(/[๐-๙]/g, (d) => ARABIC_DIGITS[THAI_DIGITS.indexOf(d)]);
}
function normalizeQuery(s: string) {
  // ลบ zero-width, แปลงเลขไทย, ตัดช่องว่างหัวท้าย
  return thaiDigitsToAscii(s).replace(ZWSP, '').trim();
}

// คำพ้องแบบง่าย (เติมเพิ่มได้ตามที่ใช้จริงใน campus)
const TH_SYNONYMS: Record<string, string[]> = {
  'แมค': ['mac', 'macbook'],
  'แมคบุ๊ค': ['macbook', 'mac'],
  'โน้ตบุ๊ก': ['notebook', 'laptop'],
  'โน๊ตบุ๊ค': ['notebook', 'laptop'],
  'โน้ตบุค': ['notebook', 'laptop'],
  'ไอโฟน': ['iphone'],
  'ไอแพด': ['ipad'],
  'แอร์พอด': ['airpods'],
  'ซัมซุง': ['samsung'],
  'หูฟัง': ['headphone', 'earphone', 'earbuds'],
  'เมาส์': ['mouse'],
  'คีย์บอร์ด': ['keyboard', 'mechanical keyboard'],
  'เสื้อผ้า': ['clothes', 'clothing', 'apparel'],
  'รองเท้า': ['shoes', 'sneakers'],
};

const CATS = [
  'BOOKS','CLOTHES','GADGET','FURNITURE','SPORTS','STATIONERY',
  'ELECTRONICS','VEHICLES','MUSIC','OTHERS'
] as const;

// GET /api/listings/search?q=...&status=ACTIVE|PENDING|SOLD|HIDDEN|ALL&limit=36
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const qRawIn = (url.searchParams.get('q') || '').trim();
  const qNorm = normalizeQuery(qRawIn);
  const statusParam = (url.searchParams.get('status') || 'ACTIVE').toUpperCase();
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '36', 10) || 36, 60);

  const me = await getUserFromRequest(req).catch(() => null);

  // ---------- build where ----------
  const where: any = {};

  // Status filter
  if (statusParam !== 'ALL') {
    const parts = statusParam.split(',').map((s) => s.trim()).filter(Boolean);
    where.status = parts.length > 1 ? { in: parts } : parts[0] || 'ACTIVE';
  } else if (me?.role !== 'ADMIN') {
    // ผู้ใช้ทั่วไปไม่เห็น HIDDEN
    where.status = { in: ['ACTIVE', 'PENDING', 'SOLD'] };
  }

  // Text search (title/description/ seller name) + synonyms
  const ors: any[] = [];
  const pushTerm = (term: string) => {
    if (!term) return;
    ors.push(
      { title: { contains: term, mode: 'insensitive' } },
      { description: { contains: term, mode: 'insensitive' } },
      // ค้นชื่อผู้ขายด้วย
      { seller: { is: { name: { contains: term, mode: 'insensitive' } } } },
    );
  };

  if (qRawIn) {
    // original
    pushTerm(qRawIn);
    // normalized (ลบ ZWSP/เลขไทย)
    if (qNorm !== qRawIn) pushTerm(qNorm);

    // synonyms ถ้าตรงคำไทยทั้งคำ
    const syn = TH_SYNONYMS[qNorm] || TH_SYNONYMS[qRawIn];
    if (syn && syn.length) syn.forEach(pushTerm);

    // split ช่องว่าง (ถ้ามี) แล้วลองแต่ละ token
    const tokens = qNorm.split(/\s+/).filter(Boolean);
    if (tokens.length > 1) tokens.forEach(pushTerm);

    // เดา category จาก q
    const catCandidate = qNorm.toUpperCase();
    if ((CATS as readonly string[]).includes(catCandidate)) {
      where.category = catCandidate;
    }
  }

  if (ors.length) where.OR = ors;

  const items = await prisma.listing.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      title: true,
      price: true,
      imageUrls: true,
      category: true,
      createdAt: true,
      seller: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return withCORS(NextResponse.json({ items }));
}

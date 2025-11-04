import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

const PUBLIC_FRONTEND_ORIGIN = process.env.PUBLIC_FRONTEND_ORIGIN || 'http://localhost:5173';
const withCORS = (res: NextResponse) => {
  res.headers.set('Access-Control-Allow-Origin', PUBLIC_FRONTEND_ORIGIN);
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  return res;
};

export async function OPTIONS() {
  // preflight
  return withCORS(new NextResponse(null, { status: 204 }));
}

export async function GET(req: Request) {
  const me = await getUserFromRequest(req).catch(() => null);
  if (!me) return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }));

  const items = await prisma.offer.findMany({
    where: { buyerId: me.id, status: 'COMPLETED' },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      updatedAt: true,
      meetPlace: true,
      meetTime: true,
      listing: { select: { id: true, title: true, price: true, imageUrls: true, status: true } },
      seller: { select: { id: true, name: true } }
    }
  });

  return withCORS(NextResponse.json({ items }, { status: 200 }));
}

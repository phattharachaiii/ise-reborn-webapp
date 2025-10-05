import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

/** ดึง user ปัจจุบันจาก Authorization/Cookie/Query token */
export async function getUserFromRequest(req: Request) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET_MISSING');

    // ---- ดึง token จาก header/cookie/query ----
    let token = '';

    const auth = req.headers.get('authorization') || '';
    if (/^Bearer\s+/i.test(auth)) token = auth.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
        const cookie = req.headers.get('cookie') || '';
        const m = cookie.match(/(?:^|;\s*)token=([^;]+)/);
        if (m) token = decodeURIComponent(m[1]);
    }

    if (!token) {
        try {
            const url = new URL(req.url);
            const q = url.searchParams.get('token');
            if (q) token = q;
        } catch { }
    }

    if (!token) throw new Error('NO_TOKEN');

    // ---- verify & extract user id ----
    let payload: any;
    try {
        payload = jwt.verify(token, secret);
    } catch {
        throw new Error('BAD_TOKEN');
    }

    // รองรับทั้งรูปแบบเดิม (id) และมาตรฐาน (sub)
    const userId: string | undefined =
        (payload && (payload.id as string)) ||
        (payload && (payload.sub as string));

    if (!userId) throw new Error('BAD_TOKEN_NO_ID');

    // ---- load user ที่ UI ต้องใช้ ----
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            avatarUrl: true,
        }
    });

    if (!user) throw new Error('USER_NOT_FOUND');

    return user; // { id, email, name, role, avatarUrl }
}

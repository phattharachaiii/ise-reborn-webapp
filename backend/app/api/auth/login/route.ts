import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const FE_ORIGIN = process.env.FE_ORIGIN || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const TOKEN_TTL_SEC = parseInt(process.env.JWT_TTL_SEC || '1209600', 10); // default 14 วัน

const withCORS = (res: NextResponse) => {
    res.headers.set('Access-Control-Allow-Origin', FE_ORIGIN);
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    return res;
};

export async function OPTIONS() {
    return withCORS(new NextResponse(null, { status: 204 }));
}

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null);
        if (!body) return withCORS(NextResponse.json({ message: 'BAD_JSON' }, { status: 400 }));

        const { email, password } = body as { email?: string; password?: string };
        if (!email || !password) {
            return withCORS(NextResponse.json({ message: 'MISSING_FIELDS' }, { status: 400 }));
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return withCORS(NextResponse.json({ message: 'The email or password you entered is incorrect' }, { status: 401 }));

        if (user.accountStatus !== 'ACTIVE') {
            return withCORS(NextResponse.json({ message: `ACCOUNT_${user.accountStatus}` }, { status: 403 }));
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return withCORS(NextResponse.json({ message: 'The email or password you entered is incorrect' }, { status: 401 }));

        const payload = { sub: user.id, role: user.role, name: user.name, avatarUrl: user.avatarUrl ?? null };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL_SEC });

        const res = NextResponse.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                accountStatus: user.accountStatus,
                avatarUrl: user.avatarUrl ?? null,
            },
        });

        // ตั้งคุกกี้ HttpOnly (เผื่อใช้โหมดคุกกี้)
        res.cookies.set('auth_token', token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: FE_ORIGIN.startsWith('https'),
            path: '/',
            maxAge: TOKEN_TTL_SEC,
        });

        return withCORS(res);
    } catch (e: any) {
        return withCORS(NextResponse.json({ message: e?.message || 'LOGIN_FAILED' }, { status: 500 }));
    }
}

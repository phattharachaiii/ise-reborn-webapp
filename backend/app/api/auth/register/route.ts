import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { isEmailAllowed, normalizeDomain } from '@/lib/auth/emailPolicy';

const PUBLIC_FRONTEND_ORIGIN = process.env.PUBLIC_FRONTEND_ORIGIN || 'http://localhost:5173';

const withCORS = (res: NextResponse) => {
    res.headers.set('Access-Control-Allow-Origin', PUBLIC_FRONTEND_ORIGIN);
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    return res;
};

export async function OPTIONS() {
    return withCORS(new NextResponse(null, { status: 204 }));
}

function validPassword(pw: string) {
    // อย่างน้อย 8 ตัว, ตัวเลข >=1, ตัวใหญ่ >=1, อักขระพิเศษ >=1, ไม่มีช่องว่าง
    return (
        typeof pw === 'string' &&
        pw.length >= 8 &&
        /[0-9]/.test(pw) &&
        /[A-Z]/.test(pw) &&
        /[^A-Za-z0-9]/.test(pw) &&
        !/\s/.test(pw)
    );
}

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null);
        if (!body) return withCORS(NextResponse.json({ message: 'BAD_JSON' }, { status: 400 }));

        const {
            email,
            name,
            password,
            passwordConfirm,
        } = body as {
            email?: string;
            name?: string;
            password?: string;
            passwordConfirm?: string;
        };

        if (!email || !password || !passwordConfirm) {
            return withCORS(NextResponse.json({ message: 'MISSING_FIELDS' }, { status: 400 }));
        }
        if (password !== passwordConfirm) {
            return withCORS(NextResponse.json({ message: 'PASSWORD_MISMATCH' }, { status: 400 }));
        }
        if (!validPassword(password)) {
            return withCORS(NextResponse.json({ message: 'WEAK_PASSWORD' }, { status: 400 }));
        }
        if (!isEmailAllowed(email)) {
            return withCORS(NextResponse.json({ message: 'EMAIL_DOMAIN_NOT_ALLOWED' }, { status: 400 }));
        }

        const existed = await prisma.user.findUnique({ where: { email } });
        if (existed) {
            return withCORS(NextResponse.json({ message: 'EMAIL_TAKEN' }, { status: 409 }));
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                name: name?.trim() || null,
                orgDomain: normalizeDomain(email),
                // studentId: null, // เพิ่มได้หากต้องการ
            },
            select: { id: true, email: true, name: true, role: true, accountStatus: true, avatarUrl: true }
        });

        return withCORS(NextResponse.json({ user }, { status: 201 }));
    } catch (e: any) {
        return withCORS(NextResponse.json({ message: e?.message || 'REGISTER_FAILED' }, { status: 500 }));
    }
}

import { NextResponse } from 'next/server';

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

export async function POST() {
    const res = NextResponse.json({ ok: true });
    res.cookies.set('auth_token', '', { httpOnly: true, maxAge: 0, path: '/' });
    return withCORS(res);
}
